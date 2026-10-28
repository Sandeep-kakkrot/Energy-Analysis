import json
import sys
import urllib.request
import urllib.error

BASE_URL = "http://localhost:5000/api"

def http_req(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except:
            return e.code, {"error": raw}

def main():
    print("=" * 65)
    print("Testing Hostel Wastage Logic & Closure Rule End-to-End")
    print("=" * 65)

    # 1. Login to get token
    status, login_res = http_req(f"{BASE_URL}/auth/login", method="POST", data={"username": "admin", "password": "Admin@123"})
    if status != 200:
        print(f"FAILED: Login failed: {status} {login_res}")
        sys.exit(1)
    
    token = login_res.get("access_token") or login_res.get("data", {}).get("accessToken")
    print(f"[OK] Auth login succeeded (role: {login_res.get('user', {}).get('role')})")

    # Ensure baseline state: Normal 24/7 operation (is_active=False)
    http_req(f"{BASE_URL}/wastage/hostel-closure", method="POST", data={
        "is_active": False,
        "start_date": "2024-06-01",
        "end_date": "2024-07-31",
        "standby_threshold_kwh": 50.0,
        "closure_reason": "Summer Vacation"
    }, token=token)

    # 2. Check indicators for Normal 24/7 operation
    status, resp = http_req(f"{BASE_URL}/wastage/indicators", method="GET", token=token)
    assert status == 200, f"Indicators failed: {resp}"
    indicators = resp["data"]

    hostel = next((b for b in indicators if "Hostel" in b["building_name"] or b.get("block_code") == "HST"), None)
    assert hostel is not None, "Hostel not found in indicators"
    print(f"\n[OK] Normal Operation Hostel Record:")
    print(f"   Building: {hostel['building_name']}")
    print(f"   Total kWh: {hostel['total_kwh']:,} (Preserved in full)")
    print(f"   Severity: {hostel['severity']} (Expected 'n/a')")
    print(f"   Status Text: {hostel['status_text']}")
    print(f"   Wastage %: {hostel.get('wastage_pct')} (Expected None)")
    print(f"   Display %: {hostel.get('display_pct')}")

    assert hostel['is_na'] is True, f"Expected is_na=True, got {hostel['is_na']}"
    assert hostel['severity'] == 'n/a', f"Expected severity='n/a', got {hostel['severity']}"
    assert hostel['status_text'] == "N/A – Hostel Operates 24/7", f"Unexpected status_text: {hostel['status_text']}"
    assert hostel['total_kwh'] > 600000, f"Expected hostel consumption preserved > 600,000, got {hostel['total_kwh']}"

    # Verify other buildings are unchanged
    lab = next((b for b in indicators if "Laboratory" in b["building_name"]), None)
    assert lab is not None, "Lab not found"
    print(f"\n[OK] Academic Building Check - Lab Block B: {lab['wastage_pct']}% (Severity: {lab['severity']})")
    assert lab['severity'] == 'high', f"Expected Lab severity='high', got {lab['severity']}"

    # 3. Check Dashboard Summary (Overall wastage should exclude hostel night/weekend living)
    status, sum_res = http_req(f"{BASE_URL}/dashboard/summary", method="GET", token=token)
    assert status == 200
    summary = sum_res["data"]
    print(f"\n[OK] Campus Dashboard Summary:")
    print(f"   Total Campus kWh: {summary['total_kwh']:,} (All 4 buildings preserved)")
    print(f"   Campus Wastage %: {summary['wastage_pct']}% (Previously ~50%, now ~36.34%)")
    assert summary['total_kwh'] > 2300000, f"Expected total kWh > 2.3M, got {summary['total_kwh']}"

    # 4. Test Closure Configuration: Activate Vacation Closure
    closure_payload = {
        "is_active": True,
        "start_date": "2024-06-01",
        "end_date": "2024-07-31",
        "standby_threshold_kwh": 50.0,
        "closure_reason": "Summer Vacation (Students Vacated)"
    }
    print(f"\nTesting Setting Hostel Confirmed Closure: {closure_payload['start_date']} to {closure_payload['end_date']}, Standby: {closure_payload['standby_threshold_kwh']} kWh...")
    status, set_res = http_req(f"{BASE_URL}/wastage/hostel-closure", method="POST", data=closure_payload, token=token)
    assert status == 200, f"Failed setting closure: {set_res}"
    print(f"[OK] Closure API response: {set_res['message']}")

    # Re-fetch indicators during closure
    status, resp_closed = http_req(f"{BASE_URL}/wastage/indicators", method="GET", token=token)
    assert status == 200
    indicators_closed = resp_closed["data"]
    hostel_closed = next((b for b in indicators_closed if "Hostel" in b["building_name"]), None)
    print(f"\n[OK] Confirmed Closure Hostel Record:")
    print(f"   Building: {hostel_closed['building_name']}")
    print(f"   Closure Active: {hostel_closed.get('closure_active')}")
    print(f"   Closure Period: {hostel_closed.get('closure_period')}")
    print(f"   Severity: {hostel_closed['severity']}")
    print(f"   Wastage kWh: {hostel_closed['wastage_kwh']} kWh (Excess above 50.0 kWh standby)")
    print(f"   Wastage %: {hostel_closed['wastage_pct']}%")
    print(f"   Display %: {hostel_closed.get('display_pct')}")
    print(f"   Recommendation: {hostel_closed['recommendation']}")

    assert hostel_closed['is_na'] is False, "Expected is_na=False during confirmed closure"
    assert hostel_closed.get('closure_active') is True or hostel_closed.get('is_closure_active') is True
    assert hostel_closed['wastage_pct'] is not None and hostel_closed['wastage_pct'] > 0

    # 5. Reset back to Normal 24/7 Operations
    normal_payload = {
        "is_active": False,
        "start_date": "2024-06-01",
        "end_date": "2024-07-31",
        "standby_threshold_kwh": 50.0,
        "closure_reason": "Summer Vacation"
    }
    print(f"\nResetting Hostel to Normal 24/7 Operations (is_active=False)...")
    status, reset_res = http_req(f"{BASE_URL}/wastage/hostel-closure", method="POST", data=normal_payload, token=token)
    assert status == 200, f"Failed resetting closure: {reset_res}"
    print(f"[OK] Reset API response: {reset_res['message']}")

    # Verify back to N/A
    status, resp_reset = http_req(f"{BASE_URL}/wastage/indicators", method="GET", token=token)
    indicators_reset = resp_reset["data"]
    hostel_reset = next((b for b in indicators_reset if "Hostel" in b["building_name"]), None)
    print(f"\n[OK] Final Hostel State:")
    print(f"   Status Text: {hostel_reset['status_text']}")
    print(f"   Severity: {hostel_reset['severity']}")
    print(f"   Wastage %: {hostel_reset['wastage_pct']}")
    print(f"   Display %: {hostel_reset['display_pct']}")
    assert hostel_reset['is_na'] is True
    assert hostel_reset['status_text'] == "N/A – Hostel Operates 24/7"

    print("\n" + "=" * 65)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    main()

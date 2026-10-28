# ============================================================
#  Campus Energy Analysis — Stop all dev servers
#  Usage: .\stop.ps1
# ============================================================

Write-Host ""
Write-Host "  Stopping dev servers..." -ForegroundColor Yellow

# Kill Flask (python index.py on port 5000)
$flask = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue |
         Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($flask) {
    Stop-Process -Id $flask -Force -ErrorAction SilentlyContinue
    Write-Host "  Flask backend stopped." -ForegroundColor Green
} else {
    Write-Host "  Flask backend was not running." -ForegroundColor DarkGray
}

# Kill Vite (node on port 5173)
$vite = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($vite) {
    Stop-Process -Id $vite -Force -ErrorAction SilentlyContinue
    Write-Host "  Vite frontend stopped." -ForegroundColor Green
} else {
    Write-Host "  Vite frontend was not running." -ForegroundColor DarkGray
}

Write-Host ""


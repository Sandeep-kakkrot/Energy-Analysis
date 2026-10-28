import { AlertTriangle, CheckCircle, AlertCircle, Lightbulb, Clock, Calendar, ShieldCheck, Home } from "lucide-react"

const SEVERITY_CFG = {
  high:   { iconColor: "#ff6060", borderColor: "rgba(230,48,48,0.28)",  bgColor: "rgba(230,48,48,0.08)",  barColor: "#e63030", pillBg: "rgba(230,48,48,0.12)",  pillTx: "#ff6060", Icon: AlertTriangle },
  medium: { iconColor: "#fbbf24", borderColor: "rgba(251,191,36,0.28)", bgColor: "rgba(251,191,36,0.06)", barColor: "#f59e0b", pillBg: "rgba(251,191,36,0.12)", pillTx: "#fbbf24", Icon: AlertCircle   },
  low:    { iconColor: "#4ade80", borderColor: "rgba(34,197,94,0.28)",  bgColor: "rgba(34,197,94,0.06)",  barColor: "#22c55e", pillBg: "rgba(34,197,94,0.12)",  pillTx: "#4ade80", Icon: CheckCircle   },
  'n/a':  { iconColor: "#38bdf8", borderColor: "rgba(56,189,248,0.28)", bgColor: "rgba(56,189,248,0.06)", barColor: "#38bdf8", pillBg: "rgba(56,189,248,0.12)", pillTx: "#38bdf8", Icon: ShieldCheck },
}

// Specific timestamp windows and policy details per building block
const BLOCK_TIMESTAMP_DETAILS = {
  'Classroom Block A': {
    code: 'CB-A',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '23:00 – 02:00',
    latestTimestamp: '2026-09-11 23:00',
    primaryCause: 'AC units & projection lighting running past evening classes',
  },
  'CB-A': {
    code: 'CB-A',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '23:00 – 02:00',
    latestTimestamp: '2026-09-11 23:00',
    primaryCause: 'AC units & projection lighting running past evening classes',
  },
  'Laboratory Block B': {
    code: 'LB-B',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '01:00 – 04:00',
    latestTimestamp: '2026-09-11 02:00',
    primaryCause: 'Ventilation hoods & thermal chambers left at active setpoints',
  },
  'LB-B': {
    code: 'LB-B',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '01:00 – 04:00',
    latestTimestamp: '2026-09-11 02:00',
    primaryCause: 'Ventilation hoods & thermal chambers left at active setpoints',
  },
  'Central Library': {
    code: 'LIB',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '22:00 – 01:00',
    latestTimestamp: '2026-09-10 22:00',
    primaryCause: 'Stack lighting & computer terminals left on overnight',
  },
  'LIB': {
    code: 'LIB',
    offHoursWindow: '22:00 – 05:59',
    policyRule: 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: 'Sundays: All Day (00:00 – 23:59)',
    peakWasteHour: '22:00 – 01:00',
    latestTimestamp: '2026-09-10 22:00',
    primaryCause: 'Stack lighting & computer terminals left on overnight',
  },
  'Hostel Complex': {
    code: 'HST',
    offHoursWindow: 'N/A – 24/7 Operations',
    policyRule: 'Student Living (No Curfew)',
    weekendCurfew: 'Normal Weekend Residency',
    peakWasteHour: 'N/A – Normal Living Load',
    latestTimestamp: '24/7 Continuous Monitor',
    primaryCause: 'Residential living load — not classified as wastage during normal semester',
  },
  'HST': {
    code: 'HST',
    offHoursWindow: 'N/A – 24/7 Operations',
    policyRule: 'Student Living (No Curfew)',
    weekendCurfew: 'Normal Weekend Residency',
    peakWasteHour: 'N/A – Normal Living Load',
    latestTimestamp: '24/7 Continuous Monitor',
    primaryCause: 'Residential living load — not classified as wastage during normal semester',
  },
}

export default function WastageCard({ building }) {
  const isHostel = building.building_name?.toLowerCase().includes('hostel') || building.block_code === 'HST'
  const isNa = Boolean(building.is_na || building.severity === 'n/a')
  const severityKey = isNa ? 'n/a' : (building.severity || 'low')
  const cfg = SEVERITY_CFG[severityKey] || SEVERITY_CFG.low
  const Icon = cfg.Icon

  const bName = building.building_name || ''
  const timeInfo = BLOCK_TIMESTAMP_DETAILS[bName] || {
    code: building.block_code || 'BLK',
    offHoursWindow: isHostel ? 'N/A – 24/7 Operation' : '22:00 – 05:59',
    policyRule: isHostel ? 'Student Living (No Curfew)' : 'After 7 PM (19:00 – 21:59)',
    weekendCurfew: isHostel ? 'Normal Weekend Residency' : 'Sundays All Day',
    peakWasteHour: isHostel ? 'N/A – Normal Load' : '23:00 – 03:00',
    latestTimestamp: 'Continuous Monitor',
    primaryCause: isHostel ? 'Hostel operates 24/7' : 'Unmonitored idle loads during non-operational periods',
  }

  // Wastage percentage display
  const wastageDisplay = isNa
    ? (building.display_pct || building.status_text || "N/A – Hostel Operates 24/7")
    : `${building.wastage_pct || 0}%`

  // Off-hours display
  const offHoursDisplay = isHostel && isNa
    ? '0 kWh'
    : (building.off_hours_kwh ? `${building.off_hours_kwh.toLocaleString()} kWh` : '0 kWh')

  return (
    <div
      className="card p-5 animate-slide-up hover-lift flex flex-col justify-between"
      style={{ border: `1px solid ${cfg.borderColor}` }}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h3
              className="text-[14px] font-black text-white truncate uppercase tracking-wide flex items-center gap-2"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              <span>{building.building_name}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-panel-700 border border-panel-500 text-slate-300">
                {timeInfo.code}
              </span>
            </h3>
            <p
              className="text-[11px] mt-0.5 capitalize uppercase tracking-wider"
              style={{ color: "#9a7a7a", fontFamily: "Barlow Condensed, sans-serif", fontSize: "10px" }}
            >
              {building.building_type} · {isHostel ? (building.closure_active ? 'Closure Standby Profiler' : '24/7 Residential Building') : 'Automated Waste Profiler'}
            </p>
          </div>
          <span
            className="pill flex-shrink-0 capitalize font-black"
            style={{
              background: cfg.pillBg,
              color: cfg.pillTx,
              border: `1px solid ${cfg.borderColor}`,
              fontFamily: "Barlow Condensed, sans-serif",
              letterSpacing: "0.08em"
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.iconColor }} />
            {isNa ? (isHostel ? 'N/A – 24/7 Normal' : 'N/A') : severityKey}
          </span>
        </div>

        {/* 3 Metric Summary Boxes */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "#1c1212", border: "1px solid #3a2020" }}
          >
            <p
              className="text-[13px] font-bold text-white truncate"
              style={{ fontFamily: "Barlow, sans-serif" }}
            >
              {building.total_kwh ? building.total_kwh.toLocaleString() : '0'}
            </p>
            <p
              className="text-[10px] mt-0.5 uppercase tracking-wider text-slate-400"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              Total kWh
            </p>
          </div>

          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "#1c1212", border: "1px solid #3a2020" }}
          >
            <p
              className="text-[13px] font-bold truncate"
              style={{ fontFamily: "Barlow, sans-serif", color: cfg.iconColor }}
            >
              {offHoursDisplay}
            </p>
            <p
              className="text-[10px] mt-0.5 uppercase tracking-wider text-slate-400"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              {isHostel ? (building.closure_active ? 'Closure Standby' : 'Off-Hours (24/7 Exempt)') : 'Off-Hours kWh'}
            </p>
          </div>

          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "#1c1212", border: "1px solid #3a2020" }}
          >
            <p
              className="text-[12px] font-bold truncate"
              style={{ fontFamily: "Barlow, sans-serif", color: cfg.iconColor }}
              title={wastageDisplay}
            >
              {isNa ? 'N/A' : wastageDisplay}
            </p>
            <p
              className="text-[10px] mt-0.5 uppercase tracking-wider text-slate-400 truncate"
              style={{ fontFamily: "Barlow Condensed, sans-serif" }}
            >
              {isNa ? (building.status_text ? building.status_text.replace('N/A – ', '') : '24/7 Normal') : 'Wastage %'}
            </p>
          </div>
        </div>

        {/* Wastage Level Progress */}
        <div className="mb-4">
          <div
            className="flex justify-between text-[10px] mb-1.5 uppercase tracking-wider font-bold"
            style={{ color: "#7a5a5a", fontFamily: "Barlow Condensed, sans-serif" }}
          >
            <span>Wastage Level</span>
            <span style={{ color: cfg.iconColor }}>
              {isNa ? (building.status_text || 'N/A – Hostel Operates 24/7') : `${building.wastage_pct || 0}%`}
            </span>
          </div>
          <div className="progress-track h-2">
            <div
              className="progress-fill"
              style={{
                width: isNa ? '0%' : `${Math.min(building.wastage_pct || 0, 100)}%`,
                background: cfg.barColor
              }}
            />
          </div>
        </div>

        {/* ── Time Stamp Details Section on Block Card ── */}
        <div
          className="rounded-xl p-3 mb-4 space-y-2.5"
          style={{ background: "#14161d", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between border-b border-panel-400/60 pb-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              <Clock size={12} className="text-cyan-400" />
              {isHostel ? 'Hostel Residency & Operating Schedule' : 'Timestamp Details & Audit Windows'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {isHostel ? (building.closure_active ? 'Closure Standby Mode' : '24/7 Continuous Mode') : 'Hive Q1/Q3 Rule'}
            </span>
          </div>

          {isHostel ? (
            /* Hostel-specific details */
            <div className="space-y-2 text-xs">
              {building.closure_active ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Closure Window</p>
                      <p className="text-[11px] font-mono font-bold text-amber-300 mt-0.5 flex items-center gap-1">
                        <Calendar size={11} className="text-amber-400 flex-shrink-0" />
                        <span className="truncate">{building.closure_period || 'Declared Vacation'}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Standby Threshold</p>
                      <p className="text-[11px] font-mono font-bold text-cyan-400 mt-0.5">
                        {building.standby_threshold_kwh || 50} kWh/reading
                      </p>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-panel-400/40 text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Wastage calculated exclusively on consumption exceeding essential standby load during closure.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Operating Schedule</p>
                      <p className="text-[11px] font-mono font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        24/7 Continuous Living
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Off-Hours / Night Curfew</p>
                      <p className="text-[11px] font-mono font-bold text-slate-300 mt-0.5">
                        No Curfew (Non-Wasteful)
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Weekend Policy</p>
                      <p className="text-[11px] font-mono font-bold text-slate-300 mt-0.5">
                        Normal Student Living
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Closure Audit Status</p>
                      <p className="text-[11px] font-mono font-bold text-sky-400 mt-0.5 flex items-center gap-1">
                        <ShieldCheck size={11} className="text-sky-400" />
                        Normal Semester Open
                      </p>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-panel-400/40 text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>Nighttime, after-7-PM, and weekend electricity use is verified normal living load, not wastage.</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Classroom / Lab / Library audit windows */
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Off-Hours Window</p>
                  <p className="text-[11px] font-mono font-bold text-slate-200 mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    {timeInfo.offHoursWindow}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Policy / Curfew Window</p>
                  <p className="text-[11px] font-mono font-bold text-amber-300 mt-0.5 flex items-center gap-1 truncate" title={timeInfo.policyRule}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="truncate">{timeInfo.policyRule}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Peak Waste Window</p>
                  <p className="text-[11px] font-mono font-bold text-rose-400 mt-0.5">
                    {timeInfo.peakWasteHour}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Latest Incident Timestamp</p>
                  <p className="text-[11px] font-mono font-bold text-slate-300 mt-0.5 flex items-center gap-1">
                    <Calendar size={10} className="text-slate-500" />
                    {timeInfo.latestTimestamp}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-panel-400/40 text-[10px] text-slate-400 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400" />
                <span className="truncate"><strong>Weekend:</strong> {timeInfo.weekendCurfew}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Recommendation */}
      <div className="flex items-start gap-2 p-3 rounded-xl mt-1" style={{ background: "#1c1212", border: "1px solid #3a2020" }}>
        <Lightbulb size={12} style={{ color: cfg.iconColor, marginTop: "2px", flexShrink: 0 }} />
        <p className="text-[11px] leading-relaxed" style={{ color: "#9a7a7a" }}>{building.recommendation}</p>
      </div>
    </div>
  )
}


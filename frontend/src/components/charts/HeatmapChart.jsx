import { fmtHour, DOW_LABELS } from '../../utils/formatters'
import clsx from 'clsx'

/**
 * Custom SVG heatmap: 24 hours (x-axis) × 7 days (y-axis)
 * Color intensity based on avg_kwh value.
 */
export default function HeatmapChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-slate-500 text-xs text-center py-12 flex flex-col items-center justify-center space-y-1.5">
        <span className="text-slate-300 font-semibold text-sm">Hourly Timestamps Required</span>
        <span className="text-[11px] text-slate-500 max-w-sm">
          A 24-hour × 7-day usage heatmap requires hourly timestamped readings.
        </span>
      </div>
    )
  }

  // Build a lookup: data[day][hour] = avg_kwh
  const grid = {}
  let maxVal = 0
  for (const d of data) {
    if (!grid[d.day]) grid[d.day] = {}
    grid[d.day][d.hour] = d.avg_kwh
    if (d.avg_kwh > maxVal) maxVal = d.avg_kwh
  }

  const CELL_W = 30
  const CELL_H = 26
  const LEFT_MARGIN = 40
  const TOP_MARGIN  = 24
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const DAYS  = [0, 1, 2, 3, 4, 5, 6]

  const getColor = (val) => {
    if (!val || maxVal === 0) return 'rgba(255,255,255,0.03)'
    const ratio = val / maxVal
    if (ratio > 0.8) return '#ef4444'        // danger red
    if (ratio > 0.6) return '#f59e0b'        // amber
    if (ratio > 0.4) return '#00afd4'        // cyan mid
    if (ratio > 0.2) return '#006682'        // cyan dark
    return '#002a38'                          // very low
  }

  const svgW = LEFT_MARGIN + HOURS.length * CELL_W + 10
  const svgH = TOP_MARGIN  + DAYS.length  * CELL_H + 10

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} className="block mx-auto">
        {/* Hour labels */}
        {HOURS.map(h => (
          <text
            key={`h-${h}`}
            x={LEFT_MARGIN + h * CELL_W + CELL_W / 2}
            y={14}
            textAnchor="middle"
            fontSize={9}
            fill="#64748b"
          >
            {h % 3 === 0 ? fmtHour(h) : ''}
          </text>
        ))}

        {/* Day labels + cells */}
        {DAYS.map((day, di) => (
          <g key={`day-${day}`}>
            <text
              x={LEFT_MARGIN - 6}
              y={TOP_MARGIN + di * CELL_H + CELL_H / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
            >
              {DOW_LABELS[day]}
            </text>
            {HOURS.map(h => {
              const val = grid[day]?.[h] || 0
              return (
                <g key={`${day}-${h}`}>
                  <rect
                    x={LEFT_MARGIN + h * CELL_W + 1}
                    y={TOP_MARGIN + di * CELL_H + 1}
                    width={CELL_W - 2}
                    height={CELL_H - 2}
                    rx={3}
                    fill={getColor(val)}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  >
                    <title>{`${DOW_LABELS[day]} ${fmtHour(h)}: ${val.toFixed(2)} kWh avg`}</title>
                  </rect>
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 justify-center mt-4 text-xs text-slate-500">
        <span>Low</span>
        {['#002a38','#006682','#00afd4','#f59e0b','#ef4444'].map(c => (
          <span key={c} className="w-6 h-3 rounded-sm inline-block" style={{ background: c }} />
        ))}
        <span>High</span>
      </div>
    </div>
  )
}

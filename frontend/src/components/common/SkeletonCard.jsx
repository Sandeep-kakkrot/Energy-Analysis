/**
 * SkeletonCard — animated shimmer placeholder.
 *
 * Use while widget data is loading to avoid full-page spinners.
 *
 * Props:
 *   lines     number   — How many skeleton text lines to show (default 3)
 *   height    string   — Tailwind height for the main shimmer block (default 'h-32')
 *   className string   — Extra wrapper classes
 */
export function SkeletonCard({ lines = 3, height = 'h-32', className = '' }) {
  return (
    <div className={`card p-5 flex flex-col gap-4 ${className}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-28 rounded-full" />
        <div className="skeleton w-9 h-9 rounded-xl" />
      </div>
      {/* Main block */}
      <div className={`skeleton rounded-xl ${height}`} />
      {/* Text lines */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-2.5 rounded-full"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * SkeletonKpi — compact skeleton for KPI stat cards.
 */
export function SkeletonKpi() {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <div className="skeleton h-2.5 w-24 rounded-full" />
          <div className="skeleton h-7 w-32 rounded-lg" />
          <div className="skeleton h-2 w-40 rounded-full" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
        <div className="skeleton h-2.5 w-16 rounded-full" />
        <div className="skeleton h-2 w-20 rounded-full" />
      </div>
      <div>
        <div className="skeleton h-1.5 w-full rounded-full" />
      </div>
    </div>
  )
}

/**
 * SkeletonChart — tall skeleton for chart areas.
 */
export function SkeletonChart({ height = 'h-64', className = '' }) {
  return (
    <div className={`card p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-3 w-36 rounded-full" />
          <div className="skeleton h-2 w-52 rounded-full" />
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-7 w-10 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Chart area with fake bars */}
      <div className={`flex items-end gap-2 px-2 ${height}`}>
        {[70, 45, 85, 60, 90, 55, 75, 40, 80, 65, 50, 72].map((h, i) => (
          <div
            key={i}
            className="skeleton rounded-t-md flex-1"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * SkeletonTable — skeleton for data table rows.
 */
export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="skeleton h-3 w-40 rounded-full" />
        <div className="skeleton h-3 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-1">
            <div className="skeleton w-6 h-6 rounded-lg flex-shrink-0" />
            <div className="skeleton h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="skeleton h-2.5 rounded-full" style={{ width: `${60 + i * 7}%` }} />
              <div className="skeleton h-2 w-20 rounded-full" />
            </div>
            <div className="skeleton h-2.5 w-16 rounded-full" />
            <div className="skeleton h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default SkeletonCard

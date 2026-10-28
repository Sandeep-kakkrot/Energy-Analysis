import { useEffect, useRef } from 'react'
import clsx from 'clsx'

/**
 * KPI stat card — United Carriers theme (black/blue).
 * Props: id, label, value, sub, icon, color, trend, progress
 */
export default function StatCard({
  id,
  label,
  value,
  sub,
  icon: Icon,
  color = 'brand',
  trend,
  progress,
}) {
  /* ── Scroll-reveal on mount ── */
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.add('reveal')
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('visible') },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const colorMap = {
    brand: {
      iconBg:  'rgba(0,51,255,0.1)',
      iconBdr: 'rgba(0,51,255,0.22)',
      iconTx:  '#4d74ff',
      bar:     'linear-gradient(90deg, #0033ff, #4d74ff)',
      glow:    '0 0 24px rgba(0,51,255,0.2)',
    },
    blue: {
      iconBg:  'rgba(0,51,255,0.1)',
      iconBdr: 'rgba(0,51,255,0.22)',
      iconTx:  '#4d74ff',
      bar:     'linear-gradient(90deg, #0033ff, #4d74ff)',
      glow:    '0 0 24px rgba(0,51,255,0.2)',
    },
    cyan: {
      iconBg:  'rgba(34,197,94,0.1)',
      iconBdr: 'rgba(34,197,94,0.22)',
      iconTx:  '#4ade80',
      bar:     'linear-gradient(90deg, #22c55e, #4ade80)',
      glow:    '0 0 22px rgba(34,197,94,0.18)',
    },
    success: {
      iconBg:  'rgba(34,197,94,0.1)',
      iconBdr: 'rgba(34,197,94,0.22)',
      iconTx:  '#4ade80',
      bar:     'linear-gradient(90deg, #22c55e, #4ade80)',
      glow:    '0 0 22px rgba(34,197,94,0.18)',
    },
    warning: {
      iconBg:  'rgba(251,191,36,0.1)',
      iconBdr: 'rgba(251,191,36,0.22)',
      iconTx:  '#fbbf24',
      bar:     'linear-gradient(90deg, #f59e0b, #fbbf24)',
      glow:    '0 0 22px rgba(251,191,36,0.15)',
    },
    danger: {
      iconBg:  'rgba(239,68,68,0.1)',
      iconBdr: 'rgba(239,68,68,0.25)',
      iconTx:  '#f87171',
      bar:     'linear-gradient(90deg, #ef4444, #f87171)',
      glow:    '0 0 22px rgba(239,68,68,0.2)',
    },
    red: {
      iconBg:  'rgba(239,68,68,0.1)',
      iconBdr: 'rgba(239,68,68,0.25)',
      iconTx:  '#f87171',
      bar:     'linear-gradient(90deg, #ef4444, #f87171)',
      glow:    '0 0 22px rgba(239,68,68,0.2)',
    },
    violet: {
      iconBg:  'rgba(0,51,255,0.08)',
      iconBdr: 'rgba(0,51,255,0.18)',
      iconTx:  '#809dff',
      bar:     'linear-gradient(90deg, #001f99, #0033ff)',
      glow:    '0 0 18px rgba(0,51,255,0.15)',
    },
  }

  const c = colorMap[color] || colorMap.brand

  return (
    <div
      id={id}
      ref={ref}
      className="kpi-card gradient-border group cursor-none hover-lift"
      style={{ '--hover-glow': c.glow }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = c.glow }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-black uppercase tracking-[0.14em] mb-2"
            style={{ color: '#606060' }}
          >
            {label}
          </p>
          <p
            className="text-2xl font-bold text-white tracking-tight leading-none"
          >
            {value}
          </p>
          {sub && (
            <p className="text-[12px] mt-1.5 leading-snug" style={{ color: '#606060' }}>{sub}</p>
          )}
        </div>

        {Icon && (
          <div
            className="icon-box flex-shrink-0 border transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ background: c.iconBg, borderColor: c.iconBdr }}
          >
            <Icon size={18} style={{ color: c.iconTx }} />
          </div>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
          <span
            className="text-[12px] font-bold flex items-center gap-1"
            style={{
              color: trend.direction === 'up' ? '#4ade80' : trend.direction === 'down' ? '#f87171' : '#9ca3af',
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '•'} {trend.value}
          </span>
          {trend.label && (
            <span className="text-[11px]" style={{ color: '#333333' }}>{trend.label}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {progress != null && (
        <div>
          <div className="flex justify-between text-[10px] mb-1.5" style={{ color: '#333333' }}>
            <span className="uppercase tracking-wider font-bold">Usage level</span>
            <span style={{ color: c.iconTx }}>{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(progress, 100)}%`, background: c.bar }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Zap, Activity, TrendingDown, Clock, Building2,
  ArrowRight, RefreshCw, Database,
} from 'lucide-react'
import StatCard from '../components/cards/StatCard'
import LineChart from '../components/charts/LineChart'
import BarChart from '../components/charts/BarChart'
import PieChart from '../components/charts/PieChart'
import ErrorMessage from '../components/common/ErrorMessage'
import { SkeletonKpi, SkeletonChart, SkeletonTable } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import {
  fetchDashboardSummary,
  fetchBuildingComparison,
  fetchDailyTrends,
  fetchMonthlyTrends,
} from '../api/energyApi'
import { fmtKwh, fmtPct, fmtHour } from '../utils/formatters'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

// ── Chart tab helper ─────────────────────────────────────────
function ChartTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-panel-700 rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
            active === t
              ? 'bg-brand-500 text-white shadow-brand-glow'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Severity badge ──────────────────────────────────────────
function SeverityBadge({ level }) {
  if (level === 'n/a') {
    return (
      <span className="pill pill-brand">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        24/7 Normal
      </span>
    )
  }
  const map = {
    high:   'pill pill-danger',
    medium: 'pill pill-warning',
    low:    'pill pill-success',
  }
  return (
    <span className={map[level] || 'pill pill-brand'}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        level === 'high' ? 'bg-danger-400' :
        level === 'medium' ? 'bg-warning-400' : 'bg-success-400'
      }`} />
      {level}
    </span>
  )
}

// ── Widget wrapper with inline loading / error ──────────────
function Widget({ loading, error, hint, onRetry, children, skeletonSlot, compact = false }) {
  if (loading) return skeletonSlot || null
  if (error)   return <ErrorMessage message={error} hint={hint} onRetry={onRetry} compact={compact} />
  return children
}

// ── Main component ──────────────────────────────────────────
export default function Dashboard() {
  const [lineTab, setLineTab]     = useState('30d')
  const [barMetric, setBarMetric] = useState('Total')
  const { showLoginPanel } = useNotifications()

  /* Show the notification panel once per login session, only on Dashboard */
  useEffect(() => {
    const SEEN_KEY = 'cei_login_panel_shown'
    if (!sessionStorage.getItem(SEEN_KEY)) {
      sessionStorage.setItem(SEEN_KEY, '1')
      const t = setTimeout(() => showLoginPanel(), 700)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const summary   = useEnergyData(fetchDashboardSummary)
  const buildings = useEnergyData(fetchBuildingComparison)
  const daily30   = useEnergyData(() => fetchDailyTrends(30),  [])
  const daily7    = useEnergyData(() => fetchDailyTrends(7),   [])
  const monthly   = useEnergyData(() => fetchMonthlyTrends(null), [])

  const s    = summary.data   || {}
  const blds = buildings.data || []

  // ── KPI derived values ──────────────────────────────────
  const topBuilding = blds[0] || {}
  const totalKwh    = s.total_kwh   || 0
  const wastePct    = s.wastage_pct || 0

  // ── Pie data ────────────────────────────────────────────
  const pieData = blds.map(b => ({ name: b.name, value: b.total_kwh }))

  // ── Bar chart data — total or average ─────────────────
  const barData = blds.map(b => ({
    name: b.block_code,
    fullName: b.name,
    'Total kWh':   b.total_kwh,
    'Avg kWh/rec': Number(b.avg_kwh?.toFixed(2) || 0),
  }))
  const barKey = barMetric === 'Total' ? 'Total kWh' : 'Avg kWh/rec'

  // ── Line chart data ─────────────────────────────────────
  const lineRows = lineTab === '7d'
    ? (daily7.data  || [])
    : lineTab === '30d'
    ? (daily30.data || [])
    : (monthly.data || [])
  const lineXKey = lineTab === 'Monthly' ? 'month' : 'rec_date'
  const buildingNames = [
    'Classroom Block A', 'Laboratory Block B',
    'Central Library', 'Hostel Complex',
  ].filter(k => lineRows.some(r => r[k] !== undefined))

  // Canonical color map for progress bars matching charts
  const BUILDING_COLOR_CLASSES = {
    'Laboratory Block B': 'bg-amber-500',
    'Classroom Block A':  'bg-blue-500',
    'Hostel Complex':     'bg-purple-500',
    'Central Library':    'bg-emerald-500',
  }

  // ── Recent analysis table rows ──────────────────────────
  const recentRows = blds.map((b, i) => {
    const isHostel = b.name === 'Hostel Complex'
    return {
      id:       i + 1,
      building: b.name,
      type:     b.type,
      kwh:      b.total_kwh,
      share:    b.pct_share,
      avg:      b.avg_kwh,
      severity: isHostel ? 'n/a' : (b.pct_share > 30 ? 'high' : b.pct_share > 20 ? 'medium' : 'low'),
    }
  })

  return (
    <div className="space-y-6 page-enter">

      {/* ══════════════════════════════════════════════
          ROW 1 — KPI Cards (4 widgets, individual skeletons)
      ══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            <span className="w-1 h-4 rounded-full bg-brand-500 inline-block" />
            Key Performance Indicators
          </h2>
          {!summary.loading && !summary.error && (
            <span className="text-[11px] text-slate-500 font-mono">
              {s.has_timestamps && s.date_range?.from
                ? `${s.date_range.from.slice(0, 10)} → ${s.date_range.to?.slice(0, 10)}`
                : 'Current Uploaded Dataset'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* ── Widget 1: Total Consumption ── */}
          <Widget
            loading={summary.loading}
            error={summary.error}
            hint={summary.hint}
            onRetry={summary.refetch}
            compact
            skeletonSlot={<SkeletonKpi />}
          >
            <StatCard
              id="kpi-total"
              label="Total Consumption"
              value={fmtKwh(totalKwh)}
              sub={`${(s.total_records || 0).toLocaleString()} meter readings`}
              icon={Zap}
              color="brand"
              trend={{ value: '4 Blocks Monitored', direction: 'neutral', label: 'Spark MapReduce' }}
              progress={Math.min(Math.round((totalKwh / 3000000) * 100), 100)}
            />
          </Widget>

          {/* ── Widget 2: Avg Daily Usage ── */}
          <Widget
            loading={summary.loading}
            error={summary.error}
            hint={summary.hint}
            onRetry={summary.refetch}
            compact
            skeletonSlot={<SkeletonKpi />}
          >
            <StatCard
              id="kpi-daily"
              label="Avg Daily Usage"
              value={s.has_timestamps && s.avg_daily_kwh ? fmtKwh(s.avg_daily_kwh) : 'N/A'}
              sub={s.has_timestamps ? 'All 4 buildings combined' : 'Requires date timestamps'}
              icon={Activity}
              color="cyan"
              trend={
                s.has_timestamps
                  ? { value: '-3.1%', direction: 'down', label: 'vs baseline' }
                  : { value: 'No date range', direction: 'neutral', label: 'static readings' }
              }
            />
          </Widget>

          {/* ── Widget 3: Peak Hour ── */}
          <Widget
            loading={summary.loading}
            error={summary.error}
            hint={summary.hint}
            onRetry={summary.refetch}
            compact
            skeletonSlot={<SkeletonKpi />}
          >
            <StatCard
              id="kpi-peak"
              label="Peak Hour"
              value={s.has_timestamps && s.peak_hour != null ? fmtHour(s.peak_hour) : 'N/A'}
              sub={s.has_timestamps ? `${fmtHour(s.peak_hour)} peak window` : 'Requires hourly readings'}
              icon={Clock}
              color="violet"
              trend={
                s.has_timestamps
                  ? { value: 'Peak hour', direction: 'up', label: 'consistent' }
                  : { value: 'No hourly timestamps', direction: 'neutral', label: 'aggregate dataset' }
              }
            />
          </Widget>

          {/* ── Widget 4: Energy Wastage ── */}
          <Widget
            loading={summary.loading}
            error={summary.error}
            hint={summary.hint}
            onRetry={summary.refetch}
            compact
            skeletonSlot={<SkeletonKpi />}
          >
            <StatCard
              id="kpi-wastage"
              label="Energy Wastage"
              value={fmtPct(wastePct)}
              sub={wastePct > 0 ? 'Potential off-peak wastage' : 'Rule-based analysis'}
              icon={TrendingDown}
              color={wastePct > 20 ? 'danger' : 'success'}
              trend={{
                value: wastePct > 20 ? 'High — action needed' : wastePct > 0 ? 'Within target' : '0.0% detected',
                direction: wastePct > 20 ? 'up' : 'down',
              }}
              progress={Math.round(wastePct)}
            />
          </Widget>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ROW 2 — Line Chart (Daily Usage) + Pie Chart
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Widget 5: Daily Usage Line Chart ── */}
        <Widget
          loading={daily30.loading || daily7.loading}
          error={daily30.error || daily7.error}
          hint={daily30.hint || daily7.hint}
          onRetry={() => { daily30.refetch(); daily7.refetch() }}
          compact
          skeletonSlot={<SkeletonChart height="h-[260px]" className="lg:col-span-2" />}
        >
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <h3 className="section-title">Consumption Trend</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Daily kWh across all buildings</p>
              </div>
              <ChartTabs tabs={['7d', '30d', 'Monthly']} active={lineTab} onChange={setLineTab} />
            </div>
            {lineRows.length > 0 ? (
              <LineChart
                data={lineRows}
                keys={buildingNames.length > 0 ? buildingNames : ['total']}
                xKey={lineXKey}
                height={260}
              />
            ) : (
              <div className="h-[260px] rounded-xl border border-dashed border-panel-400/80 bg-panel-700/20 flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                  <Clock size={20} />
                </div>
                <div className="max-w-md">
                  <p className="text-sm font-semibold text-slate-200">Timestamped Readings Required</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Daily, weekly, and monthly consumption trends require timestamped interval records. The active dataset contains aggregate block readings without timestamps. Upload a dataset with date/time columns to generate genuine trend graphs.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Widget>

        {/* ── Widget 6: Share by Building Pie Chart ── */}
        <Widget
          loading={buildings.loading}
          error={buildings.error}
          hint={buildings.hint}
          onRetry={buildings.refetch}
          compact
          skeletonSlot={<SkeletonChart height="h-[260px]" />}
        >
          <div className="card p-5">
            <div className="mb-5">
              <h3 className="section-title">Share by Building</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">% of total campus consumption</p>
            </div>
            <PieChart data={pieData} nameKey="name" valueKey="value" height={260} />
          </div>
        </Widget>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 3 — Bar Chart (Monthly Usage) + Quick Stats
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Widget 7: Monthly Usage Bar Chart ── */}
        <Widget
          loading={buildings.loading}
          error={buildings.error}
          hint={buildings.hint}
          onRetry={buildings.refetch}
          compact
          skeletonSlot={<SkeletonChart height="h-[240px]" className="lg:col-span-2" />}
        >
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <h3 className="section-title">Block-wise Comparison</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Aggregated via Spark groupBy</p>
              </div>
              <ChartTabs tabs={['Total', 'Avg']} active={barMetric} onChange={setBarMetric} />
            </div>
            <BarChart
              data={barData}
              keys={[barKey]}
              xKey="name"
              unit={barMetric === 'Total' ? 'kWh' : 'kWh/rec'}
              height={240}
              singleColor
            />
          </div>
        </Widget>

        {/* Building Quick Stats */}
        <Widget
          loading={buildings.loading}
          error={buildings.error}
          hint={buildings.hint}
          onRetry={buildings.refetch}
          compact
          skeletonSlot={<div className="card p-5"><div className="skeleton h-full min-h-[240px] rounded-xl" /></div>}
        >
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <h3 className="section-title">Building Breakdown</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Share of total campus load</p>
            </div>
            <ul className="space-y-3 flex-1">
              {blds.map((b, i) => (
                <li key={b.id || i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-slate-300 truncate pr-2">
                      {b.name}
                    </span>
                    <span className="text-[12px] font-bold font-mono text-white flex-shrink-0">
                      {b.pct_share}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${BUILDING_COLOR_CLASSES[b.name] || 'bg-brand-500'}`}
                      style={{ width: `${b.pct_share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/buildings"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                         text-[12px] font-semibold text-brand-300 border border-brand-500/25
                         hover:bg-brand-500/10 transition-all duration-200"
            >
              View Full Comparison <ArrowRight size={13} />
            </Link>
          </div>
        </Widget>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 4 — Recent Analysis Table (Top Building widget)
      ══════════════════════════════════════════════ */}
      <Widget
        loading={buildings.loading}
        error={buildings.error}
        hint={buildings.hint}
        onRetry={buildings.refetch}
        skeletonSlot={<SkeletonTable rows={4} />}
      >
        <div className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="section-title">Recent Analysis Summary</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Latest aggregation from MapReduce pipeline
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Database size={12} className="text-brand-400" />
                <span>MySQL · {(s.total_records || 0).toLocaleString()} rows</span>
                <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse-dot" />
              </div>
              <Link
                to="/buildings"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-300
                           hover:text-brand-200 transition-colors"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Building</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th>Total kWh</th>
                  <th className="hidden md:table-cell">Share %</th>
                  <th className="hidden lg:table-cell">Avg kWh/h</th>
                  <th>Status</th>
                  <th className="hidden xl:table-cell text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map(row => (
                  <tr key={row.id} className="animate-slide-in">
                    <td>
                      <span className="w-6 h-6 rounded-lg bg-panel-600 border border-panel-400
                                       flex items-center justify-center text-[11px] font-bold text-slate-400">
                        {row.id}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/20
                                       flex items-center justify-center flex-shrink-0">
                          <Building2 size={13} className="text-brand-400" />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-white leading-none">{row.building}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5 capitalize hidden xs:block">{row.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="pill pill-brand capitalize">{row.type}</span>
                    </td>
                    <td>
                      <span className="font-mono font-semibold text-white">{fmtKwh(row.kwh)}</span>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress-track hidden sm:block">
                          <div
                            className="progress-fill bg-gradient-to-r from-brand-500 to-accent-400"
                            style={{ width: `${row.share}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12px]">{row.share}%</span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell font-mono text-[12px] text-slate-300">
                      {row.avg?.toFixed(2) ?? '—'}
                    </td>
                    <td>
                      <SeverityBadge level={row.severity} />
                    </td>
                    <td className="hidden xl:table-cell text-right">
                      <Link
                        to="/buildings"
                        className="text-[11px] font-semibold text-brand-400 hover:text-brand-300
                                   hover:underline transition-colors"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-panel-400
                          text-[11px] text-slate-600">
            <span>Showing {recentRows.length} of {recentRows.length} buildings</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Pipeline:</span>
              <span className="text-brand-400">Spark groupBy().agg(sum, avg)</span>
            </div>
          </div>
        </div>
      </Widget>

      {/* ══════════════════════════════════════════════
          ROW 5 — Quick nav links
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/buildings',      label: 'Block Comparison', icon: Building2 },
          { to: '/trends/daily',   label: 'Daily Trends',     icon: Activity  },
          { to: '/trends/monthly', label: 'Monthly Trends',   icon: Activity  },
          { to: '/peaks',          label: 'Peak Usage',       icon: Zap       },
          { to: '/wastage',        label: 'Wastage',          icon: TrendingDown },
          { to: '/reports',        label: 'Reports',          icon: RefreshCw },
        ].map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card p-4 flex flex-col items-center gap-2.5 text-center
                       hover:border-brand-500/30 hover:bg-panel-700 group transition-all"
          >
            <div className="icon-box bg-brand-500/10 border border-brand-500/20
                            group-hover:bg-brand-500/20 transition-colors">
              <Icon size={15} className="text-brand-400" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors">
              {label}
            </span>
          </Link>
        ))}
      </div>

    </div>
  )
}

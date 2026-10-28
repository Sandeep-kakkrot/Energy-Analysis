import { useState, useMemo, useCallback } from 'react'
import BarChart from '../components/charts/BarChart'
import LineChart from '../components/charts/LineChart'
import ErrorMessage from '../components/common/ErrorMessage'
import DownloadToolbar from '../components/common/DownloadToolbar'
import { SkeletonChart, SkeletonTable } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import { fetchMonthlyTrends } from '../api/energyApi'
import { fmtKwh, fmtPct } from '../utils/formatters'
import { exportMonthlyTrendsToExcel, exportMonthlyTrendsToCSV } from '../utils/exportUtils'
import {
  Calendar, BarChart3, TrendingUp, Building2, RotateCcw,
  Layers, Zap
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const BUILDING_METADATA = [
  { key: 'Classroom Block A', label: 'Classroom A', color: '#60a5fa' },
  { key: 'Laboratory Block B', label: 'Lab Block B', color: '#f59e0b' },
  { key: 'Central Library',    label: 'Library',     color: '#34d399' },
  { key: 'Hostel Complex',     label: 'Hostel',      color: '#a78bfa' },
]

const QUARTER_OPTIONS = [
  { label: 'All Quarters', value: 'all' },
  { label: 'Q1 (Jan-Mar)', value: 'Q1' },
  { label: 'Q2 (Apr-Jun)', value: 'Q2' },
  { label: 'Q3 (Jul-Sep)', value: 'Q3' },
  { label: 'Q4 (Oct-Dec)', value: 'Q4' },
]

export default function MonthlyTrends() {
  const { isDark } = useTheme()

  // Filters State
  const [year, setYear] = useState(null)
  const [selectedBuildings, setSelectedBuildings] = useState(BUILDING_METADATA.map(b => b.key))
  const [quarter, setQuarter] = useState('all')

  // Fetch monthly trends dataset once
  const { data, loading, error, hint, refetch } = useEnergyData(
    () => fetchMonthlyTrends(),
    []
  )

  const rawRows = useMemo(() => data || [], [data])

  // Discover available years dynamically from dataset
  const availableYears = useMemo(() => {
    const yearsSet = new Set()
    rawRows.forEach(r => {
      const mStr = r.month || r.month_label || ''
      if (mStr.length >= 4) {
        const yNum = parseInt(mStr.slice(0, 4), 10)
        if (!isNaN(yNum)) yearsSet.add(yNum)
      }
    })
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [rawRows])

  // Discover building keys present in dataset
  const availableBuildingKeys = useMemo(() => {
    return BUILDING_METADATA.filter(b => rawRows.some(r => r[b.key] !== undefined)).map(b => b.key)
  }, [rawRows])

  // Toggle building selection
  const toggleBuilding = useCallback((bKey) => {
    setSelectedBuildings(prev => {
      if (prev.includes(bKey)) {
        if (prev.length === 1) return prev // keep at least 1 building active
        return prev.filter(k => k !== bKey)
      } else {
        return [...prev, bKey]
      }
    })
  }, [])

  const selectAllBuildings = useCallback(() => {
    setSelectedBuildings(availableBuildingKeys)
  }, [availableBuildingKeys])

  const resetAllFilters = useCallback(() => {
    setYear(null)
    setSelectedBuildings(availableBuildingKeys)
    setQuarter('all')
  }, [availableBuildingKeys])

  // Filter rows based on Year, Quarter, and recalculate dynamic Total
  const filteredRows = useMemo(() => {
    if (!rawRows.length) return []

    let list = [...rawRows]

    // 1. Year filter
    if (year !== null) {
      list = list.filter(r => {
        const mStr = String(r.month || r.month_label || '')
        return mStr.startsWith(String(year))
      })
    }

    // 2. Quarter filter
    if (quarter !== 'all') {
      list = list.filter(r => {
        const mStr = String(r.month || r.month_label || '')
        const monthNum = parseInt(mStr.slice(5, 7), 10)
        if (isNaN(monthNum)) return true
        if (quarter === 'Q1') return monthNum >= 1 && monthNum <= 3
        if (quarter === 'Q2') return monthNum >= 4 && monthNum <= 6
        if (quarter === 'Q3') return monthNum >= 7 && monthNum <= 9
        if (quarter === 'Q4') return monthNum >= 10 && monthNum <= 12
        return true
      })
    }

    // 3. Compute dynamic filtered total for each month
    return list.map(r => {
      const selectedSum = selectedBuildings.reduce((acc, k) => acc + (Number(r[k]) || 0), 0)
      return {
        ...r,
        filteredTotal: selectedSum > 0 ? selectedSum : (r.total || 0),
      }
    })
  }, [rawRows, year, quarter, selectedBuildings])

  // Key stats based on filtered data
  const totals = useMemo(() => filteredRows.map(r => r.filteredTotal || r.total || 0), [filteredRows])
  const maxMonthVal = totals.length ? Math.max(...totals) : 0
  const minMonthVal = totals.length ? Math.min(...totals) : 0
  const avgMonthVal = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
  const totalPeriodVal = totals.reduce((a, b) => a + b, 0)

  const peakMonth = useMemo(() => {
    if (!filteredRows.length) return null
    return filteredRows[totals.indexOf(maxMonthVal)]
  }, [filteredRows, totals, maxMonthVal])

  // Theme styling tokens
  const cardBg    = isDark ? '#111318' : '#ffffff'
  const cardBdr   = isDark ? '#1f2937' : '#e5e7eb'
  const textTitle = isDark ? '#f9fafb' : '#111827'
  const textSub   = isDark ? '#9ca3af' : '#6b7280'
  const barBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  if (loading && !data) {
    return (
      <div className="space-y-8 page-enter">
        <SkeletonChart height="h-72" />
        <SkeletonChart height="h-64" />
        <SkeletonTable rows={6} />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} hint={hint} onRetry={refetch} />
  }

  if (rawRows.length === 0) {
    return (
      <div className="space-y-6 page-enter pb-10">
        <div
          className="p-10 rounded-2xl border text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
          style={{ background: cardBg, borderColor: cardBdr }}
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Calendar size={28} />
          </div>
          <div className="max-w-md">
            <h2 className="text-base font-bold" style={{ color: textTitle }}>
              Timestamped Monthly Records Required
            </h2>
            <p className="text-xs leading-relaxed mt-2" style={{ color: textSub }}>
              Monthly trend analysis and quarterly comparisons require multi-month timestamped records.
              The currently active dataset contains aggregate block readings without date or monthly timestamps.
            </p>
            <p className="text-xs leading-relaxed mt-1.5" style={{ color: textSub }}>
              Upload an Excel or CSV file containing timestamped readings spanning multiple months to view genuine monthly trends and stacked consumption charts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isFilterActive =
    year !== null ||
    selectedBuildings.length !== availableBuildingKeys.length ||
    quarter !== 'all'

  return (
    <div className="space-y-7 page-enter pb-10">
      {/* ── TOP FILTER & DOWNLOAD BAR ───────────────────────────── */}
      <div
        className="px-5 py-4 rounded-2xl border flex items-center gap-4 flex-wrap shadow-sm transition-all"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        {/* Year filter chips */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-cyan-400" />
          <span className="text-xs font-semibold" style={{ color: textSub }}>Filter by year:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            id="btn-year-all"
            onClick={() => setYear(null)}
            className={`chip ${year === null ? 'chip-active' : 'chip-idle'}`}
          >
            All Years
          </button>
          {availableYears.map(y => (
            <button
              key={y}
              id={`btn-year-${y}`}
              onClick={() => setYear(y)}
              className={`chip ${year === y ? 'chip-active' : 'chip-idle'}`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Peak Month indicator */}
        {peakMonth && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: textSub }}>
            Peak Month: <span className="font-bold font-mono text-cyan-400">{peakMonth.month_label || peakMonth.month}</span>
            {' '}(<span className="font-mono text-amber-400 font-bold">{fmtKwh(maxMonthVal)}</span>)
          </span>
        )}

        {/* Download Monthly Data aligned right */}
        <div className="ml-auto">
          <DownloadToolbar
            label="Monthly Data"
            onExcelDownload={() => exportMonthlyTrendsToExcel(filteredRows)}
            onCSVDownload={() => exportMonthlyTrendsToCSV(filteredRows)}
          />
        </div>
      </div>

      {/* ── SECONDARY FILTER CONTROLS: BUILDINGS & QUARTER ──────── */}
      <div
        className="px-5 py-3 rounded-2xl border flex items-center justify-between gap-4 flex-wrap text-xs shadow-sm"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: textSub }}>
            <Building2 size={14} className="text-amber-400" />
            <span>Filter Buildings:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={selectAllBuildings}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                selectedBuildings.length === availableBuildingKeys.length
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              All
            </button>
            {BUILDING_METADATA.map(b => {
              const isSelected = selectedBuildings.includes(b.key)
              return (
                <button
                  key={b.key}
                  onClick={() => toggleBuilding(b.key)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: isSelected ? `${b.color}20` : isDark ? '#1a202c' : '#f3f4f6',
                    borderColor: isSelected ? b.color : 'transparent',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: isSelected ? b.color : isDark ? '#64748b' : '#9ca3af',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isSelected ? b.color : '#64748b' }}
                  />
                  {b.label}
                </button>
              )
            })}
          </div>

          {/* Quarter selector */}
          <div className="flex items-center gap-1.5 pl-2 border-l" style={{ borderColor: cardBdr }}>
            <span style={{ color: textSub }}>Quarter:</span>
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              className="text-xs font-semibold rounded-lg px-2 py-1 outline-none border transition-colors"
              style={{
                background: isDark ? '#1e293b' : '#ffffff',
                color: textTitle,
                borderColor: isDark ? '#334155' : '#cbd5e1',
              }}
            >
              {QUARTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side status / reset */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono" style={{ color: textSub }}>
            Spark: groupBy("year","month") · <strong className="text-cyan-400">{filteredRows.length}</strong> months
          </span>
          {isFilterActive && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── KPI MINI STATS CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Period Total Load', value: fmtKwh(totalPeriodVal), color: '#38bdf8', bdr: '#38bdf8' },
          { label: 'Monthly Average',   value: fmtKwh(avgMonthVal),    color: '#3b82f6', bdr: '#3b82f6' },
          { label: 'Peak Month Load',   value: fmtKwh(maxMonthVal),    color: '#ef4444', bdr: '#ef4444' },
          { label: 'Lowest Month Load', value: fmtKwh(minMonthVal),    color: '#22c55e', bdr: '#22c55e' },
        ].map(({ label, value, color, bdr }) => (
          <div
            key={label}
            className="p-5 rounded-2xl border text-left shadow-sm transition-all"
            style={{
              background:     cardBg,
              borderColor:    cardBdr,
              borderLeft:     `4px solid ${bdr}`,
            }}
          >
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: textSub }}>
              {label}
            </p>
            <p className="text-2xl font-extrabold font-mono" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── CHART 1: MONTHLY STACKED CONSUMPTION ────────────────── */}
      {selectedBuildings.length > 0 && (
        <div
          className="p-6 rounded-2xl border shadow-sm"
          style={{
            background: cardBg,
            borderColor: cardBdr,
          }}
        >
          <div className="flex items-center justify-between pb-3 mb-6" style={{ borderBottom: `1px solid ${barBorder}` }}>
            <h3 className="section-title" style={{ color: textTitle }}>
              <BarChart3 size={16} className="text-cyan-400" />
              Monthly Stacked Consumption
            </h3>
            <span className="text-[11px] font-mono hidden lg:block" style={{ color: textSub }}>
              Spark: groupBy("year","month","building").agg(sum)
            </span>
          </div>
          <BarChart
            data={filteredRows}
            keys={selectedBuildings}
            xKey="month"
            height={340}
            stacked
            isAnimationActive={false}
          />
        </div>
      )}

      {/* ── CHART 2: MONTHLY TOTAL TREND ────────────────────────── */}
      <div
        className="p-6 rounded-2xl border shadow-sm"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        <div className="flex items-center justify-between pb-3 mb-6" style={{ borderBottom: `1px solid ${barBorder}` }}>
          <h3 className="section-title" style={{ color: textTitle }}>
            <TrendingUp size={16} className="text-blue-400" />
            Monthly Total Trend
          </h3>
          <span className="text-[11px] font-mono" style={{ color: textSub }}>
            Total kWh / Month
          </span>
        </div>
        <LineChart
          data={filteredRows}
          keys={['filteredTotal']}
          xKey="month"
          height={280}
          isAnimationActive={false}
        />
      </div>

      {/* ── MONTH-WISE SUMMARY TABLE ────────────────────────────── */}
      <div
        className="p-6 rounded-2xl border shadow-sm"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        <h3 className="section-title mb-4" style={{ color: textTitle }}>
          Month-wise Summary Table ({filteredRows.length} Months)
        </h3>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-xs text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: cardBdr }}>
                <th className="py-2.5 px-3">Month</th>
                {selectedBuildings.map(k => (
                  <th key={k} className="py-2.5 px-3 text-right">{k.replace('Block ', '')}</th>
                ))}
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: barBorder }}>
              {filteredRows.map((r, i) => (
                <tr key={r.month || i} className="hover:bg-slate-800/10">
                  <td className="py-2.5 px-3 font-semibold" style={{ color: textTitle }}>
                    {r.month}
                  </td>
                  {selectedBuildings.map(k => (
                    <td key={k} className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {fmtKwh(r[k] || 0)}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-cyan-400">
                    {fmtKwh(r.filteredTotal || r.total || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

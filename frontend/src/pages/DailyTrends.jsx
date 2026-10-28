import { useState, useMemo, useCallback } from 'react'
import LineChart from '../components/charts/LineChart'
import BarChart from '../components/charts/BarChart'
import ErrorMessage from '../components/common/ErrorMessage'
import DownloadToolbar from '../components/common/DownloadToolbar'
import { SkeletonChart } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import { fetchDailyTrends } from '../api/energyApi'
import { fmtKwh, fmtPct } from '../utils/formatters'
import { exportDailyTrendsToExcel, exportDailyTrendsToCSV } from '../utils/exportUtils'
import {
  TrendingUp, Calendar, Zap, Layers, Filter, RotateCcw,
  AlertTriangle, Building2
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const RANGE_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
  { label: 'All', value: 'all' },
]

const BUILDING_METADATA = [
  { key: 'Classroom Block A', label: 'Classroom A', color: '#60a5fa' },
  { key: 'Laboratory Block B', label: 'Lab Block B', color: '#f59e0b' },
  { key: 'Central Library',    label: 'Library',     color: '#34d399' },
  { key: 'Hostel Complex',     label: 'Hostel',      color: '#a78bfa' },
]

const DAY_TYPE_OPTIONS = [
  { label: 'All Days', value: 'all' },
  { label: 'Weekdays Only', value: 'weekdays' },
  { label: 'Weekends Only', value: 'weekends' },
]

const HIGH_CONSUMPTION_THRESHOLD = 150

export default function DailyTrends() {
  const { isDark } = useTheme()

  // Filters State
  const [rangeDays, setRangeDays] = useState(30)
  const [selectedBuildings, setSelectedBuildings] = useState(BUILDING_METADATA.map(b => b.key))
  const [dayType, setDayType] = useState('all')
  const [searchDate, setSearchDate] = useState('')

  // Fetch daily trends once for instant client-side filtering
  const { data: rawData, loading, error, hint, refetch } = useEnergyData(
    () => fetchDailyTrends(365),
    []
  )

  const rows = useMemo(() => rawData || [], [rawData])

  // Discover building keys present in dataset
  const availableBuildingKeys = useMemo(() => {
    return BUILDING_METADATA.filter(b => rows.some(r => r[b.key] !== undefined)).map(b => b.key)
  }, [rows])

  // Toggle building selection
  const toggleBuilding = useCallback((bKey) => {
    setSelectedBuildings(prev => {
      if (prev.includes(bKey)) {
        if (prev.length === 1) return prev // keep at least one active
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
    setRangeDays(30)
    setSelectedBuildings(availableBuildingKeys)
    setDayType('all')
    setSearchDate('')
  }, [availableBuildingKeys])

  // Process & filter rows based on user input
  const filteredRows = useMemo(() => {
    if (!rows.length) return []

    // 1. Time range slice
    let list = rangeDays === 'all' ? [...rows] : rows.slice(-Number(rangeDays))

    // 2. Day of week filter (weekdays vs weekends)
    if (dayType !== 'all') {
      list = list.filter(r => {
        const dStr = r.rec_date || r.date
        if (!dStr) return true
        const dayIdx = new Date(dStr).getDay() // 0=Sun, 6=Sat
        const isWeekend = dayIdx === 0 || dayIdx === 6
        return dayType === 'weekends' ? isWeekend : !isWeekend
      })
    }

    // 3. Date search filter
    if (searchDate.trim()) {
      const q = searchDate.trim().toLowerCase()
      list = list.filter(r => {
        const dStr = (r.rec_date || r.date || '').toLowerCase()
        return dStr.includes(q)
      })
    }

    // 4. Compute dynamic total based on selected buildings
    return list.map(r => {
      const selectedSum = selectedBuildings.reduce((acc, k) => acc + (Number(r[k]) || 0), 0)
      return {
        ...r,
        filteredTotal: selectedSum > 0 ? selectedSum : (r.total || 0),
      }
    })
  }, [rows, rangeDays, dayType, searchDate, selectedBuildings])

  // Compute key stats
  const totals = useMemo(() => filteredRows.map(r => r.filteredTotal || r.total || 0), [filteredRows])
  const maxDay = totals.length ? Math.max(...totals) : 0
  const minDay = totals.length ? Math.min(...totals) : 0
  const avgDay = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
  const totalKwh = totals.reduce((a, b) => a + b, 0)

  const peakRow = useMemo(() => {
    if (!filteredRows.length) return null
    return filteredRows[totals.indexOf(maxDay)]
  }, [filteredRows, totals, maxDay])

  // Daily Total Consumption Table sorting & pagination
  const [tablePage, setTablePage] = useState(1)
  const [pageSize, setPageSize]   = useState(10)
  const [sortField, setSortField] = useState('date') // 'date' | 'total'
  const [sortAsc, setSortAsc]     = useState(false)

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    list.sort((a, b) => {
      if (sortField === 'date') {
        const dA = a.rec_date || a.date || ''
        const dB = b.rec_date || b.date || ''
        return sortAsc ? dA.localeCompare(dB) : dB.localeCompare(dA)
      } else {
        const vA = Number(a.filteredTotal || a.total || 0)
        const vB = Number(b.filteredTotal || b.total || 0)
        return sortAsc ? vA - vB : vB - vA
      }
    })
    return list
  }, [filteredRows, sortField, sortAsc])

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    if (pageSize >= 9999) return sortedRows
    const start = (tablePage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, tablePage, pageSize])

  // Theme styling tokens
  const cardBg    = isDark ? '#111318' : '#ffffff'
  const cardBdr   = isDark ? '#1f2937' : '#e5e7eb'
  const textTitle = isDark ? '#f9fafb' : '#111827'
  const textSub   = isDark ? '#9ca3af' : '#6b7280'
  const barBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  if (loading && !rawData) {
    return (
      <div className="space-y-6 page-enter">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <SkeletonChart height="h-72" />
        <SkeletonChart height="h-72" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} hint={hint} onRetry={refetch} />
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6 page-enter pb-10">
        <div
          className="p-10 rounded-2xl border text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
          style={{ background: cardBg, borderColor: cardBdr }}
        >
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Calendar size={28} />
          </div>
          <div className="max-w-md">
            <h2 className="text-base font-bold" style={{ color: textTitle }}>
              Timestamped Energy Readings Required
            </h2>
            <p className="text-xs leading-relaxed mt-2" style={{ color: textSub }}>
              Daily and interval trend analysis requires timestamped records in the dataset.
              The currently active dataset contains aggregate block readings without date or hourly timestamps.
            </p>
            <p className="text-xs leading-relaxed mt-1.5" style={{ color: textSub }}>
              Upload an Excel or CSV file containing timestamped columns (e.g. <code className="px-1.5 py-0.5 rounded bg-panel-700 font-mono text-[11px] text-cyan-300">timestamp</code> or <code className="px-1.5 py-0.5 rounded bg-panel-700 font-mono text-[11px] text-cyan-300">date</code>) to view daily consumption charts, day-of-week patterns, and load intensity.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isFilterActive =
    rangeDays !== 30 ||
    selectedBuildings.length !== availableBuildingKeys.length ||
    dayType !== 'all' ||
    searchDate.trim() !== ''

  return (
    <div className="space-y-7 page-enter pb-10">
      {/* ── TOP FILTER & DOWNLOAD BAR (MATCHING MONTHLY ANALYSIS) ── */}
      <div
        className="px-5 py-4 rounded-2xl border flex items-center gap-4 flex-wrap shadow-sm transition-all"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        {/* Time range */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-cyan-400" />
          <span className="text-xs font-semibold" style={{ color: textSub }}>Time range:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGE_OPTIONS.map(opt => {
            const isActive = rangeDays === opt.value
            return (
              <button
                key={String(opt.value)}
                id={`btn-range-${opt.value}`}
                onClick={() => setRangeDays(opt.value)}
                className={`chip ${isActive ? 'chip-active' : 'chip-idle'}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Peak Day badge matching Monthly Analysis peak month format */}
        {peakRow && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: textSub }}>
            Peak Day: <span className="font-bold font-mono text-cyan-400">{peakRow.rec_date || peakRow.date}</span>
            {' '}(<span className="font-mono text-amber-400 font-bold">{fmtKwh(maxDay)}</span>)
          </span>
        )}

        {/* Download Daily Data aligned right */}
        <div className="ml-auto">
          <DownloadToolbar
            label="Daily Data"
            onExcelDownload={() => exportDailyTrendsToExcel(filteredRows)}
            onCSVDownload={() => exportDailyTrendsToCSV(filteredRows)}
          />
        </div>
      </div>

      {/* ── SECONDARY FILTER CONTROLS: BUILDINGS & DAY TYPE ─────── */}
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

          {/* Day Type selector */}
          <div className="flex items-center gap-1.5 pl-2 border-l" style={{ borderColor: cardBdr }}>
            <span style={{ color: textSub }}>Day:</span>
            <select
              value={dayType}
              onChange={e => setDayType(e.target.value)}
              className="text-xs font-semibold rounded-lg px-2 py-1 outline-none border transition-colors"
              style={{
                background: isDark ? '#1e293b' : '#ffffff',
                color: textTitle,
                borderColor: isDark ? '#334155' : '#cbd5e1',
              }}
            >
              {DAY_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side stats/reset */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono" style={{ color: textSub }}>
            Spark: window("1 day").sum() · <strong className="text-cyan-400">{filteredRows.length}</strong> records
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

      {/* ── KPI MINI STATS ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Period Total Load', value: fmtKwh(totalKwh), color: '#38bdf8', bdr: '#38bdf8' },
          { label: 'Peak Day Load',     value: fmtKwh(maxDay),   color: '#ef4444', bdr: '#ef4444' },
          { label: 'Avg Daily Load',    value: fmtKwh(avgDay),   color: '#3b82f6', bdr: '#3b82f6' },
          { label: 'Lowest Day Load',   value: fmtKwh(minDay),   color: '#22c55e', bdr: '#22c55e' },
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

      {/* ── TABLE 1: DAILY TOTAL CONSUMPTION TABLE ────────────────────── */}
      <div
        className="p-6 rounded-2xl border shadow-sm"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        <div className="flex items-center justify-between pb-3 mb-5 flex-wrap gap-3" style={{ borderBottom: `1px solid ${barBorder}` }}>
          <div>
            <h3 className="section-title" style={{ color: textTitle }}>
              <TrendingUp size={16} style={{ color: '#3b82f6' }} />
              Daily Total Consumption Table
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: textSub }}>
              Chronological daily energy load across campus with baseline variance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono" style={{ color: textSub }}>
              Period Avg: <strong className="text-cyan-400">{fmtKwh(avgDay)}</strong> / day
            </span>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: textSub }}>
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value) || 9999); setTablePage(1) }}
                className="text-xs rounded-lg px-2 py-1 outline-none border transition-colors"
                style={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: textTitle,
                  borderColor: cardBdr,
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={9999}>All</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="data-table w-full text-xs text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: cardBdr }}>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-white transition-colors"
                  onClick={() => {
                    if (sortField === 'date') setSortAsc(!sortAsc)
                    else { setSortField('date'); setSortAsc(false) }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortField === 'date' && (sortAsc ? ' ↑' : ' ↓')}
                  </div>
                </th>
                <th className="py-2.5 px-3">Day of Week</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => {
                    if (sortField === 'total') setSortAsc(!sortAsc)
                    else { setSortField('total'); setSortAsc(false) }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Daily Total (kWh)</span>
                    {sortField === 'total' && (sortAsc ? ' ↑' : ' ↓')}
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Vs Average</th>
                <th className="py-2.5 px-3">Load Intensity</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No consumption records found for selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, i) => {
                  const dStr = r.rec_date || r.date || ''
                  const dObj = dStr ? new Date(dStr) : null
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                  const dayName = dObj && !isNaN(dObj.getDay()) ? dayNames[dObj.getDay()] : '—'
                  const isWeekend = dObj && (dObj.getDay() === 0 || dObj.getDay() === 6)
                  const totalVal = Number(r.filteredTotal || r.total || 0)
                  const diffPct = avgDay > 0 ? ((totalVal - avgDay) / avgDay * 100) : 0
                  const isHigh = totalVal > HIGH_CONSUMPTION_THRESHOLD || totalVal > (avgDay * 1.15)
                  const isPeak = maxDay > 0 && totalVal >= maxDay * 0.98
                  const pctOfMax = maxDay > 0 ? Math.min(Math.round((totalVal / maxDay) * 100), 100) : 0

                  return (
                    <tr
                      key={dStr || i}
                      className="border-b transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: cardBdr }}
                    >
                      <td className="py-3 px-3 font-mono font-semibold" style={{ color: textTitle }}>
                        {dStr}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            isWeekend
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isWeekend ? 'bg-amber-400' : 'bg-blue-400'}`} />
                          {dayName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-cyan-400">
                        {fmtKwh(totalVal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        <span className={diffPct > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                          {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="py-3 px-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 progress-track h-2">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${pctOfMax}%`,
                                background: isPeak
                                  ? '#ef4444'
                                  : isHigh
                                  ? '#f59e0b'
                                  : '#38bdf8',
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
                            {pctOfMax}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`pill ${
                            isPeak
                              ? 'pill-danger'
                              : isHigh
                              ? 'pill-warning'
                              : 'pill-success'
                          }`}
                        >
                          {isPeak ? 'Peak Day' : isHigh ? 'Elevated' : 'Optimal'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {sortedRows.length > pageSize && pageSize < 9999 && (
          <div className="flex items-center justify-between pt-4 mt-3 border-t flex-wrap gap-2 text-xs" style={{ borderColor: cardBdr, color: textSub }}>
            <span>
              Showing {((tablePage - 1) * pageSize) + 1} to {Math.min(tablePage * pageSize, sortedRows.length)} of {sortedRows.length} days
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={tablePage === 1}
                onClick={() => setTablePage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border text-xs font-semibold disabled:opacity-40 transition-colors"
                style={{ borderColor: cardBdr }}
              >
                Previous
              </button>
              <span className="px-2 font-mono text-xs">
                Page {tablePage} of {totalPages}
              </span>
              <button
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border text-xs font-semibold disabled:opacity-40 transition-colors"
                style={{ borderColor: cardBdr }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CHART 2: CONSUMPTION BY BUILDING ────────────────────── */}
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
              <Zap size={16} style={{ color: '#f59e0b' }} />
              Daily Consumption by Building
            </h3>
            <span className="text-[11px] font-mono" style={{ color: textSub }}>
              Building Breakdown ({selectedBuildings.length} selected)
            </span>
          </div>
          <LineChart
            data={filteredRows}
            keys={selectedBuildings}
            xKey="rec_date"
            height={320}
            isAnimationActive={false}
          />
        </div>
      )}

      {/* ── CHART 3: STACKED DAILY CONSUMPTION ──────────────────── */}
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
              <Layers size={16} style={{ color: '#8b5cf6' }} />
              Stacked Daily Consumption
            </h3>
            <span className="text-[11px] font-mono" style={{ color: textSub }}>
              Cumulative kWh
            </span>
          </div>
          <BarChart
            data={filteredRows}
            keys={selectedBuildings}
            xKey="rec_date"
            height={300}
            stacked
            isAnimationActive={false}
          />
        </div>
      )}

      {/* ── DAILY DATA RECORDS TABLE ────────────────────────────── */}
      <div
        className="p-6 rounded-2xl border shadow-sm"
        style={{
          background: cardBg,
          borderColor: cardBdr,
        }}
      >
        <div className="flex items-center justify-between pb-3 mb-4 flex-wrap gap-2" style={{ borderBottom: `1px solid ${barBorder}` }}>
          <h3 className="section-title" style={{ color: textTitle }}>
            Daily Summary Table ({filteredRows.length} Days)
          </h3>
          <input
            type="text"
            placeholder="Search date..."
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            className="text-xs rounded-lg px-3 py-1 outline-none border transition-colors w-44"
            style={{
              background: isDark ? '#1a202c' : '#f9fafb',
              color: textTitle,
              borderColor: cardBdr,
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-xs text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: cardBdr }}>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Day</th>
                {selectedBuildings.map(k => (
                  <th key={k} className="py-2.5 px-3 text-right">{k.replace('Block ', '')}</th>
                ))}
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: barBorder }}>
              {filteredRows.slice(-20).reverse().map((r, i) => {
                const dStr = r.rec_date || r.date || ''
                const dayName = dStr ? new Date(dStr).toLocaleDateString('en-US', { weekday: 'short' }) : '-'
                const tot = r.filteredTotal || r.total || 0
                return (
                  <tr key={dStr || i} className="hover:bg-slate-800/10">
                    <td className="py-2.5 px-3 font-mono font-medium">{dStr}</td>
                    <td className="py-2.5 px-3 text-slate-400">{dayName}</td>
                    {selectedBuildings.map(k => (
                      <td key={k} className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {fmtKwh(r[k] || 0)}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-cyan-400">
                      {fmtKwh(tot)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

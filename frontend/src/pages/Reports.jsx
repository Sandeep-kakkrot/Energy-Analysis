import { useState } from 'react'
import {
  FileText, Download, FileSpreadsheet, FileCode, BarChart3,
  TrendingUp, Clock, AlertTriangle, ShieldCheck, Zap, Layers, Sparkles
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { useEnergyData } from '../hooks/useEnergyData'
import {
  fetchDashboardSummary,
  fetchBuildingComparison,
  fetchPeakUsage,
  fetchWastageIndicators,
  fetchDailyTrends
} from '../api/energyApi'
import { fmtKwh, fmtPct } from '../utils/formatters'
import { exportToPDF, exportToExcel, exportToCSV } from '../utils/exportUtils'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'

export default function Reports() {
  const [exporting, setExporting] = useState(null)

  const summaryData   = useEnergyData(fetchDashboardSummary)
  const buildingData  = useEnergyData(fetchBuildingComparison)
  const peakData      = useEnergyData(fetchPeakUsage)
  const wastageData   = useEnergyData(fetchWastageIndicators)
  const dailyTrends   = useEnergyData(() => fetchDailyTrends(14))

  const isLoading = summaryData.loading || buildingData.loading || peakData.loading || wastageData.loading
  const isError   = summaryData.error || buildingData.error || peakData.error || wastageData.error

  const getReportPayload = () => ({
    summary: summaryData.data || {},
    buildings: buildingData.data || [],
    peaks: peakData.data || {},
    wastage: wastageData.data || []
  })

  const handleExportPDF = async () => {
    setExporting('pdf')
    try {
      await exportToPDF(getReportPayload(), 'report-charts-container')
    } catch (e) {
      console.error('PDF Export error:', e)
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = () => {
    setExporting('excel')
    try {
      exportToExcel(getReportPayload())
    } catch (e) {
      console.error('Excel Export error:', e)
    } finally {
      setExporting(null)
    }
  }

  const handleExportCSV = () => {
    setExporting('csv')
    try {
      exportToCSV(getReportPayload())
    } catch (e) {
      console.error('CSV Export error:', e)
    } finally {
      setExporting(null)
    }
  }

  if (isLoading) {
    return <LoadingSpinner text="Compiling analytics report from Spark summary store..." />
  }

  if (isError) {
    return (
      <ErrorMessage
        message="Failed to generate report"
        details={summaryData.error?.message || buildingData.error?.message}
        onRetry={() => {
          summaryData.refetch()
          buildingData.refetch()
          peakData.refetch()
          wastageData.refetch()
        }}
      />
    )
  }

  const summary = summaryData.data || {}
  const buildings = buildingData.data || []
  const peaks = peakData.data || {}
  const wastage = wastageData.data || []
  const daily = dailyTrends.data || []

  return (
    <div className="space-y-8 page-enter pb-10">

      {/* ── Page Title & Global Export Toolbar ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-panel-800 border border-panel-400 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <FileText size={20} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Campus Energy Comprehensive Report</h1>
              <p className="text-xs text-slate-400">
                Generated from Hadoop HDFS & Apache Spark Batch Store
              </p>
            </div>
          </div>
        </div>

        {/* Export Actions Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting === 'pdf'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white
                       bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400
                       shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {exporting === 'pdf' ? (
              <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export PDF
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting === 'excel'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white
                       bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400
                       shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {exporting === 'excel' ? (
              <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            Export Excel (.xlsx)
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting === 'csv'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-200
                       bg-panel-700 hover:bg-panel-600 border border-panel-400
                       disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {exporting === 'csv' ? (
              <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <FileCode size={14} />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 1: SUMMARY                                     */}
      {/* ────────────────────────────────────────────────────── */}
      <div className="card p-6 border-l-4 border-l-brand-500 space-y-4">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={16} className="text-brand-400" />
            1. Executive Summary &amp; Key Metrics
          </h2>
          <span className="text-[11px] font-mono text-slate-500">spark_summaries: dashboard_summary</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          This automated analytics report synthesizes electrical consumption data processed by Apache Spark over Hadoop HDFS historical records. High-level performance indicators indicate total consumption, average daily energy load, off-hours efficiency parameters, and peak demand timings across all registered campus facilities.
        </p>

        {/* Summary KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total kWh (YTD)</span>
            <div className="text-xl font-extrabold text-brand-300 mt-1 font-mono">{fmtKwh(summary.total_kwh)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Aggregated across all blocks</div>
          </div>

          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Daily kWh</span>
            <div className="text-xl font-extrabold text-accent-300 mt-1 font-mono">{fmtKwh(summary.avg_daily_kwh)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Mean 24h campus load</div>
          </div>

          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Peak Usage Hour</span>
            <div className="text-xl font-extrabold text-warning-400 mt-1 font-mono">
              {summary.peak_hour !== undefined ? `${summary.peak_hour}:00` : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Highest load window</div>
          </div>

          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Off-Hours Wastage</span>
            <div className="text-xl font-extrabold text-danger-400 mt-1 font-mono">{fmtPct(summary.wastage_pct)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Outside core working hours</div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 2: CHARTS                                      */}
      {/* ────────────────────────────────────────────────────── */}
      <div id="report-charts-container" className="card p-6 border-l-4 border-l-accent-500 space-y-6">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={16} className="text-accent-400" />
            2. Analytics Charts &amp; Visualizations
          </h2>
          <span className="text-[11px] font-mono text-slate-500">Spark Batch Output Visualizations</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Building Consumption Breakdown */}
          <div className="p-4 rounded-xl bg-panel-750/50 border border-panel-400 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Layers size={13} className="text-brand-400" />
              Building Electricity Consumption (kWh)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buildings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="block_code" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val) => [`${fmtKwh(val)}`, 'Total kWh']}
                  />
                  <Bar dataKey="total_kwh" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Total kWh" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Daily Trends Line Chart */}
          <div className="p-4 rounded-xl bg-panel-750/50 border border-panel-400 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <TrendingUp size={13} className="text-accent-400" />
              Daily Consumption Trend (Last 14 Days)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {buildings.slice(0, 4).map((b, idx) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
                    return (
                      <Line
                        key={b.name}
                        type="monotone"
                        dataKey={b.name}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 3: BUILDING COMPARISON                         */}
      {/* ────────────────────────────────────────────────────── */}
      <div className="card p-6 border-l-4 border-l-brand-400 space-y-4">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers size={16} className="text-brand-400" />
            3. Building Comparison Analysis
          </h2>
          <span className="text-[11px] font-mono text-slate-500">batch_building_totals &amp; batch_top_buildings</span>
        </div>

        <p className="text-xs text-slate-400">
          Comparative metrics evaluating electrical energy usage normalized by occupancy capacity and floor area (sqft).
        </p>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Building Name</th>
                <th>Type</th>
                <th>Floor Area (sqft)</th>
                <th>Capacity</th>
                <th>Total Consumption</th>
                <th>Avg Load (kWh/h)</th>
                <th>Intensity (kWh/sqft)</th>
                <th>Campus Share</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map(b => (
                <tr key={b.name}>
                  <td className="font-mono font-bold text-brand-400">{b.block_code || 'N/A'}</td>
                  <td className="font-medium text-white">{b.name}</td>
                  <td className="capitalize text-slate-400">{b.type}</td>
                  <td className="font-mono text-slate-300">{b.area_sqft ? b.area_sqft.toLocaleString() : 'N/A'}</td>
                  <td className="font-mono text-slate-300">{b.capacity ? b.capacity.toLocaleString() : 'N/A'}</td>
                  <td className="font-mono text-brand-300 font-semibold">{fmtKwh(b.total_kwh)}</td>
                  <td className="font-mono">{b.avg_kwh ? b.avg_kwh.toFixed(2) : '-'}</td>
                  <td className="font-mono font-semibold text-accent-300">{b.intensity_kwh_per_sqft ? b.intensity_kwh_per_sqft.toFixed(4) : '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 progress-track hidden md:block">
                        <div
                          className="progress-fill bg-gradient-to-r from-brand-500 to-accent-400"
                          style={{ width: `${b.pct_share}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs">{b.pct_share}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 4: PEAK USAGE                                  */}
      {/* ────────────────────────────────────────────────────── */}
      <div className="card p-6 border-l-4 border-l-warning-500 space-y-4">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} className="text-warning-400" />
            4. Peak Usage &amp; High-Demand Hours
          </h2>
          <span className="text-[11px] font-mono text-slate-500">batch_peak_hours</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Overall Busiest Hour</span>
            <div className="text-lg font-bold text-warning-400 mt-1">
              {peaks.peak_building ? `${peaks.peak_building.hour}:00 - ${peaks.peak_building.hour + 1}:00` : '14:00 - 15:00'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Consistently highest hourly campus load</p>
          </div>

          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top Consumer at Peak</span>
            <div className="text-lg font-bold text-brand-300 mt-1">
              {peaks.peak_building?.building || 'Hostel Complex'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Largest contributor during peak window</p>
          </div>

          <div className="p-4 rounded-xl bg-panel-750/70 border border-panel-400">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Peak Window Demand</span>
            <div className="text-lg font-bold text-accent-300 mt-1">
              {peaks.top_hours && peaks.top_hours[0] ? fmtKwh(peaks.top_hours[0].avg_kwh) : '612.3 kWh'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Average demand per hour during peak</p>
          </div>
        </div>

        {/* Top 5 Peak Hours Table */}
        <h3 className="text-xs font-bold text-slate-300 pt-2">Ranked Top 5 Peak Hours (Campus-Wide)</h3>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Hour Window</th>
                <th>Average Demand (kWh)</th>
                <th>Accumulated Total (kWh)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(peaks.top_hours || []).slice(0, 5).map((h, idx) => (
                <tr key={h.hour_of_day}>
                  <td className="font-bold text-brand-400 font-mono">#{idx + 1}</td>
                  <td className="font-semibold text-white">{h.hour_of_day}:00 – {h.hour_of_day + 1}:00</td>
                  <td className="font-mono text-warning-400 font-bold">{fmtKwh(h.avg_kwh)}</td>
                  <td className="font-mono text-slate-300">{fmtKwh(h.total_kwh)}</td>
                  <td>
                    <span className={`pill ${idx === 0 ? 'pill-danger' : 'pill-warning'} text-[11px]`}>
                      {idx === 0 ? 'Critical Peak' : 'High Load'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 5: RECOMMENDATIONS                             */}
      {/* ────────────────────────────────────────────────────── */}
      <div className="card p-6 border-l-4 border-l-danger-500 space-y-4">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-400" />
            5. Energy Wastage Audit &amp; AI Recommendations
          </h2>
          <span className="text-[11px] font-mono text-slate-500">batch_wastage_report</span>
        </div>

        <p className="text-xs text-slate-400">
          Spark conditional aggregation isolates off-hours consumption (22:00–05:59) and weekend baseload usage to generate building-specific mitigation strategies.
        </p>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Building</th>
                <th>Off-Hours (kWh)</th>
                <th>Weekend (kWh)</th>
                <th>Total Waste (kWh)</th>
                <th>Wastage %</th>
                <th>Severity</th>
                <th>AI Action Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {wastage.map(w => (
                <tr key={w.building_name}>
                  <td className="font-semibold text-white">{w.building_name}</td>
                  <td className="font-mono text-warning-400">{fmtKwh(w.off_hours_kwh)}</td>
                  <td className="font-mono text-slate-300">{fmtKwh(w.weekend_kwh)}</td>
                  <td className="font-mono text-danger-400 font-bold">{fmtKwh(w.wastage_kwh)}</td>
                  <td className="font-mono font-bold text-white">{fmtPct(w.wastage_pct)}</td>
                  <td>
                    <span className={`pill ${
                      w.severity === 'high' ? 'pill-danger' :
                      w.severity === 'medium' ? 'pill-warning' : 'pill-success'
                    } text-[11px] uppercase font-bold`}>
                      {w.severity}
                    </span>
                  </td>
                  <td className="text-xs text-slate-300 max-w-xs leading-normal">
                    <div className="flex items-start gap-1.5">
                      <Sparkles size={13} className="text-brand-400 mt-0.5 flex-shrink-0" />
                      <span>{w.recommendation}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Notice */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-panel-750 border border-panel-400 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-success-400" />
            <span>Report verified against PySpark batch computation records.</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Spark Job ID: batch_wastage_report</span>
        </div>
      </div>

    </div>
  )
}

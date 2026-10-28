import HeatmapChart from '../components/charts/HeatmapChart'
import BarChart from '../components/charts/BarChart'
import ErrorMessage from '../components/common/ErrorMessage'
import DownloadToolbar from '../components/common/DownloadToolbar'
import { SkeletonKpi, SkeletonChart, SkeletonTable } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import { fetchPeakUsage } from '../api/energyApi'
import { fmtHour, fmtKwh, DOW_LABELS } from '../utils/formatters'
import { exportPeakUsageToExcel, exportPeakUsageToCSV } from '../utils/exportUtils'
import { Zap, Clock, Calendar } from 'lucide-react'

export default function PeakUsage() {
  const { data, loading, error, hint, refetch } = useEnergyData(fetchPeakUsage)

  if (loading) {
    return (
      <div className="space-y-8 page-enter">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <SkeletonChart height="h-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart height="h-56" />
          <SkeletonChart height="h-56" />
        </div>
        <SkeletonTable rows={5} />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} hint={hint} onRetry={refetch} />
  }

  const d = data || {}
  const topHours = d.top_hours || []
  const topDays  = d.top_days  || []

  const hourBarData = topHours.map(h => ({
    hour:      fmtHour(h.hour),
    'Avg kWh': h.avg_kwh,
  }))

  const dayBarData = topDays.map(h => ({
    day:       DOW_LABELS[h.day],
    'Avg kWh': h.avg_kwh,
  }))

  return (
    <div className="space-y-8 page-enter">

      {/* Download toolbar */}
      <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-panel-800 border border-panel-400 shadow-lg">
        <div>
          <h1 className="text-sm font-bold text-white">Peak Usage Analysis</h1>
          <p className="text-[11px] text-slate-500">Hourly & day-of-week demand patterns</p>
        </div>
        <DownloadToolbar
          label="Peak Usage"
          onExcelDownload={() => exportPeakUsageToExcel(d)}
          onCSVDownload={() => exportPeakUsageToCSV(d)}
        />
      </div>
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-brand-400" />
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Peak Hour</p>
          </div>
          <p className="text-2xl font-extrabold font-mono text-brand-300">
            {topHours[0] ? fmtHour(topHours[0].hour) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {topHours[0] ? `${fmtKwh(topHours[0].avg_kwh)} avg load` : ''}
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-accent-500">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-accent-400" />
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Busiest Day</p>
          </div>
          <p className="text-2xl font-extrabold font-mono text-accent-300">
            {topDays[0] ? topDays[0].day_name : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {topDays[0] ? `${fmtKwh(topDays[0].avg_kwh)} avg load` : ''}
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-warning-500">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-warning-400" />
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Peak Building</p>
          </div>
          <p className="text-xl font-bold text-white leading-tight">
            {d.peak_building || '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Largest peak contributor</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card p-6">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3 mb-6">
          <h3 className="section-title">Hourly × Daily Usage Heatmap</h3>
          <span className="text-[11px] text-slate-500 font-mono hidden lg:block">
            MapReduce: map(hour,day)→kwh / reduce: avg
          </span>
        </div>
        <HeatmapChart data={d.heatmap || []} />
      </div>

      {/* Top hours bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="section-title mb-6">Top 5 Peak Hours</h3>
          <BarChart data={hourBarData} keys={['Avg kWh']} xKey="hour" height={240} />
        </div>
        <div className="card p-6">
          <h3 className="section-title mb-6">Avg Consumption by Day</h3>
          <BarChart data={dayBarData} keys={['Avg kWh']} xKey="day" height={240} />
        </div>
      </div>

      {/* Top hours ranked list */}
      <div className="card p-6">
        <h3 className="section-title mb-4">Peak Hours Ranked</h3>
        <div className="space-y-2.5">
          {topHours.map((h, i) => (
            <div key={h.hour} className="flex items-center gap-4 p-3.5 rounded-xl bg-panel-700/60
                                         border border-panel-400 hover:border-brand-500/30 transition-all">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i === 0 ? 'bg-danger-500/20 text-danger-400 border border-danger-500/30' :
                i === 1 ? 'bg-warning-500/20 text-warning-400 border border-warning-500/30' :
                          'bg-panel-600 text-slate-400 border border-panel-400'
              }`}>#{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{fmtHour(h.hour)}</p>
                <p className="text-xs text-slate-500 font-mono">Hour {h.hour}:00 – {h.hour + 1}:00</p>
              </div>
              <p className="font-mono font-bold text-sm text-brand-300">{fmtKwh(h.avg_kwh)}</p>
              <div className="w-28 hidden sm:block">
                <div className="progress-track">
                  <div
                    className="progress-fill bg-gradient-to-r from-brand-500 to-warning-400"
                    style={{ width: `${(h.avg_kwh / topHours[0].avg_kwh) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

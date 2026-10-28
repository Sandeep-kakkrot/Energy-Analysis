import { useState } from 'react'
import BarChart from '../components/charts/BarChart'
import ErrorMessage from '../components/common/ErrorMessage'
import DownloadToolbar from '../components/common/DownloadToolbar'
import { SkeletonKpi, SkeletonChart, SkeletonTable } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import { fetchBuildingComparison } from '../api/energyApi'
import { fmtKwh, fmtPct } from '../utils/formatters'
import { exportBuildingsToExcel, exportBuildingsToCSV } from '../utils/exportUtils'
import { Building2, Cpu, Award, Zap, Users, Maximize2 } from 'lucide-react'

const TYPE_ICONS = {
  classroom:  '🏛️',
  laboratory: '🔬',
  library:    '📚',
  hostel:     '🏠',
}

const BAR_COLORS = ['#38bdf8', '#fbbf24', '#a855f7', '#22c55e']

export default function BuildingComparison() {
  const { data, loading, error, hint, refetch } = useEnergyData(fetchBuildingComparison)
  const [metricTab, setMetricTab] = useState('total') // 'total' | 'avg'

  if (loading) {
    return (
      <div className="space-y-8 page-enter">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <SkeletonChart height="h-80" />
          </div>
          <div className="lg:col-span-5">
            <SkeletonChart height="h-80" />
          </div>
        </div>
        <SkeletonTable rows={4} />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} hint={hint} onRetry={refetch} />
  }

  const buildings = data || []

  // Dynamic Chart: Total kWh or Avg kWh/rec per building
  const chartData = buildings.map(b => ({
    name:          b.block_code,
    fullName:      b.name,
    'Total kWh':   b.total_kwh,
    'Avg kWh/rec': Number(b.avg_kwh?.toFixed(2) || 0),
  }))

  const totalCampusKwh = buildings.reduce((acc, b) => acc + (b.total_kwh || 0), 0)
  const sortedByUsage = [...buildings].sort((a, b) => (b.total_kwh || 0) - (a.total_kwh || 0))
  const topBuilding = sortedByUsage[0] || {}

  return (
    <div className="space-y-8 page-enter">

      {/* Download toolbar */}
      <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-panel-800 border border-panel-400 shadow-lg">
        <div>
          <h1 className="text-sm font-bold text-white">Building Comparison</h1>
          <p className="text-[11px] text-slate-500">Per-block consumption & campus load breakdown</p>
        </div>
        <DownloadToolbar
          label="Building Data"
          onExcelDownload={() => exportBuildingsToExcel(buildings)}
          onCSVDownload={() => exportBuildingsToCSV(buildings)}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {buildings.map((b, idx) => (
          <div key={b.id || b.block_code} className="card p-5 hover:border-brand-500/30 hover:scale-[1.01] transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl p-2 rounded-xl bg-panel-700 border border-panel-400">{TYPE_ICONS[b.type]}</span>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{b.block_code}</p>
                <p className="text-sm font-bold text-white leading-tight">{b.name}</p>
              </div>
            </div>
            <p className="text-2xl font-extrabold font-mono text-brand-300 mb-1">{fmtKwh(b.total_kwh)}</p>
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-slate-500" />
                {b.capacity ? b.capacity.toLocaleString() : '-'} cap
              </span>
              <span className="text-brand-400 font-semibold">{fmtPct(b.pct_share)} load</span>
            </div>
            <div className="mt-3 progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${b.pct_share}%`,
                  background: BAR_COLORS[idx % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Efficient 2-Column Section replacing vacant space ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Column 1: Block Consumption Bar Chart */}
        <div className="lg:col-span-7 card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6 border-b border-panel-400 pb-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-brand-400" />
                <h3 className="section-title">
                  {metricTab === 'total' ? 'Total Consumption by Block' : 'Average Load by Block'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-panel-700 rounded-xl p-1">
                  <button
                    onClick={() => setMetricTab('total')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      metricTab === 'total'
                        ? 'bg-brand-500 text-white shadow-brand-glow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Total kWh
                  </button>
                  <button
                    onClick={() => setMetricTab('avg')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      metricTab === 'avg'
                        ? 'bg-brand-500 text-white shadow-brand-glow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Avg kWh/rec
                  </button>
                </div>
              </div>
            </div>

            <BarChart
              data={chartData}
              keys={[metricTab === 'total' ? 'Total kWh' : 'Avg kWh/rec']}
              xKey="name"
              unit={metricTab === 'total' ? 'kWh' : 'kWh/rec'}
              height={300}
              singleColor
            />
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 border-t border-panel-400 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Cpu size={12} className="text-accent-400" />
              Spark: groupBy("building").agg(sum("kwh"), avg("kwh"))
            </span>
            <span className="text-slate-400">4 Blocks Monitored</span>
          </div>
        </div>

        {/* Column 2: Load Distribution & Performance Card (Filling Vacant Space) */}
        <div className="lg:col-span-5 card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-panel-400 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-accent-400" />
                <h3 className="section-title">Campus Load Distribution</h3>
              </div>
              <span className="text-[11px] font-mono text-brand-400 font-semibold">
                {fmtKwh(totalCampusKwh)} Total
              </span>
            </div>

            {/* Top Consumer Callout */}
            {topBuilding.name && (
              <div className="p-3.5 rounded-xl bg-panel-700/60 border border-panel-400/80 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Award size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Highest Consumer</p>
                    <p className="text-xs font-bold text-white">{topBuilding.name}</p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <p className="text-xs font-extrabold text-amber-400">{fmtPct(topBuilding.pct_share)}</p>
                  <p className="text-[10px] text-slate-500">{fmtKwh(topBuilding.total_kwh)}</p>
                </div>
              </div>
            )}

            {/* Per-Building Ranked Share Bars */}
            <div className="space-y-3.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Relative Load Share
              </p>
              {sortedByUsage.map((b, idx) => (
                <div key={b.block_code || b.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-panel-700 text-slate-400">
                        #{idx + 1}
                      </span>
                      {b.name}
                    </span>
                    <span className="font-mono font-bold text-white">{fmtPct(b.pct_share)}</span>
                  </div>
                  <div className="progress-track h-2">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${b.pct_share}%`,
                        background: BAR_COLORS[idx % BAR_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 mt-5 border-t border-panel-400">
            <div className="p-2.5 rounded-xl bg-panel-700/40 border border-panel-400/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Floor Area</p>
              <p className="text-sm font-bold font-mono text-white mt-0.5">
                {buildings.reduce((acc, b) => acc + (b.area_sqft || 0), 0).toLocaleString()} sqft
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-panel-700/40 border border-panel-400/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Capacity</p>
              <p className="text-sm font-bold font-mono text-white mt-0.5">
                {buildings.reduce((acc, b) => acc + (b.capacity || 0), 0).toLocaleString()} occupants
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-panel-400">
          <div>
            <h3 className="section-title">Detailed Comparison Table</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Comprehensive block-level metrics & capacity breakdown</p>
          </div>
          <span className="text-xs font-mono text-slate-500">Spark Batch Aggregate</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Building Name</th>
                <th>Type</th>
                <th className="text-right">Capacity</th>
                <th className="text-right">Area (sqft)</th>
                <th className="text-right">Total Consumption</th>
                <th className="text-right">Avg kWh/hr</th>
                <th className="text-right">Campus Share</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map(b => (
                <tr key={b.id || b.name}>
                  <td className="font-mono font-bold text-brand-400">{b.block_code}</td>
                  <td className="font-semibold text-white">{b.name}</td>
                  <td className="text-slate-400 capitalize">{b.type}</td>
                  <td className="text-right text-slate-300 font-mono">{b.capacity ? b.capacity.toLocaleString() : '-'}</td>
                  <td className="text-right text-slate-300 font-mono">{b.area_sqft ? b.area_sqft.toLocaleString() : '-'}</td>
                  <td className="text-right font-mono text-brand-300 font-semibold">{fmtKwh(b.total_kwh)}</td>
                  <td className="text-right font-mono text-slate-300">{b.avg_kwh ? b.avg_kwh.toFixed(2) : '-'}</td>
                  <td className="text-right">
                    <span className="pill pill-brand">
                      {fmtPct(b.pct_share)}
                    </span>
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

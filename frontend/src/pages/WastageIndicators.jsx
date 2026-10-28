import { useState, useMemo, useEffect } from 'react'
import WastageCard from '../components/cards/WastageCard'
import BarChart from '../components/charts/BarChart'
import ErrorMessage from '../components/common/ErrorMessage'
import DownloadToolbar from '../components/common/DownloadToolbar'
import { SkeletonKpi, SkeletonChart, SkeletonTable } from '../components/common/SkeletonCard'
import { useEnergyData } from '../hooks/useEnergyData'
import { fetchWastageIndicators, fetchHostelClosureConfig, updateHostelClosureConfig } from '../api/energyApi'
import { fmtKwh, fmtPct } from '../utils/formatters'
import { exportWastageToExcel, exportWastageToCSV } from '../utils/exportUtils'
import {
  AlertTriangle, CheckCircle, AlertCircle, ShieldAlert,
  Clock, Calendar, Search, RotateCcw, Check,
  Home, Sliders, Save, RefreshCw, ShieldCheck, Power, Info
} from 'lucide-react'

const SEVERITY_ICONS = {
  high:   AlertTriangle,
  medium: AlertCircle,
  low:    CheckCircle,
  'n/a':  ShieldCheck,
}

// Academic buildings wastage incidents (Hostel night/weekend incidents removed as hostels operate 24/7)
const BASE_INCIDENTS = [
  {
    id: 'WST-20260911-01',
    timestamp: '2026-09-11 23:00:00',
    date: '2026-09-11',
    hour: '23:00',
    building_name: 'Classroom Block A',
    block_code: 'CB-A',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 148.6,
    baseline_kwh: 22.0,
    excess_kwh: 126.6,
    waste_pct: 85.2,
    severity: 'high',
    root_cause: 'HVAC central chiller & split ACs left operational in 4 lecture halls',
    status: 'Active Flag',
  },
  {
    id: 'WST-20260911-02',
    timestamp: '2026-09-11 20:30:00',
    date: '2026-09-11',
    hour: '20:30',
    building_name: 'Classroom Block A',
    block_code: 'CB-A',
    category: 'After-7PM Curfew',
    measured_kwh: 92.4,
    baseline_kwh: 18.0,
    excess_kwh: 74.4,
    waste_pct: 80.5,
    severity: 'high',
    root_cause: 'Lighting banks in ground floor corridor & seminar hall active past 19:00',
    status: 'Automated Cutoff',
  },
  {
    id: 'WST-20260911-03',
    timestamp: '2026-09-11 02:15:00',
    date: '2026-09-11',
    hour: '02:15',
    building_name: 'Laboratory Block B',
    block_code: 'LB-B',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 64.2,
    baseline_kwh: 35.0,
    excess_kwh: 29.2,
    waste_pct: 45.5,
    severity: 'medium',
    root_cause: 'Fume hood exhaust ventilation running at full load without active experiments',
    status: 'Under Review',
  },
  {
    id: 'WST-20260910-01',
    timestamp: '2026-09-10 22:45:00',
    date: '2026-09-10',
    hour: '22:45',
    building_name: 'Central Library',
    block_code: 'LIB',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 48.0,
    baseline_kwh: 20.0,
    excess_kwh: 28.0,
    waste_pct: 58.3,
    severity: 'medium',
    root_cause: 'Reference section desktop workstations & stack lighting left active',
    status: 'Automated Cutoff',
  },
  {
    id: 'WST-20260910-02',
    timestamp: '2026-09-10 20:00:00',
    date: '2026-09-10',
    hour: '20:00',
    building_name: 'Central Library',
    block_code: 'LIB',
    category: 'After-7PM Curfew',
    measured_kwh: 38.5,
    baseline_kwh: 18.0,
    excess_kwh: 20.5,
    waste_pct: 53.2,
    severity: 'medium',
    root_cause: 'Air handling unit (AHU) Zone 2 operating past 19:00 curfew',
    status: 'Investigated',
  },
  {
    id: 'WST-20260910-03',
    timestamp: '2026-09-10 03:30:00',
    date: '2026-09-10',
    hour: '03:30',
    building_name: 'Laboratory Block B',
    block_code: 'LB-B',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 58.0,
    baseline_kwh: 34.0,
    excess_kwh: 24.0,
    waste_pct: 41.4,
    severity: 'medium',
    root_cause: 'Spectrometry cooling cycle idling without sleep power state',
    status: 'Resolved',
  },
  {
    id: 'WST-20260907-01',
    timestamp: '2026-09-07 14:00:00',
    date: '2026-09-07',
    hour: '14:00',
    building_name: 'Classroom Block A',
    block_code: 'CB-A',
    category: 'Sunday Lockdown',
    measured_kwh: 76.8,
    baseline_kwh: 12.0,
    excess_kwh: 64.8,
    waste_pct: 84.4,
    severity: 'high',
    root_cause: 'Sunday lockdown breach: 1st floor computer lab AC running unstaffed',
    status: 'Active Flag',
  },
  {
    id: 'WST-20260907-02',
    timestamp: '2026-09-07 11:30:00',
    date: '2026-09-07',
    hour: '11:30',
    building_name: 'Central Library',
    block_code: 'LIB',
    category: 'Sunday Lockdown',
    measured_kwh: 32.0,
    baseline_kwh: 10.0,
    excess_kwh: 22.0,
    waste_pct: 68.8,
    severity: 'medium',
    root_cause: 'Sunday closure violation: ground floor circulation desk illumination left energized',
    status: 'Automated Cutoff',
  },
  {
    id: 'WST-20260905-01',
    timestamp: '2026-09-05 23:20:00',
    date: '2026-09-05',
    hour: '23:20',
    building_name: 'Classroom Block A',
    block_code: 'CB-A',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 88.0,
    baseline_kwh: 20.0,
    excess_kwh: 68.0,
    waste_pct: 77.3,
    severity: 'high',
    root_cause: 'Auditorium stage spotlights and sound amplifiers left energized overnight',
    status: 'Resolved',
  },
  {
    id: 'WST-20260904-01',
    timestamp: '2026-09-04 02:40:00',
    date: '2026-09-04',
    hour: '02:40',
    building_name: 'Laboratory Block B',
    block_code: 'LB-B',
    category: 'Off-Hours (22:00–05:59)',
    measured_kwh: 52.4,
    baseline_kwh: 32.0,
    excess_kwh: 20.4,
    waste_pct: 38.9,
    severity: 'low',
    root_cause: 'Muffle furnace left in standby preheat mode over weekend',
    status: 'Resolved',
  },
]

export default function WastageIndicators() {
  const { data, loading, error, hint, refetch } = useEnergyData(fetchWastageIndicators)

  // Hostel closure configuration state
  const [closureConfig, setClosureConfig] = useState({
    is_active: false,
    start_date: '2024-06-01',
    end_date: '2024-07-31',
    standby_threshold_kwh: 50.0,
    closure_reason: 'Summer Vacation (Students Vacated)',
  })
  const [savingClosure, setSavingClosure] = useState(false)
  const [closureMessage, setClosureMessage] = useState(null)

  // Incident Table Filter State
  const [selectedBuilding, setSelectedBuilding] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [searchQuery, setSearchQuery]           = useState('')
  const [currentPage, setCurrentPage]           = useState(1)
  const pageSize = 8

  // Load current closure config from backend on mount
  useEffect(() => {
    fetchHostelClosureConfig()
      .then(res => {
        if (res && res.data) {
          setClosureConfig(res.data)
        } else if (res) {
          setClosureConfig(res)
        }
      })
      .catch(err => {
        console.warn('Could not load hostel closure config:', err)
      })
  }, [])

  const handleSaveClosure = async () => {
    try {
      setSavingClosure(true)
      setClosureMessage(null)
      const res = await updateHostelClosureConfig(closureConfig)
      setClosureMessage({
        type: 'success',
        text: res.message || 'Hostel closure rules updated & recalculated successfully!'
      })
      refetch()
    } catch (err) {
      setClosureMessage({
        type: 'error',
        text: err.message || 'Failed to update hostel closure config'
      })
    } finally {
      setSavingClosure(false)
      setTimeout(() => setClosureMessage(null), 5000)
    }
  }

  // Build incidents list: include closure excess only when closure is active
  const activeIncidents = useMemo(() => {
    if (!closureConfig.is_active) {
      return BASE_INCIDENTS
    }
    return [
      {
        id: 'WST-HST-CLOSURE-01',
        timestamp: `${closureConfig.start_date || '2024-06-01'} 14:00:00`,
        date: closureConfig.start_date || '2024-06-01',
        hour: '14:00',
        building_name: 'Hostel Complex',
        block_code: 'HST',
        category: 'Closure Standby Exceedance',
        measured_kwh: Number((Number(closureConfig.standby_threshold_kwh || 50) + 14.5).toFixed(1)),
        baseline_kwh: Number(closureConfig.standby_threshold_kwh || 50),
        excess_kwh: 14.5,
        waste_pct: 22.5,
        severity: 'low',
        root_cause: `Exceeded official standby threshold (${closureConfig.standby_threshold_kwh || 50} kWh) during confirmed ${closureConfig.closure_reason || 'vacation closure'}`,
        status: 'Audit Flag',
      },
      ...BASE_INCIDENTS,
    ]
  }, [closureConfig])

  // Filtered Incident Log
  const filteredIncidents = useMemo(() => {
    return activeIncidents.filter(item => {
      if (selectedBuilding !== 'all' && item.building_name !== selectedBuilding && item.block_code !== selectedBuilding) {
        return false
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false
      }
      if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          item.timestamp.toLowerCase().includes(q) ||
          item.building_name.toLowerCase().includes(q) ||
          item.root_cause.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [activeIncidents, selectedBuilding, selectedCategory, selectedSeverity, searchQuery])

  const totalIncidentPages = Math.ceil(filteredIncidents.length / pageSize) || 1
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredIncidents.slice(start, start + pageSize)
  }, [filteredIncidents, currentPage, pageSize])

  if (loading) {
    return (
      <div className="space-y-8 page-enter">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <SkeletonChart height="h-64" />
        <SkeletonTable rows={4} />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} hint={hint} onRetry={refetch} />
  }

  const buildings = data || []

  // Count severities excluding 'n/a' hostel
  const counts = buildings.reduce((acc, b) => {
    if (b.severity && b.severity !== 'n/a') {
      acc[b.severity] = (acc[b.severity] || 0) + 1
    }
    return acc
  }, {})

  // Stacked bar chart: exclude N/A hostel from off-hours/weekend wastage
  const barData = buildings.map(b => {
    const isNa = Boolean(b.is_na || b.severity === 'n/a')
    return {
      name: b.building_name?.split(' ')[0] ?? b.building_name,
      'Off-Hours & After-7PM kWh': isNa ? 0 : (b.off_hours_kwh || 0),
      'Sundays & Weekends kWh':    isNa ? 0 : (b.weekend_kwh || 0),
    }
  })

  // Total wastage excludes N/A hostel
  const totalWastage = buildings.reduce((a, b) => {
    if (b.is_na || b.severity === 'n/a') return a
    return a + (b.total_wastage_kwh ?? b.wastage_kwh ?? 0)
  }, 0)

  // Total consumption includes all buildings (including Hostel!)
  const totalConsumption = buildings.reduce((a, b) => a + (b.total_kwh || 0), 0)

  const overallWastagePct = totalConsumption
    ? (totalWastage / totalConsumption * 100).toFixed(1)
    : 0

  const resetIncidentFilters = () => {
    setSelectedBuilding('all')
    setSelectedCategory('all')
    setSelectedSeverity('all')
    setSearchQuery('')
    setCurrentPage(1)
  }

  const isFilterActive =
    selectedBuilding !== 'all' ||
    selectedCategory !== 'all' ||
    selectedSeverity !== 'all' ||
    searchQuery.trim() !== ''

  return (
    <div className="space-y-8 page-enter pb-10">

      {/* Download toolbar */}
      <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-panel-800 border border-panel-400 shadow-lg">
        <div>
          <h1 className="text-sm font-bold text-white">Energy Wastage Report</h1>
          <p className="text-[11px] text-slate-500">
            Off-hours (22:00–05:59) · After 7 PM curfew · Academic Sunday lockouts · Hostel 24/7 rule &amp; Vacation Standby
          </p>
        </div>
        <DownloadToolbar
          label="Wastage Data"
          onExcelDownload={() => exportWastageToExcel(buildings)}
          onCSVDownload={() => exportWastageToCSV(buildings)}
        />
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-danger-500">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Wastage</p>
          <p className="text-2xl font-extrabold font-mono text-danger-400">{fmtKwh(totalWastage)}</p>
          <p className="text-xs text-slate-400 mt-1">{overallWastagePct}% of total campus electricity (Hostel load preserved)</p>
        </div>

        <div className="card p-5 border-l-4 border-l-warning-500">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Buildings at Risk</p>
          <p className="text-2xl font-extrabold font-mono text-warning-400">{counts.high || 0} High Risk</p>
          <p className="text-xs text-slate-400 mt-1">{counts.medium || 0} medium · {counts.low || 0} low (Hostel excluded: 24/7 normal)</p>
        </div>

        <div className="card p-5 border-l-4 border-l-success-500">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Potential Savings</p>
          <p className="text-2xl font-extrabold font-mono text-success-400">{fmtKwh(totalWastage * 0.6)}</p>
          <p className="text-xs text-slate-400 mt-1">Est. 60% recoverable academic off-hours load</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ADMIN: HOSTEL 24/7 RESIDENCY & CLOSURE CONFIGURATION PANEL
      ══════════════════════════════════════════════════════════════ */}
      <div className="card p-5 border border-panel-400 shadow-xl bg-panel-800">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-panel-400/80 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Home size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Hostel Complex 24/7 Residency &amp; Closure Configuration</span>
                <span className={`pill text-[10px] font-bold ${closureConfig.is_active ? 'pill-warning' : 'pill-brand'}`}>
                  {closureConfig.is_active ? 'Closure Standby Active' : '24/7 Normal Operation (Open)'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hostels operate 24/7 during normal semesters. Wastage analysis activates exclusively during verified vacation closures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setClosureConfig(c => ({ ...c, is_active: false }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !closureConfig.is_active
                  ? 'bg-sky-500 text-slate-900 font-bold shadow-lg shadow-sky-500/20'
                  : 'bg-panel-700 text-slate-400 hover:text-white border border-panel-500'
              }`}
            >
              <ShieldCheck size={13} />
              24/7 Normal Semester (Open)
            </button>
            <button
              onClick={() => setClosureConfig(c => ({ ...c, is_active: true }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                closureConfig.is_active
                  ? 'bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20'
                  : 'bg-panel-700 text-slate-400 hover:text-white border border-panel-500'
              }`}
            >
              <Power size={13} />
              Declare Vacation Closure
            </button>
          </div>
        </div>

        {/* Closure Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mb-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Closure Start Date
            </label>
            <input
              type="date"
              disabled={!closureConfig.is_active}
              value={closureConfig.start_date || ''}
              onChange={e => setClosureConfig(c => ({ ...c, start_date: e.target.value }))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-panel-700 border border-panel-500 text-white outline-none focus:border-sky-400 disabled:opacity-40 disabled:cursor-not-allowed font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Closure End Date
            </label>
            <input
              type="date"
              disabled={!closureConfig.is_active}
              value={closureConfig.end_date || ''}
              onChange={e => setClosureConfig(c => ({ ...c, end_date: e.target.value }))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-panel-700 border border-panel-500 text-white outline-none focus:border-sky-400 disabled:opacity-40 disabled:cursor-not-allowed font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Essential Standby Load (kWh)
            </label>
            <input
              type="number"
              step="5"
              min="0"
              disabled={!closureConfig.is_active}
              value={closureConfig.standby_threshold_kwh ?? 50.0}
              onChange={e => setClosureConfig(c => ({ ...c, standby_threshold_kwh: parseFloat(e.target.value) || 0 }))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-panel-700 border border-panel-500 text-white outline-none focus:border-sky-400 disabled:opacity-40 disabled:cursor-not-allowed font-mono transition-colors"
              placeholder="e.g. 50.0"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Closure Vacation Reason
            </label>
            <input
              type="text"
              disabled={!closureConfig.is_active}
              value={closureConfig.closure_reason || ''}
              onChange={e => setClosureConfig(c => ({ ...c, closure_reason: e.target.value }))}
              className="w-full text-xs rounded-xl px-3 py-2 bg-panel-700 border border-panel-500 text-white outline-none focus:border-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              placeholder="e.g. Summer Vacation"
            />
          </div>
        </div>

        {/* Footer info & Save Action */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-panel-400/60">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info size={14} className="text-sky-400 flex-shrink-0" />
            <span>
              {!closureConfig.is_active
                ? 'Hostel operates 24/7. Electricity used at night, after 7 PM, and on weekends is classified as normal living load (N/A).'
                : `Active closure: Electricity above ${closureConfig.standby_threshold_kwh || 50} kWh standby threshold will be flagged as potential wastage.`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {closureMessage && (
              <span className={`text-xs font-semibold ${closureMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {closureMessage.text}
              </span>
            )}
            <button
              onClick={handleSaveClosure}
              disabled={savingClosure}
              className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {savingClosure ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Recalculating Spark Metrics...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save &amp; Recalculate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Severity legend */}
      <div className="card px-5 py-3.5 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-brand-400" />
          <span className="text-xs text-slate-300 font-semibold">Severity Classification:</span>
        </div>
        {[
          { level: 'high',   label: '≥ 35% wastage', color: 'text-danger-400',  Icon: AlertTriangle },
          { level: 'medium', label: '20–35%',         color: 'text-warning-400', Icon: AlertCircle   },
          { level: 'low',    label: '< 20%',          color: 'text-success-400', Icon: CheckCircle   },
          { level: 'n/a',    label: '24/7 Normal Residency (Exempt)', color: 'text-sky-400', Icon: ShieldCheck },
        ].map(({ level, label, color, Icon }) => (
          <div key={level} className="flex items-center gap-1.5 text-xs">
            <Icon size={13} className={color} />
            <span className={`font-bold uppercase ${color}`}>{level}</span>
            <span className="text-slate-500">— {label}</span>
          </div>
        ))}
      </div>

      {/* Wastage cards with Time Stamp details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {buildings.map((b, i) => (
          <WastageCard key={b.building_name ?? i} building={b} />
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between border-b border-panel-400 pb-3 mb-6">
          <div>
            <h3 className="section-title">Off-Hours/After-7PM vs Sundays/Weekends Wastage by Building</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hostel Complex 24/7 living load is excluded from wastage; academic buildings evaluated per curfew rules
            </p>
          </div>
        </div>
        <BarChart data={barData} keys={['Off-Hours & After-7PM kWh', 'Sundays & Weekends kWh']} xKey="name" height={280} stacked />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TIMESTAMPED WASTAGE INCIDENTS & AUDIT LOG TABLE
      ══════════════════════════════════════════════════════════════ */}
      <div className="card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-panel-400 flex-wrap gap-3">
          <div>
            <h3 className="section-title flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              Wastage Incidents &amp; Timestamp Log
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Chronological log of verified off-hours, curfew violations, and Sunday/weekend idle loads with exact timestamps
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
            {filteredIncidents.length} Logged Incidents
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 rounded-xl bg-panel-700/50 border border-panel-400/60 mb-5">
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search timestamp or cause..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none bg-panel-800 border border-panel-400 text-white w-52 focus:border-brand-400 transition-colors"
              />
            </div>

            {/* Building filter */}
            <select
              value={selectedBuilding}
              onChange={e => { setSelectedBuilding(e.target.value); setCurrentPage(1) }}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none bg-panel-800 border border-panel-400 text-slate-200"
            >
              <option value="all">All Buildings</option>
              <option value="Classroom Block A">Classroom Block A</option>
              <option value="Laboratory Block B">Laboratory Block B</option>
              <option value="Central Library">Central Library</option>
              {closureConfig.is_active && <option value="Hostel Complex">Hostel Complex</option>}
            </select>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1) }}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none bg-panel-800 border border-panel-400 text-slate-200"
            >
              <option value="all">All Rules</option>
              <option value="Off-Hours (22:00–05:59)">Off-Hours (22:00–05:59)</option>
              <option value="After-7PM Curfew">After-7PM Curfew</option>
              <option value="Sunday Lockdown">Sunday Lockdown</option>
              {closureConfig.is_active && <option value="Closure Standby Exceedance">Closure Standby Exceedance</option>}
            </select>

            {/* Severity filter */}
            <select
              value={selectedSeverity}
              onChange={e => { setSelectedSeverity(e.target.value); setCurrentPage(1) }}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none bg-panel-800 border border-panel-400 text-slate-200"
            >
              <option value="all">All Severities</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {isFilterActive && (
            <button
              onClick={resetIncidentFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              <RotateCcw size={12} />
              Reset Filters
            </button>
          )}
        </div>

        {/* Incidents Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Building Block</th>
                <th>Wastage Category</th>
                <th className="text-right">Measured Load</th>
                <th className="text-right">Excess Wasted</th>
                <th className="text-center">Severity</th>
                <th>Audit Finding / Cause</th>
                <th className="text-center">Action Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No wastage incidents match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map(inc => {
                  const SIcon = SEVERITY_ICONS[inc.severity] || AlertCircle
                  const sColor =
                    inc.severity === 'high'   ? 'pill-danger' :
                    inc.severity === 'medium' ? 'pill-warning' : 'pill-success'

                  return (
                    <tr key={inc.id} className="animate-slide-in">
                      <td className="font-mono text-cyan-300 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-cyan-400" />
                          <span>{inc.timestamp}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap">
                        <span className="font-bold text-white">{inc.building_name}</span>
                        <span className="ml-1.5 text-[10px] font-mono px-1 py-0.5 rounded bg-panel-700 text-slate-400">
                          {inc.block_code}
                        </span>
                      </td>

                      <td className="whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-panel-700 border border-panel-400 text-slate-300 font-medium">
                          {inc.category}
                        </span>
                      </td>

                      <td className="text-right font-mono text-slate-300">
                        {inc.measured_kwh} kWh
                      </td>

                      <td className="text-right font-mono font-bold text-danger-400">
                        +{inc.excess_kwh} kWh
                      </td>

                      <td className="text-center">
                        <span className={`pill ${sColor} capitalize inline-flex items-center gap-1`}>
                          {SIcon && <SIcon size={11} />}
                          {inc.severity}
                        </span>
                      </td>

                      <td className="text-slate-300 text-xs max-w-xs truncate" title={inc.root_cause}>
                        {inc.root_cause}
                      </td>

                      <td className="text-center whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-brand-300 px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
                          {inc.status}
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
        {filteredIncidents.length > pageSize && (
          <div className="flex items-center justify-between pt-4 mt-3 border-t border-panel-400 flex-wrap gap-2 text-xs text-slate-400">
            <span>
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredIncidents.length)} of {filteredIncidents.length} timestamped events
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-panel-400 bg-panel-700 hover:bg-panel-600 disabled:opacity-40 transition-colors text-white"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                Page {currentPage} of {totalIncidentPages}
              </span>
              <button
                disabled={currentPage >= totalIncidentPages}
                onClick={() => setCurrentPage(p => Math.min(totalIncidentPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-panel-400 bg-panel-700 hover:bg-panel-600 disabled:opacity-40 transition-colors text-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Wastage Report summary table */}
      <div className="card p-6">
        <h3 className="section-title mb-4">Detailed Building Wastage Summary</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Building</th>
                <th className="text-right">Total kWh</th>
                <th className="text-right">Off-Hours &amp; After-7PM</th>
                <th className="text-right">Sundays &amp; Weekends</th>
                <th className="text-right">Total Wastage</th>
                <th className="text-right">Wastage %</th>
                <th className="text-center">Severity</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b, i) => {
                const isNa = Boolean(b.is_na || b.severity === 'n/a')
                const SIcon = isNa ? ShieldCheck : (SEVERITY_ICONS[b.severity] || CheckCircle)
                const sColor = isNa ? 'text-sky-400' :
                               b.severity === 'high'   ? 'text-danger-400' :
                               b.severity === 'medium' ? 'text-warning-400' : 'text-success-400'
                const wastageKwh = isNa ? 0 : (b.total_wastage_kwh ?? b.wastage_kwh ?? 0)
                const displayPct = isNa ? (b.status_text || 'N/A – Hostel Operates 24/7') : fmtPct(b.wastage_pct)
                const offHoursStr = isNa ? '0 kWh (24/7 Exempt)' : fmtKwh(b.off_hours_kwh)
                const weekendStr  = isNa ? '0 kWh (24/7 Exempt)' : fmtKwh(b.weekend_kwh)

                return (
                  <tr key={b.building_name ?? i}>
                    <td className="font-bold text-white flex items-center gap-2">
                      <span>{b.building_name}</span>
                      {isNa && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400">
                          24/7 Normal
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono text-slate-300">{fmtKwh(b.total_kwh)}</td>
                    <td className="text-right font-mono text-slate-300">{offHoursStr}</td>
                    <td className="text-right font-mono text-slate-300">{weekendStr}</td>
                    <td className="text-right font-mono text-danger-400 font-bold">
                      {isNa ? '0 kWh' : fmtKwh(wastageKwh)}
                    </td>
                    <td className="text-right font-mono font-extrabold text-white">
                      {displayPct}
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${sColor}`}>
                        <SIcon size={12} />
                        <span className="capitalize">{isNa ? 'N/A – 24/7' : b.severity}</span>
                      </span>
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

import React, { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Loader2,
  HardDrive, Database, Cpu, Server, RefreshCw, X, FileSpreadsheet,
  Plus, Trash2, ExternalLink, ChevronDown, Sparkles
} from 'lucide-react'
import { uploadDatasetBatch } from '../../api/uploadApi'

// ── Dataset type definitions ────────────────────────────────────────────────
const DATASET_TYPES = [
  { key: 'energy',    label: 'Energy Records (All Pages)',  icon: '⚡', route: '/',               color: 'text-brand-400',   badge: 'bg-brand-500/10 border-brand-500/20' },
  { key: 'buildings', label: 'Building Comparison',         icon: '🏛️', route: '/buildings',       color: 'text-accent-400',  badge: 'bg-accent-500/10 border-accent-500/20' },
  { key: 'daily',     label: 'Daily Trends',                icon: '📈', route: '/trends/daily',   color: 'text-blue-400',    badge: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'monthly',   label: 'Monthly Trends',              icon: '📅', route: '/trends/monthly', color: 'text-purple-400',  badge: 'bg-purple-500/10 border-purple-500/20' },
  { key: 'peaks',     label: 'Peak Usage',                  icon: '🔥', route: '/peaks',           color: 'text-warning-400', badge: 'bg-warning-500/10 border-warning-500/20' },
  { key: 'wastage',   label: 'Wastage Report',              icon: '♻️', route: '/wastage',         color: 'text-danger-400',  badge: 'bg-danger-500/10 border-danger-500/20' },
]

const TYPE_MAP = Object.fromEntries(DATASET_TYPES.map(t => [t.key, t]))

// ── Heuristic auto-detect from filename ─────────────────────────────────────
function autoDetectType(filename) {
  const f = filename.toLowerCase()
  if (/wastage|waste|off.?hour/.test(f))          return 'wastage'
  if (/month(?!ly_trend)|monthl/.test(f))          return 'monthly'
  if (/daily|day_|trend/.test(f))                  return 'daily'
  if (/peak|hour(?:ly|_)/.test(f))                return 'peaks'
  if (/building|block|comparison/.test(f))         return 'buildings'
  return 'energy'
}

// ── Pipeline step definitions ────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Upload Dataset',      icon: Upload },
  { num: 2, label: 'Store in HDFS',       icon: HardDrive },
  { num: 3, label: 'Register Hive',       icon: Database },
  { num: 4, label: 'Run Spark Job',       icon: Cpu },
  { num: 5, label: 'Populate MySQL',      icon: Server },
  { num: 6, label: 'Update Dashboard',   icon: RefreshCw },
]

// ── Unique ID for each queued file ───────────────────────────────────────────
let _uid = 0
const uid = () => String(++_uid)

// ── Main Component ───────────────────────────────────────────────────────────
export function DataUploadModal({ isOpen, onClose, onUploadComplete }) {
  const navigate = useNavigate()

  // Queue: Array<{ id, file, datasetType, status, result, error }>
  const [queue, setQueue]           = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadStep, setUploadStep] = useState(0)
  const [httpPct, setHttpPct]       = useState(0)
  const [batchResults, setBatchResults] = useState(null)   // array of per-file results
  const inputRef = useRef(null)

  // ── All hooks MUST be above any early return (Rules of Hooks) ─────────────
  const addFiles = useCallback((fileList) => {
    const valid = []
    Array.from(fileList).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      if (!['csv', 'xlsx', 'xls'].includes(ext)) return
      valid.push({
        id:          uid(),
        file:        f,
        datasetType: autoDetectType(f.name),
        status:      'queued',
        result:      null,
        error:       null,
      })
    })
    setQueue(prev => [...prev, ...valid])
  }, [])

  // Early return AFTER all hooks ─────────────────────────────────────────────
  if (!isOpen) return null

  // Non-hook event handlers (safe after early return because they aren't hooks)
  const handleFileInput = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const removeItem = (id) => setQueue(prev => prev.filter(q => q.id !== id))

  const setItemType = (id, datasetType) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, datasetType } : q))
  }

  // ── Upload all ────────────────────────────────────────────────────────────
  const handleUploadAll = async () => {
    if (!queue.length || uploading) return
    setUploading(true)
    setUploadStep(1)
    setHttpPct(5)

    // Animate pipeline steps while waiting
    let step = 1
    const stepTimer = setInterval(() => {
      step = Math.min(step + 1, 5)
      setUploadStep(step)
      setHttpPct(Math.round(5 + (step / 6) * 80))
    }, 15_000)

    try {
      const items = queue.map(q => ({ file: q.file, datasetType: q.datasetType }))
      const results = await uploadDatasetBatch(items, (pct) => {
        setHttpPct(Math.max(pct, 20))
      })

      clearInterval(stepTimer)
      setUploadStep(6)
      setHttpPct(100)

      // results is Array<per-file result>
      const finalResults = Array.isArray(results) ? results : [results]
      setBatchResults(finalResults)

      // Update queue statuses
      setQueue(prev => prev.map((q, idx) => {
        const r = finalResults[idx]
        if (!r) return q
        return {
          ...q,
          status: r.status === 'error' ? 'error' : 'success',
          result: r.status !== 'error' ? r : null,
          error:  r.status === 'error' ? r.error : null,
        }
      }))

      if (onUploadComplete) onUploadComplete(finalResults)
    } catch (err) {
      clearInterval(stepTimer)
      // Mark all as error
      const msg = err.message || 'Upload failed'
      setQueue(prev => prev.map(q => ({ ...q, status: 'error', error: msg })))
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setQueue([])
    setBatchResults(null)
    setUploadStep(0)
    setHttpPct(0)
  }

  const successCount = queue.filter(q => q.status === 'success').length
  const errorCount   = queue.filter(q => q.status === 'error').length
  const isDone       = batchResults !== null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-space-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-panel-900 border border-panel-400/60 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-panel-400/30 bg-panel-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Upload Energy Datasets</h3>
              <p className="text-xs text-slate-400">Select multiple files — auto-routed to their analysis pages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-panel-400/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── Done: Results summary ──────────────────────────────────── */}
          {isDone ? (
            <div className="space-y-4 animate-fade-in">
              {/* Status banner */}
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                errorCount === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-warning-500/10 border-warning-500/30 text-warning-400'
              }`}>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    {successCount} of {queue.length} dataset{queue.length !== 1 ? 's' : ''} ingested successfully
                  </p>
                  <p className="text-xs opacity-80">Spark aggregations recomputed — dashboards updated</p>
                </div>
              </div>

              {/* Per-file result cards */}
              <div className="space-y-2">
                {queue.map((item) => {
                  const typeInfo = TYPE_MAP[item.datasetType] || TYPE_MAP.energy
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-start gap-3 ${
                        item.status === 'success'
                          ? 'bg-panel-800/60 border-emerald-500/20'
                          : 'bg-danger-500/5 border-danger-500/20'
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${item.status === 'success' ? 'text-emerald-400' : 'text-danger-400'}`}>
                        {item.status === 'success'
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
                        {item.status === 'success' && item.result && (
                          <p className="text-xs text-slate-400 font-mono">
                            {item.result.record_count?.toLocaleString()} rows · {item.result.building_count} buildings
                          </p>
                        )}
                        {item.status === 'error' && (
                          <p className="text-xs text-danger-400">{item.error}</p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border ${typeInfo.badge} ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        {item.status === 'success' && (
                          <button
                            onClick={() => { onClose(); navigate(typeInfo.route) }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          ) : (
            <>
              {/* ── Drop zone ────────────────────────────────────────────── */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
                    : 'border-panel-400/40 hover:border-brand-500/40 bg-panel-950/30'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  id="dataset-upload-input"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-2xl bg-panel-800 border border-panel-400/40 flex items-center justify-center text-brand-400 mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Drag & drop files or <span className="text-brand-400 underline">Browse</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  CSV, XLSX, XLS · Up to 10 files · Max 100 MB each
                </p>
                <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                  {DATASET_TYPES.map(t => (
                    <span key={t.key} className={`text-[11px] px-2 py-0.5 rounded-lg border ${t.badge} ${t.color}`}>
                      {t.icon} {t.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Queued files list ────────────────────────────────────── */}
              {queue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">
                      {queue.length} file{queue.length !== 1 ? 's' : ''} queued
                    </p>
                    {!uploading && (
                      <button
                        onClick={() => inputRef.current?.click()}
                        className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add more
                      </button>
                    )}
                  </div>

                  {queue.map((item) => (
                    <FileQueueCard
                      key={item.id}
                      item={item}
                      disabled={uploading}
                      onRemove={() => removeItem(item.id)}
                      onTypeChange={(t) => setItemType(item.id, t)}
                    />
                  ))}
                </div>
              )}

              {/* ── Pipeline progress (while uploading) ──────────────────── */}
              {uploading && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-mono">
                      <span>Pipeline Progress</span>
                      <span>{httpPct}%</span>
                    </div>
                    <div className="w-full bg-panel-800 rounded-full h-2 overflow-hidden border border-panel-400/30">
                      <div
                        className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${httpPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {STEPS.map((s) => {
                      const Icon      = s.icon
                      const isCurrent = uploadStep === s.num
                      const isPassed  = uploadStep > s.num
                      return (
                        <div
                          key={s.num}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            isCurrent
                              ? 'bg-brand-500/10 border-brand-500/40 text-brand-300'
                              : isPassed
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                              : 'bg-panel-950/20 border-panel-400/20 text-slate-500'
                          }`}
                        >
                          {isCurrent
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-brand-400" />
                            : isPassed
                            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                            : <Icon className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                          <span className="truncate">{s.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Schema hint ──────────────────────────────────────────── */}
              {!uploading && queue.length === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-panel-800/40 border border-panel-400/20 text-xs text-slate-400">
                  <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-300 mb-0.5">Flexible schema — any column names accepted</p>
                    <p>The backend auto-detects timestamps, consumption values, and building IDs from your headers.
                    Missing columns are derived automatically. You can also manually select the dataset type for each file.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-panel-400/30 bg-panel-950/40 shrink-0">
          {isDone ? (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-panel-400/20 transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Upload More
              </button>
              <button
                onClick={() => { reset(); onClose(); window.location.reload() }}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
              >
                Done — View Updated Data
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-panel-400/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {queue.length > 0 && !uploading && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {queue.length} file{queue.length !== 1 ? 's' : ''} ready
                  </span>
                )}
                <button
                  onClick={handleUploadAll}
                  disabled={queue.length === 0 || uploading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ingesting {queue.length} file{queue.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload All ({queue.length})
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── File queue card sub-component ────────────────────────────────────────────
function FileQueueCard({ item, disabled, onRemove, onTypeChange }) {
  const [open, setOpen] = useState(false)
  const typeInfo = TYPE_MAP[item.datasetType] || TYPE_MAP.energy

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-panel-800/70 border border-panel-400/30 hover:border-panel-400/60 transition-all">
      {/* File icon */}
      <div className="p-2 rounded-lg bg-panel-700 border border-panel-400/30 shrink-0">
        <FileText className="w-4 h-4 text-slate-300" />
      </div>

      {/* Name + size */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
        <p className="text-[11px] text-slate-500">
          {(item.file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>

      {/* Dataset type selector */}
      <div className="relative shrink-0">
        <button
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${typeInfo.badge} ${typeInfo.color} hover:opacity-80 disabled:opacity-50`}
        >
          <span>{typeInfo.icon}</span>
          <span className="max-w-[100px] truncate">{typeInfo.label}</span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-panel-900 border border-panel-400/40 rounded-xl shadow-2xl overflow-hidden w-52">
            {DATASET_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { onTypeChange(t.key); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-panel-700/60 transition-colors ${
                  t.key === item.datasetType ? 'bg-panel-800' : ''
                }`}
              >
                <span>{t.icon}</span>
                <span className={`font-medium ${t.color}`}>{t.label}</span>
                {t.key === item.datasetType && <CheckCircle2 className="w-3 h-3 ml-auto text-emerald-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Remove */}
      {!disabled && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

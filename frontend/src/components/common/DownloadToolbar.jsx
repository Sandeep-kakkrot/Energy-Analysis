import { useState } from "react"
import { FileSpreadsheet, FileCode, Download } from "lucide-react"

export default function DownloadToolbar({ onExcelDownload, onCSVDownload, label = "Dataset" }) {
  const [busy, setBusy] = useState(null)
  const run = async (type, fn) => {
    setBusy(type)
    try { await fn() } catch (e) { console.error("Download error:", e) }
    finally { setBusy(null) }
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold pr-1 uppercase tracking-wider" style={{ color: "#9a7a7a", fontFamily: "Barlow Condensed, sans-serif" }}>
        <Download size={12} style={{ color: "#5a3a3a" }} />
        Download {label}:
      </span>
      <button
        id="btn-download-excel"
        onClick={() => run("excel", onExcelDownload)}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-white transition-all duration-200 active:scale-[0.97] hover:scale-105"
        style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "1px solid rgba(34,197,94,0.3)", boxShadow: "0 4px 12px rgba(34,197,94,0.2)", opacity: busy ? 0.5 : 1, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", cursor: busy ? "not-allowed" : "pointer" }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.boxShadow = "0 0 18px rgba(34,197,94,0.45)" }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(34,197,94,0.2)" }}
      >
        {busy === "excel" ? <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin flex-shrink-0" /> : <FileSpreadsheet size={13} className="flex-shrink-0" />}
        Excel (.xlsx)
      </button>
      <button
        id="btn-download-csv"
        onClick={() => run("csv", onCSVDownload)}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200 active:scale-[0.97] hover:scale-105"
        style={{ background: "#1c1212", border: "1px solid #3a2020", color: "#ff9a9a", opacity: busy ? 0.5 : 1, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", cursor: busy ? "not-allowed" : "pointer" }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = "rgba(230,48,48,0.4)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#3a2020" }}
      >
        {busy === "csv" ? <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin flex-shrink-0" /> : <FileCode size={13} className="flex-shrink-0" />}
        CSV
      </button>
    </div>
  )
}

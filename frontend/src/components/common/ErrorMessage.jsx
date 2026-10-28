import { AlertOctagon, RefreshCw, Terminal } from 'lucide-react'

/**
 * Inline error card — red/green/yellow theme.
 */
export default function ErrorMessage({ message, hint, onRetry, compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-4 animate-fade-in">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(230,48,48,0.1)', border: '1px solid rgba(230,48,48,0.2)' }}
        >
          <AlertOctagon size={18} style={{ color: '#ff6060' }} />
        </div>
        <div>
          <p className="text-[12px] font-bold text-white" style={{ fontFamily: 'Barlow, sans-serif' }}>{message}</p>
          {hint && (
            <p className="text-[11px] mt-1 font-mono" style={{ color: '#5a3a3a' }}>{hint}</p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(230,48,48,0.12)',
              border: '1px solid rgba(230,48,48,0.25)',
              color: '#ff9a9a',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            <RefreshCw size={11} />
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[35vh] gap-5 text-center px-6 animate-scale-in">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: 'rgba(230,48,48,0.1)',
          border: '1px solid rgba(230,48,48,0.2)',
          boxShadow: '0 0 28px rgba(230,48,48,0.15)',
        }}
      >
        <AlertOctagon size={28} style={{ color: '#ff6060' }} />
      </div>

      <div className="max-w-md">
        <h2
          className="text-base font-black text-white mb-1 uppercase tracking-widest"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          Data Unavailable
        </h2>
        <p className="text-[13px] leading-relaxed" style={{ color: '#9a7a7a' }}>{message}</p>
      </div>

      {hint && (
        <div
          className="w-full max-w-md rounded-xl px-4 py-3 text-left"
          style={{ background: '#1c1212', border: '1px solid #3a2020' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={12} style={{ color: '#e63030' }} />
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: '#9a7a7a', fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              Run this to compute data
            </span>
          </div>
          <code className="text-[12px] font-mono break-all" style={{ color: '#ff9a9a' }}>{hint}</code>
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-200 hover:scale-105"
          style={{
            background: 'rgba(230,48,48,0.12)',
            border: '1px solid rgba(230,48,48,0.3)',
            color: '#ff9a9a',
            fontFamily: 'Barlow Condensed, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(230,48,48,0.3)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  )
}

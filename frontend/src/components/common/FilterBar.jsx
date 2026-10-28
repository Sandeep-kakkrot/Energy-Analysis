import { AlertCircle, RefreshCw } from 'lucide-react'

export default function FilterBar({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(230,48,48,0.1)', border: '1px solid rgba(230,48,48,0.2)' }}
      >
        <AlertCircle size={22} style={{ color: '#ff6060' }} />
      </div>
      <div className="text-center">
        <p
          className="text-[14px] font-black text-white mb-1 uppercase tracking-widest"
          style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
        >
          Failed to load data
        </p>
        <p className="text-[12px] max-w-xs" style={{ color: '#9a7a7a' }}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105"
          style={{
            background: 'rgba(230,48,48,0.1)',
            border: '1px solid rgba(230,48,48,0.25)',
            color: '#ff9a9a',
            fontFamily: 'Barlow Condensed, sans-serif',
          }}
        >
          <RefreshCw size={13} />
          Try again
        </button>
      )}
    </div>
  )
}

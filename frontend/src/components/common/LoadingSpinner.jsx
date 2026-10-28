export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fade-in">
      {/* UC-style blue spinner */}
      <div className="relative w-12 h-12">
        {/* Outer track */}
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: '#1a1a1a' }}
        />
        {/* Blue outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#0033ff', animationDuration: '0.9s' }}
        />
        {/* White inner ring */}
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent animate-spin"
          style={{ borderBottomColor: 'rgba(255,255,255,0.4)', animationDuration: '0.6s', animationDirection: 'reverse' }}
        />
        {/* Blue center dot */}
        <div
          className="absolute inset-[38%] rounded-full animate-pulse"
          style={{ background: '#4d74ff' }}
        />
      </div>

      <div className="text-center">
        <p
          className="text-[13px] font-bold uppercase tracking-widest"
          style={{ color: '#606060' }}
        >
          {text}
        </p>
        <p
          className="text-[10px] mt-1 uppercase tracking-widest"
          style={{ color: '#333333' }}
        >
          Hadoop · Spark · MySQL
        </p>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

/* ════════════════════════════════════════════════════════════════
   BORDER TRACE — SVG animated stroke along card perimeter
   Uses pathLength="100" for exact responsive perimeter tracing
════════════════════════════════════════════════════════════════ */

export function BorderTrace({ show, isDark }) {
  if (!show) return null
  const color = isDark ? '#62FFF2' : '#22C9BA'
  const glowColor = isDark ? '#22E6D3' : '#009688'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      borderRadius: '1rem',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 30,
    }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <style>{`
          @keyframes bTrace {
            0%   { stroke-dashoffset: 100; opacity: 1; }
            50%  { stroke-dashoffset: 50; opacity: 1; }
            80%  { stroke-dashoffset: 20; opacity: 0.6; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
        `}</style>
        {/* Glow layer */}
        <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="16" ry="16"
          fill="none" stroke={glowColor} strokeWidth="6" opacity="0.4"
          pathLength="100"
          strokeDasharray="45 55"
          strokeDashoffset="100"
          style={{ animation: 'bTrace 0.65s ease-out forwards', filter: 'blur(4px)' }}
        />
        {/* Core line */}
        <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="16" ry="16"
          fill="none" stroke={color} strokeWidth="2"
          pathLength="100"
          strokeDasharray="45 55"
          strokeDashoffset="100"
          style={{ animation: 'bTrace 0.65s ease-out forwards' }}
        />
      </svg>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   AMBIENT DATA-LINE BACKGROUND GEOMETRY (barely visible SVG)
════════════════════════════════════════════════════════════════ */

function AmbientGeometry({ isDark, active }) {
  const op = isDark ? 0.06 : 0.05
  const stroke = isDark ? '#00C9AE' : '#009688'
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: active ? op : 0, transition: 'opacity 0.4s ease' }} preserveAspectRatio="xMidYMid slice">
      {/* Faint horizontal data line across middle */}
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke={stroke} strokeWidth="0.5" />
      {/* Vertical bar chart ghosts — right side */}
      {[72, 74, 78, 72, 80, 75, 68, 76].map((h, i) => (
        <rect key={i} x={`${60 + i * 4}%`} y={`${50 - h / 4}%`} width="2.2%" height={`${h / 4}%`} fill={stroke} opacity="0.5" />
      ))}
      {/* Node dots */}
      {[[15, 35], [20, 52], [28, 42], [35, 60], [45, 38], [55, 55]].map(([x, y], i) => (
        <circle key={i} cx={`${x}%`} cy={`${y}%`} r="2" fill={stroke} opacity="0.6" />
      ))}
      {/* Connecting lines between nodes */}
      <polyline points="15%,35% 20%,52% 28%,42% 35%,60% 45%,38% 55%,55%" fill="none" stroke={stroke} strokeWidth="0.4" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════
   REDUCED-MOTION CHECK
════════════════════════════════════════════════════════════════ */

const REDUCED = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ════════════════════════════════════════════════════════════════
   MAIN INTRO SEQUENCE COMPONENT
════════════════════════════════════════════════════════════════ */

export default function IntroSequence({ children }) {
  const { isDark } = useTheme()
  const containerRef = useRef(null)

  const [panelState, setPanelState] = useState('hidden') // hidden | visible
  const [showTrace, setShowTrace] = useState(false)
  const [ambientActive, setAmbientActive] = useState(false)

  useEffect(() => {
    if (REDUCED) { setPanelState('visible'); return }

    // Fade in the ambient geometry
    const ambientTimer = setTimeout(() => setAmbientActive(true), 400)

    // Reveal the login panel with a short fade-in delay
    const panelTimer = setTimeout(() => {
      setPanelState('visible')
      setShowTrace(true)
      setTimeout(() => setShowTrace(false), 700)
    }, 400)

    return () => {
      clearTimeout(ambientTimer)
      clearTimeout(panelTimer)
    }
  }, [isDark])

  /* ── Reduced-motion fallback ── */
  if (REDUCED) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        {children}
      </div>
    )
  }

  /* ── Color tokens for background ── */
  const bgGrad = isDark
    ? 'radial-gradient(ellipse at 50% 52%, #081C21 0%, #061116 50%, #030A0E 100%)'
    : 'radial-gradient(ellipse at 50% 52%, #EBF7F5 0%, #D8EDE9 50%, #CAE7E2 100%)'

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: bgGrad, overflow: 'hidden' }}>

      {/* Subtle data grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,196,167,0.036) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,196,167,0.036) 1px, transparent 1px)
        `,
        backgroundSize: '68px 68px',
      }} />

      {/* Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isDark
          ? 'radial-gradient(ellipse at center, transparent 35%, rgba(2,8,14,0.68) 100%)'
          : 'radial-gradient(ellipse at center, transparent 35%, rgba(180,210,205,0.45) 100%)',
      }} />

      {/* Ambient SVG data geometry */}
      <AmbientGeometry isDark={isDark} active={ambientActive} />

      {/* CSS keyframes for spin animation used in login button */}
      <style>{`
        @keyframes ceiSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ceiGlowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,196,167,0.3); }
          50%       { box-shadow: 0 0 55px rgba(0,212,193,0.7); }
        }
      `}</style>

      {/* Login panel — revealed with fade-in animation */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: panelState === 'hidden' ? 0 : 1,
        transform: panelState === 'hidden' ? 'scale(0.95)' : 'scale(1)',
        filter: panelState === 'hidden' ? 'blur(10px)' : 'blur(0px)',
        transition: 'opacity 0.38s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1), filter 0.38s ease',
        pointerEvents: panelState === 'hidden' ? 'none' : 'all',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '28rem', margin: '0 auto', padding: '0 1rem' }}>
          <BorderTrace show={showTrace} isDark={isDark} />
          {children}
        </div>
      </div>
    </div>
  )
}

import { createContext, useContext, useState, useCallback } from 'react'

import { AlertTriangle, Zap, X, CheckCircle, Info } from 'lucide-react'
import { useTheme } from './ThemeContext'

const NotificationContext = createContext(null)

let idCounter = 0

/* ── Default alerts shown right after login ────────────────── */
const LOGIN_ALERTS = [
  { id: 'la-1', type: 'warning', title: '⚡ High Consumption Alert',    message: 'Classroom Block A: 48.2 kWh detected after 7 PM. Exceeds threshold.' },
  { id: 'la-2', type: 'danger',  title: '🚨 Energy Wastage Detected',   message: 'Central Library: 32.5 kWh on Sunday — 38% wastage detected.' },
  { id: 'la-3', type: 'info',    title: '📋 Weekly Report Ready',        message: 'October Week 1 summary is available for download.' },
]

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  /* ── Panel state — shown once per session, triggered by Dashboard ── */
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(LOGIN_ALERTS)

  const showLoginPanel = useCallback(() => {
    setPanelItems(LOGIN_ALERTS)
    setPanelOpen(true)
  }, [])

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const notify = useCallback(({ type = 'info', title, message, duration = 6000 }) => {
    const id = ++idCounter
    setNotifications(prev => [{ id, type, title, message }, ...prev.slice(0, 4)])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const notifyHighConsumption = useCallback(({ building, kwh, threshold, reason }) => {
    return notify({
      type: 'warning',
      title: `⚡ High Consumption Alert`,
      message: `${building}: ${kwh.toFixed(1)} kWh detected. ${reason || 'Exceeds threshold.'}`,
      duration: 8000,
    })
  }, [notify])

  const notifyWastage = useCallback(({ building, wastage_pct, reason }) => {
    return notify({
      type: 'danger',
      title: `🚨 Energy Wastage Detected`,
      message: `${building}: ${wastage_pct.toFixed(1)}% wastage. ${reason}`,
      duration: 10000,
    })
  }, [notify])

  return (
    <NotificationContext.Provider value={{ notify, notifyHighConsumption, notifyWastage, dismiss, showLoginPanel }}>
      {children}
      {/* One-time login notification panel — triggered by Dashboard */}
      {panelOpen && (
        <LoginNotificationPanel
          items={panelItems}
          onDismissItem={(id) => setPanelItems(p => p.filter(n => n.id !== id))}
          onClearAll={() => { setPanelItems([]); setPanelOpen(false) }}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

/* ── Floating Toast Container (programmatic notify calls) ───── */
function ToastContainer({ notifications, onDismiss }) {
  const { isDark } = useTheme()
  if (!notifications.length) return null
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 sm:w-96"
      style={{ pointerEvents: 'none' }}
    >
      {notifications.map(n => (
        <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} isDark={isDark} />
      ))}
    </div>
  )
}

/* ── Login Notification Panel ──────────────────────────────── */
function LoginNotificationPanel({ items, onDismissItem, onClearAll, onClose }) {
  const { isDark } = useTheme()
  const typeColor = { warning: '#f59e0b', danger: '#ef4444', info: 'var(--accent)' }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9991,
          width: '100%', maxWidth: '22rem',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          background: isDark ? '#0c1a1f' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(0,196,167,0.2)' : 'rgba(0,150,136,0.2)'}`,
          boxShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,196,167,0.08)'
            : '0 24px 64px rgba(0,0,0,0.15)',
          animation: 'slideInUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Top accent stripe */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, var(--accent), #007a6e)',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#fff' : '#111', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Alerts
            </span>
            {items.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6b7280' : '#9ca3af', padding: 4, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
          >
            <X size={15} />
          </button>
        </div>

        {/* Notification list */}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: isDark ? '#6b7280' : '#9ca3af', fontSize: 12 }}>
              No new alerts
            </div>
          ) : items.map(n => (
            <div
              key={n.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '11px 14px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(0,196,167,0.05)' : 'rgba(0,196,167,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: typeColor[n.type],
                boxShadow: `0 0 8px ${typeColor[n.type]}99`,
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#fff' : '#111', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {n.title}
                </p>
                <p style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.45 }}>
                  {n.message}
                </p>
              </div>
              <button
                onClick={() => onDismissItem(n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6b7280' : '#9ca3af', padding: 2, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Clear All — footer button */}
        <div style={{
          padding: '10px 14px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={onClearAll}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: 10,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: '#ef4444',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
          >
            Clear All Notifications
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 24px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  )
}

/* ── Single Notification Card (for toasts) ──────────────────── */
function NotificationCard({ notification, onDismiss, isDark }) {
  const { id, type, title, message } = notification

  const configs = {
    info:    { icon: Info,          color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.1)'  : 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)' },
    success: { icon: CheckCircle,   color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.1)'   : 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)' },
    warning: { icon: Zap,           color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.4)' },
    danger:  { icon: AlertTriangle, color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.12)'  : 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.4)' },
  }

  const cfg = configs[type] || configs.info
  const Icon = cfg.icon

  return (
    <div
      style={{
        pointerEvents: 'all',
        background: isDark ? '#111111' : '#ffffff',
        border: `1px solid ${cfg.border}`,
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 8px 32px rgba(0,0,0,0.12)',
        animation: 'slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: cfg.bg,
          }}
        >
          <Icon size={16} color={cfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 12, fontWeight: 700, color: isDark ? '#ffffff' : '#111111',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
          }}>
            {title}
          </p>
          <p style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(id)}
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
            color: isDark ? '#6b7280' : '#9ca3af', padding: 2, borderRadius: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.color = cfg.color}
          onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Menu, Bell, RefreshCw, User, LogOut,
  Shield, BarChart3, ChevronDown, Upload, Sun, Moon, X, Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { DataUploadModal } from '../upload/DataUploadModal'

const PAGE_META = {
  '/':               { title: 'Dashboard',        crumb: 'Overview' },
  '/buildings':      { title: 'Buildings',         crumb: 'Block Comparison' },
  '/trends/daily':   { title: 'Daily Analysis',   crumb: 'Time-series Trends' },
  '/trends/monthly': { title: 'Monthly Analysis', crumb: 'Year-over-Year' },
  '/peaks':          { title: 'Peak Usage',        crumb: 'Heatmap & Rankings' },
  '/wastage':        { title: 'Energy Wastage',    crumb: 'Waste Indicators' },
  '/reports':        { title: 'Reports',           crumb: 'Data Export' },
}

/* ── Theme Toggle ──────────────────────────────────────────── */
function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      id="btn-theme-toggle"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="p-2 rounded-xl transition-all duration-300 hover:scale-110 flex items-center gap-1"
      style={{
        background:  'rgba(0,196,167,0.08)',
        border:      '1px solid var(--border-color)',
        color:       'var(--accent)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background  = 'rgba(0,196,167,0.15)'
        e.currentTarget.style.boxShadow   = '0 0 14px var(--accent-glow)'
        e.currentTarget.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = 'rgba(0,196,167,0.08)'
        e.currentTarget.style.boxShadow   = 'none'
        e.currentTarget.style.borderColor = 'var(--border-color)'
      }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}

/* ── Notification Bell ─────────────────────────────────────── */
function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([
    { id: 1, type: 'warning', time: '2 min ago',  title: 'High Consumption Alert', msg: 'Classroom Block A: 48.2 kWh after 7 PM' },
    { id: 2, type: 'danger',  time: '18 min ago', title: 'Sunday Wastage Detected', msg: 'Central Library: 32.5 kWh on Sunday' },
    { id: 3, type: 'info',    time: '1 hr ago',   title: 'Weekly Report Ready', msg: 'October Week 1 summary is available' },
  ])

  const unread = items.length
  const typeColor = { warning: '#f59e0b', danger: '#ef4444', info: 'var(--accent)' }
  const dismiss = (id) => setItems(p => p.filter(n => n.id !== id))

  return (
    <div className="relative">
      <button
        id="btn-notifications"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl transition-all duration-200 hover:scale-110"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,167,0.1)'; e.currentTarget.style.color = 'var(--accent-bright)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.9)', animation: 'pulse 2s infinite' }}
          />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-80 z-40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            style={{
              background:     'var(--bg-card)',
              border:         '1px solid var(--border-color)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="uc-stripe" />
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Zap size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Alerts</span>
                {unread > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{unread}</span>
                )}
              </div>
              <button onClick={() => setItems([])} style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                Clear all
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No new alerts</div>
              ) : items.map(n => (
                <div key={n.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,196,167,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: typeColor[n.type], boxShadow: `0 0 8px ${typeColor[n.type]}88` }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{n.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.msg}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3 }}>{n.time}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── User dropdown ─────────────────────────────────────────── */
function UserMenu() {
  const { user, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null
  const RoleIcon = isAdmin ? Shield : BarChart3
  const roleLabel = isAdmin ? 'Admin' : 'Viewer'

  return (
    <div className="relative">
      <button
        id="btn-user-menu"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-3 transition-opacity hover:opacity-80"
        style={{ borderLeft: '1px solid var(--border-subtle)' }}
        aria-expanded={open}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-105"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #007a6e 100%)', boxShadow: '0 0 12px var(--accent-glow)' }}
        >
          <User size={14} className="text-white" />
        </div>
        <div className="hidden sm:block text-left">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{user.username}</p>
          <p style={{ fontSize: 10, marginTop: 1, color: 'var(--text-muted)' }}>{user.email}</p>
        </div>
        <ChevronDown size={13} className={`transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-52 z-40 rounded-xl shadow-xl overflow-hidden animate-scale-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', backdropFilter: 'blur(20px)' }}
          >
            <div className="uc-stripe" />
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{user.username}</p>
              <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</p>
              <span
                className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full"
                style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(0,196,167,0.12)', color: 'var(--accent-bright)' }}
              >
                <RoleIcon size={9} />
                {roleLabel}
              </span>
            </div>
            {user.last_login && (
              <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)' }}>Last login</p>
                <p style={{ fontSize: 11, marginTop: 2, color: 'var(--text-muted)' }}>{new Date(user.last_login).toLocaleString()}</p>
              </div>
            )}
            <button
              id="btn-logout"
              onClick={() => { setOpen(false); logout() }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-all duration-200"
              style={{ color: '#f87171', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Header ──────────────────────────────────────────────────── */
export default function Header({ onMenuOpen }) {
  const { pathname } = useLocation()
  const { isAdmin } = useAuth()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const meta = PAGE_META[pathname] || { title: 'Analytics', crumb: '' }

  return (
    <>
      <header
        className="sticky top-0 z-20 h-[60px] flex items-center gap-4 px-6"
        style={{
          background:     'var(--bg-glass)',
          borderBottom:   '1px solid var(--border-subtle)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Hamburger — mobile */}
        <button
          id="btn-mobile-menu"
          onClick={onMenuOpen}
          className="lg:hidden p-2 rounded-xl transition-all duration-200 hover:scale-105 flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,167,0.1)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] mb-0.5 uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            <span>EnergyIQ</span>
            <span>/</span>
            <span style={{ color: 'var(--text-muted)' }}>{meta.crumb}</span>
          </div>
          <h1 className="text-[16px] font-black truncate uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
            {meta.title}
          </h1>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Upload — admin only */}
          {isAdmin && (
            <button
              id="btn-upload-dataset"
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105"
              style={{ background: 'rgba(0,196,167,0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-bright)' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Upload Dataset</span>
            </button>
          )}


          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <NotificationBell />

          {/* Refresh */}
          <button
            id="btn-refresh"
            onClick={() => window.location.reload()}
            className="p-2 rounded-xl transition-all duration-200 hover:scale-110"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; e.currentTarget.style.color = '#4ade80' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <RefreshCw size={15} />
          </button>

          <UserMenu />
        </div>
      </header>

      <DataUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={() => window.location.reload()}
      />
    </>
  )
}

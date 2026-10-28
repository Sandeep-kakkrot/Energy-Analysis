import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Building2,
  X, ChevronRight,
  Cpu, Activity, Calendar, Flame, Leaf, ClipboardList,
} from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '../../context/ThemeContext'

/* ── Nav sections ────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/',          label: 'Dashboard',       icon: LayoutDashboard, badge: null,  tooltip: 'Overview Dashboard'    },
      { to: '/buildings', label: 'Buildings',       icon: Building2,       badge: '4',   tooltip: 'Block Comparison'      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/trends/daily',   label: 'Daily Analysis',   icon: Activity,  badge: null,  tooltip: 'Daily Energy Trends'  },
      { to: '/trends/monthly', label: 'Monthly Analysis', icon: Calendar,  badge: null,  tooltip: 'Monthly Year-on-Year' },
      { to: '/peaks',          label: 'Peak Usage',       icon: Flame,     badge: null,  tooltip: 'Peak Demand Heatmap'  },
      { to: '/wastage',        label: 'Energy Wastage',   icon: Leaf,      badge: null,  tooltip: 'Wastage Indicators'   },
    ],
  },
  {
    label: 'Output',
    items: [
      { to: '/reports', label: 'Reports', icon: ClipboardList, badge: 'New', tooltip: 'Export Reports' },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const { isDark } = useTheme()

  const sideBg    = isDark
    ? 'linear-gradient(180deg, rgba(3,18,28,0.95) 0%, rgba(2,13,20,0.98) 100%)'
    : 'linear-gradient(180deg, rgba(240,250,248,0.96) 0%, rgba(232,245,243,0.98) 100%)'
  const sideBdr   = 'var(--border-color)'
  const sectionClr= 'var(--text-faint)'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'w-[64px] lg:w-[240px]',
          'border-r',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          open ? 'translate-x-0 w-[240px]' : '-translate-x-full',
        )}
        style={{
          background:   sideBg,
          borderColor:  sideBdr,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Teal top stripe ─────────────────────────── */}
        <div className="uc-stripe" />

        {/* ── Logo ──────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b"
          style={{ borderColor: sideBdr }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 animate-glow-pulse"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, #007a6e 100%)',
                boxShadow:  '0 0 18px var(--accent-glow)',
              }}
            >
              <Cpu size={16} className="text-white" />
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p
                className="text-[15px] font-black leading-none tracking-widest uppercase"
                style={{ color: 'var(--text-primary)' }}
              >
                EnergyIQ
              </p>
              <p
                className="text-[10px] mt-0.5 uppercase tracking-widest font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Campus Analytics
              </p>
            </div>
          </div>
          {/* Close — mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p
                className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.15em] hidden lg:block"
                style={{ color: sectionClr }}
              >
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, badge, tooltip }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        clsx('nav-item group', isActive && 'active')
                      }
                    >
                      {/* Icon with tooltip wrapper */}
                      <span
                        className="icon-tooltip flex-shrink-0"
                        data-tooltip={tooltip}
                      >
                        <Icon
                          size={17}
                          className="nav-icon transition-all duration-300 group-hover:scale-110"
                          style={{ color: 'inherit' }}
                        />
                      </span>

                      <span className="flex-1 truncate hidden lg:block">{label}</span>

                      {badge && (
                        <span className="nav-badge hidden lg:inline">{badge}</span>
                      )}

                      <ChevronRight
                        size={12}
                        className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5
                                   transition-all duration-200 flex-shrink-0 hidden lg:block"
                        style={{ color: 'var(--accent)' }}
                      />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Bottom system info ───────────────────── */}
        <div className="px-3 py-4 border-t" style={{ borderColor: sideBdr }}>
          <div
            className="rounded-xl p-3 hidden lg:block"
            style={{
              background: 'rgba(0,196,167,0.06)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }}
              />
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                System Online
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['Hadoop', 'Spark', 'MySQL'].map(tag => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider"
                  style={{
                    background: 'rgba(0,196,167,0.1)',
                    color:      'var(--accent-bright)',
                    border:     '1px solid rgba(0,196,167,0.2)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

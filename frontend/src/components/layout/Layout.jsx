import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'

/* ── Scroll-reveal hook ─────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('visible') },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}
export { useScrollReveal }

import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const { isDark } = useTheme()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitioning, setTransitioning] = useState(false)

  /* Page-switch animation — fast & smooth */
  useEffect(() => {
    setTransitioning(true)
    const t = setTimeout(() => {
      setDisplayChildren(children)
      setTransitioning(false)
    }, 70)
    return () => clearTimeout(t)
  }, [pathname]) // eslint-disable-line

  return (
    <div
      className={`layout-root ${isDark ? 'dark-theme' : 'light-theme'}`}
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Sidebar ────────────────────────────────────────── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Main content column ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-[240px] relative z-10">
        <Header onMenuOpen={() => setSidebarOpen(true)} />

        {/* Page content with smooth transition */}
        <main
          className="flex-1 p-5 sm:p-6 lg:p-7"
          style={{
            opacity:    transitioning ? 0 : 1,
            transform:  transitioning ? 'translateY(8px) scale(0.995)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.26s cubic-bezier(0.22,1,0.36,1), transform 0.26s cubic-bezier(0.22,1,0.36,1)',
            willChange: 'opacity, transform',
          }}
        >
          {displayChildren}
        </main>

        {/* Footer */}
        <footer
          className="px-7 py-3 flex items-center justify-between text-[11px] uppercase tracking-widest"
          style={{
            borderTop:  '1px solid var(--border-subtle)',
            color:      'var(--text-faint)',
            letterSpacing: '0.12em',
            background: 'rgba(2,13,20,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Campus Energy Analysis © 2025</span>
          <span style={{ color: 'var(--text-faint)' }}>Hadoop · Spark · MySQL · React</span>
        </footer>
      </div>
    </div>
  )
}

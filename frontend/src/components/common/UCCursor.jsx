import { useEffect, useRef } from 'react'

/**
 * UCCursor — United Carriers-inspired magnetic cursor.
 * - Small filled dot (mix-blend-mode: difference)
 * - Larger trailing ring with lag
 * - Expands on hover of interactive elements
 * - Pulses on click
 */
export default function UCCursor() {
  const dotRef  = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    const dot  = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX  = mouseX
    let ringY  = mouseY
    let rafId  = null

    /* ── Smooth ring follow with lerp ─── */
    const lerp = (a, b, t) => a + (b - a) * t

    const animate = () => {
      ringX = lerp(ringX, mouseX, 0.12)
      ringY = lerp(ringY, mouseY, 0.12)

      dot.style.left = `${mouseX}px`
      dot.style.top  = `${mouseY}px`
      ring.style.left = `${ringX}px`
      ring.style.top  = `${ringY}px`

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    /* ── Track mouse position ─── */
    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    /* ── Hover state: expand ring on interactive elements ─── */
    const HOVER_TARGETS = 'a, button, input, select, textarea, [role="button"], label, .nav-item, .chip, .card, .kpi-card, .btn-uc, .btn-blue'

    const onOver = (e) => {
      if (e.target.closest(HOVER_TARGETS)) {
        document.body.classList.add('cursor-hover')
      }
    }
    const onOut = (e) => {
      if (e.target.closest(HOVER_TARGETS)) {
        document.body.classList.remove('cursor-hover')
      }
    }

    /* ── Click state ─── */
    const onDown = () => {
      document.body.classList.add('cursor-click')
      document.body.classList.remove('cursor-hover')
    }
    const onUp = () => {
      document.body.classList.remove('cursor-click')
    }

    /* ── Visibility ─── */
    const onLeave  = () => { dot.style.opacity = '0'; ring.style.opacity = '0' }
    const onEnter  = () => { dot.style.opacity = '1'; ring.style.opacity = '1' }

    document.addEventListener('mousemove',  onMove,  { passive: true })
    document.addEventListener('mouseover',  onOver,  { passive: true })
    document.addEventListener('mouseout',   onOut,   { passive: true })
    document.addEventListener('mousedown',  onDown)
    document.addEventListener('mouseup',    onUp)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove',  onMove)
      document.removeEventListener('mouseover',  onOver)
      document.removeEventListener('mouseout',   onOut)
      document.removeEventListener('mousedown',  onDown)
      document.removeEventListener('mouseup',    onUp)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.body.classList.remove('cursor-hover', 'cursor-click')
    }
  }, [])

  return (
    <>
      <div id="uc-cursor-dot"  ref={dotRef}  aria-hidden="true" />
      <div id="uc-cursor-ring" ref={ringRef} aria-hidden="true" />
    </>
  )
}

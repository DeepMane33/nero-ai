'use client'

import { useEffect, useRef, useState } from 'react'

const TRAIL_COUNT = 5

export default function FluidCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const trailRefs = useRef<(HTMLDivElement | null)[]>([])
  const [isHovering, setIsHovering] = useState(false)
  const positions = useRef(
    Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0 }))
  )
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let ringX = 0
    let ringY = 0

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
      dot.style.left = `${e.clientX}px`
      dot.style.top = `${e.clientY}px`
    }

    const animate = () => {
      // Update trail positions (each follows the one before it)
      positions.current = positions.current.map((pos, i) => {
        const target = i === 0 ? mouse.current : positions.current[i - 1]
        const speed = 0.15 - i * 0.01
        return {
          x: pos.x + (target.x - pos.x) * speed,
          y: pos.y + (target.y - pos.y) * speed,
        }
      })

      // Update trail DOM elements
      trailRefs.current.forEach((el, i) => {
        if (!el) return
        const pos = positions.current[i]
        const scale = 1 - i * (0.8 / TRAIL_COUNT)
        const opacity = 1 - i * (0.9 / TRAIL_COUNT)
        el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(${scale})`
        el.style.opacity = `${opacity}`
      })

      // Smooth ring follow
      ringX += (mouse.current.x - ringX) * 0.15
      ringY += (mouse.current.y - ringY) * 0.15
      ring.style.left = `${ringX}px`
      ring.style.top = `${ringY}px`

      requestAnimationFrame(animate)
    }

    const onHoverStart = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.closest(
          'button, a, [role="button"], input, textarea, select, .glass-interactive, .quick-action, .dashboard-card'
        )
      ) {
        setIsHovering(true)
      }
    }

    const onHoverEnd = () => setIsHovering(false)

    document.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseover', onHoverStart, { passive: true })
    document.addEventListener('mouseout', onHoverEnd, { passive: true })
    const raf = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseover', onHoverStart)
      document.removeEventListener('mouseout', onHoverEnd)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Trail blurs */}
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { trailRefs.current[i] = el }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: `${14 - i * 2}px`,
            height: `${14 - i * 2}px`,
            borderRadius: '50%',
            background: `rgba(148, 163, 184, ${0.15 - i * 0.025})`,
            pointerEvents: 'none',
            zIndex: 10000,
            transform: 'translate(-50%, -50%)',
            willChange: 'transform',
          }}
        />
      ))}

      {/* Main dot */}
      <div ref={dotRef} className="cursor-dot" />

      {/* Ring */}
      <div ref={ringRef} className={`cursor-ring ${isHovering ? 'hover' : ''}`} />
    </>
  )
}

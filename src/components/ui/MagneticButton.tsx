'use client'

import { useRef, useState, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface MagneticButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  strength?: number
}

export default function MagneticButton({
  children,
  onClick,
  className = '',
  strength = 0.2,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const springConfig = { stiffness: 150, damping: 15 }
  const springX = useSpring(0, springConfig)
  const springY = useSpring(0, springConfig)

  // Inner content moves opposite for depth effect
  const innerX = useTransform(springX, (v) => v * -0.3)
  const innerY = useTransform(springY, (v) => v * -0.3)

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = ref.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    springX.set(x * strength)
    springY.set(y * strength)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    springX.set(0)
    springY.set(0)
  }

  return (
    <motion.button
      ref={ref}
      className={`magnetic-btn ${className}`}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      <motion.span
        style={{ x: innerX, y: innerY }}
        className="inline-flex items-center gap-2"
      >
        {children}
      </motion.span>
    </motion.button>
  )
}

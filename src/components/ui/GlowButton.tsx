'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

interface GlowButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
  type?: 'button' | 'submit'
}

const variantStyles = {
  primary: {
    background: '#000000',
    border: 'none',
    color: '#0a0a0b',
    hoverBg: '#000000',
  },
  secondary: {
    background: 'rgba(200, 205, 215, 0.03)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    hoverBg: '#0a0a0a',
  },
  danger: {
    background: 'rgba(212, 115, 110, 0.08)',
    border: '2px solid #333333',
    color: 'var(--color-error)',
    hoverBg: 'rgba(212, 115, 110, 0.12)',
  },
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-lg',
}

export default function GlowButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  icon,
  size = 'md',
  className = '',
  type = 'button',
}: GlowButtonProps) {
  const styles = variantStyles[variant]

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center font-medium tracking-tight transition-colors ${sizeStyles[size]} ${className}`}
      style={{
        background: disabled ? 'rgba(255,255,255,0.03)' : styles.background,
        border: disabled ? '1px solid var(--border-subtle)' : styles.border,
        color: disabled ? 'var(--text-muted)' : styles.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: variant === 'primary' ? 600 : 500,
      }}
      whileHover={disabled ? {} : { background: styles.hoverBg }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}

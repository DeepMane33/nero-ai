'use client'

import { motion } from 'framer-motion'

interface StatusIndicatorProps {
  status: 'online' | 'processing' | 'error' | 'offline'
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  online: { color: '#7eddd6', label: 'Online' },
  processing: { color: '#94a3b8', label: 'Processing' },
  error: { color: '#d4736e', label: 'Error' },
  offline: { color: '#555a63', label: 'Offline' },
}

const sizeMap = { sm: 6, md: 8, lg: 10 }

export default function StatusIndicator({ status, label, size = 'md' }: StatusIndicatorProps) {
  const config = statusConfig[status]
  const dotSize = sizeMap[size]
  const isActive = status === 'online' || status === 'processing'

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: dotSize + 4, height: dotSize + 4 }}>
        {isActive && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: dotSize + 4,
              height: dotSize + 4,
              border: `1px solid ${config.color}`,
              opacity: 0.25,
            }}
            animate={{
              scale: [1, 1.5, 1.5],
              opacity: [0.25, 0, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        )}
        <motion.div
          className="rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: config.color,
          }}
          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
          transition={isActive ? { duration: status === 'processing' ? 1 : 2.5, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
      </div>
      {label && (
        <span className="text-[11px] font-medium tracking-wide" style={{ color: config.color, opacity: 0.8 }}>
          {label}
        </span>
      )}
    </div>
  )
}

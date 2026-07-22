'use client'

import { motion } from 'framer-motion'

interface WaveformProps {
  isActive: boolean
  barCount?: number
  height?: number
  color?: string
}

export default function Waveform({
  isActive,
  barCount = 16,
  height = 32,
  color = '#94a3b8',
}: WaveformProps) {
  const bars = Array.from({ length: barCount }, (_, i) => i)

  return (
    <div
      className="flex items-center justify-center gap-[2px]"
      style={{ height }}
    >
      {bars.map((i) => {
        const centerDistance = Math.abs(i - barCount / 2) / (barCount / 2)
        const maxHeight = height * (1 - centerDistance * 0.4)

        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: 2.5,
              backgroundColor: color,
              opacity: isActive ? 0.7 : 0.2,
            }}
            animate={
              isActive
                ? {
                    height: [
                      maxHeight * 0.15,
                      maxHeight * (0.35 + Math.random() * 0.55),
                      maxHeight * 0.15,
                    ],
                  }
                : {
                    height: maxHeight * 0.1,
                  }
            }
            transition={
              isActive
                ? {
                    duration: 0.45 + Math.random() * 0.25,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: i * 0.025,
                  }
                : {
                    duration: 0.4,
                    ease: 'easeOut',
                  }
            }
          />
        )
      })}
    </div>
  )
}

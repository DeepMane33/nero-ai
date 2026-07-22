'use client'

import { motion } from 'framer-motion'
import type { Mood } from '@/lib/sentiment'
import { MOOD_COLORS } from '@/lib/sentiment'

interface AICoreProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'researching' | 'generating'
  size?: number
  mood?: Mood | null
}

const stateConfig = {
  idle: { color: '#94a3b8', pulseDuration: 3, label: 'Ready' },
  listening: { color: '#94a3b8', pulseDuration: 1.2, label: 'Listening' },
  thinking: { color: '#7ec8e3', pulseDuration: 1.5, label: 'Thinking' },
  speaking: { color: '#7eddd6', pulseDuration: 0.8, label: 'Speaking' },
  researching: { color: '#b4a0d4', pulseDuration: 1.8, label: 'Researching' },
  generating: { color: '#c8b86a', pulseDuration: 1.0, label: 'Generating' },
}

export default function AICore({ state = 'idle', size = 160, mood = null }: AICoreProps) {
  const baseConfig = stateConfig[state]

  const moodColor = mood ? MOOD_COLORS[mood] : null
  const color = (state === 'idle' && moodColor) ? moodColor.primary : baseConfig.color
  const pulseDuration = baseConfig.pulseDuration

  const center = size / 2
  const coreRadius = size * 0.1
  const ring1Radius = size * 0.2
  const ring2Radius = size * 0.32

  // Cool silver gradient colors
  const glowColor1 = '#94a3b8'
  const glowColor2 = '#7ec8e3'
  const glowColor3 = '#b4a0d4'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer ambient glow — warm rose */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.75,
          height: size * 0.75,
          background: `radial-gradient(circle, ${color}18, ${color}08, transparent 70%)`,
          filter: 'blur(12px)',
        }}
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: pulseDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Mood aura */}
      {mood && state === 'idle' && moodColor && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size * 0.85,
            height: size * 0.85,
            background: `radial-gradient(circle, ${moodColor.glow}, transparent 60%)`,
          }}
          animate={{
            scale: [0.97, 1.04, 0.97],
            opacity: [0.12, 0.3, 0.12],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Glass ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.75,
          height: size * 0.75,
          border: '1px solid rgba(148, 163, 184, 0.06)',
          background: 'radial-gradient(circle, rgba(148, 163, 184, 0.02), transparent 60%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        animate={{
          scale: [1, 1.02, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: pulseDuration * 4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/* Warm rose core gradient */}
          <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="25%" stopColor={glowColor1} stopOpacity="0.6" />
            <stop offset="55%" stopColor={glowColor2} stopOpacity="0.3" />
            <stop offset="100%" stopColor={glowColor3} stopOpacity="0.05" />
          </radialGradient>

          {/* Core glow filter */}
          <filter id="coreGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Glass highlight — rose tinted */}
          <linearGradient id="glassHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(148, 163, 184, 0.06)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.01)" />
            <stop offset="100%" stopColor="rgba(136, 152, 184, 0.04)" />
          </linearGradient>
        </defs>

        {/* Glass highlight overlay */}
        <motion.circle
          cx={center}
          cy={center}
          r={ring2Radius + 2}
          fill="url(#glassHighlight)"
          opacity={0.3}
          animate={{
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: pulseDuration * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Outer ring — slow orbit */}
        <motion.circle
          cx={center}
          cy={center}
          r={ring2Radius}
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          strokeDasharray={state === 'thinking' ? '4 6' : '2 8'}
          strokeOpacity="0.2"
          animate={{ rotate: state === 'thinking' ? 360 : 360 }}
          transition={{
            duration: state === 'thinking' ? 10 : 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {/* Middle ring — dashed */}
        <motion.circle
          cx={center}
          cy={center}
          r={ring1Radius + 4}
          fill="none"
          stroke={color}
          strokeWidth="0.4"
          strokeDasharray="1 10"
          strokeOpacity="0.15"
          animate={{ rotate: -360 }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {/* Inner ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={ring1Radius}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          strokeOpacity="0.2"
          animate={{ rotate: -360 }}
          transition={{
            duration: state === 'thinking' ? 6 : 15,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {/* Orbiting dots — warm rose */}
        {state !== 'idle' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={`dot-${i}`}
                cx={center}
                cy={center - ring2Radius}
                r="2"
                fill={color}
                opacity="0.6"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 1.33,
                }}
                style={{ transformOrigin: `${center}px ${center}px` }}
              />
            ))}
          </>
        )}

        {/* Core orb — the glowing center */}
        <motion.circle
          cx={center}
          cy={center}
          r={coreRadius}
          fill="url(#coreGradient)"
          filter="url(#coreGlow)"
          animate={{
            r: [coreRadius, coreRadius * 1.1, coreRadius],
          }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Inner core highlight */}
        <motion.circle
          cx={center - coreRadius * 0.25}
          cy={center - coreRadius * 0.25}
          r={coreRadius * 0.35}
          fill="rgba(255,255,255,0.2)"
          animate={{
            opacity: [0.12, 0.3, 0.12],
          }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>
    </div>
  )
}

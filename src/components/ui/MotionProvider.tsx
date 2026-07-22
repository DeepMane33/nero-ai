'use client'

import { MotionConfig } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  const { animationsEnabled } = useTheme()

  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
      {children}
    </MotionConfig>
  )
}

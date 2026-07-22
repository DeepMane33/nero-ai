'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface ThemeContextType {
  mode: 'dark'
  toggleTheme: () => void
  setMode: (mode: 'dark') => void
  accentColor: string
  setAccentColor: (color: string) => void
  glowEnabled: boolean
  setGlowEnabled: (enabled: boolean) => void
  animationsEnabled: boolean
  setAnimationsEnabled: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
  setMode: () => {},
  accentColor: '#c0c0c0',
  setAccentColor: () => {},
  glowEnabled: true,
  setGlowEnabled: () => {},
  animationsEnabled: true,
  setAnimationsEnabled: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColor] = useState('#c0c0c0')
  const [glowEnabled, setGlowEnabled] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Force silver theme — clear any old accent color from localStorage
    const saved = localStorage.getItem('nero-settings')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        // Delete old accent color to force silver
        if (s.theme) delete s.theme.accentColor
        localStorage.setItem('nero-settings', JSON.stringify(s))
        if (s.theme?.glowEnabled !== undefined) setGlowEnabled(s.theme.glowEnabled)
        if (s.theme?.animationsEnabled !== undefined) setAnimationsEnabled(s.theme.animationsEnabled)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add('dark')
    root.style.setProperty('--accent', accentColor)
    if (glowEnabled) {
      root.classList.remove('no-glow')
    } else {
      root.classList.add('no-glow')
    }
    if (animationsEnabled) {
      root.classList.remove('no-animations')
    } else {
      root.classList.add('no-animations')
    }
    const saved = JSON.parse(localStorage.getItem('nero-settings') || '{}')
    saved.theme = { ...saved.theme, mode: 'dark', accentColor: '#c0c0c0', glowEnabled, animationsEnabled }
    localStorage.setItem('nero-settings', JSON.stringify(saved))
  }, [accentColor, glowEnabled, animationsEnabled, mounted])

  const toggleTheme = () => {}
  const setMode = () => {}

  return (
    <ThemeContext.Provider value={{ mode: 'dark', toggleTheme, setMode, accentColor, setAccentColor, glowEnabled, setGlowEnabled, animationsEnabled, setAnimationsEnabled }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

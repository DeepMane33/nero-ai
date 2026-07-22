import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/contexts/ThemeContext'
import MotionProvider from '@/components/ui/MotionProvider'
import BootPreloader from '@/components/ui/BootPreloader'
import FluidCursor from '@/components/ui/FluidCursor'
import ScrollProgress from '@/components/ui/ScrollProgress'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nero AI',
  description: 'Premium Personal AI Operating System — Cool, Intelligent, Alive',
  keywords: ['AI', 'agent', 'nero', 'personal AI', 'premium UI', 'operating system'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full`} suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
        suppressHydrationWarning
      >
        {/* Boot preloader */}
        <BootPreloader />

        {/* Scroll progress bar */}
        <ScrollProgress />

        {/* Fluid cursor with trailing blur (desktop only) */}
        <FluidCursor />

        {/* Aurora gradient layer — cool silver cinematic glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(160, 184, 208, 0.025) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(136, 152, 184, 0.015) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(176, 184, 196, 0.008) 0%, transparent 70%)',
          }}
        />

        {/* Subtle animated particles — cool silver tones */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: 'rgba(176, 184, 196, 0.2)',
                boxShadow: '0 0 6px rgba(176, 184, 196, 0.1)',
                left: `${10 + (i * 7.5) % 90}%`,
                top: `${15 + (i * 11.3) % 75}%`,
                animation: `particle-drift ${8 + (i % 5) * 2}s linear infinite`,
                animationDelay: `${i * -1.5}s`,
                '--dx': `${(i % 3 - 1) * 40}px`,
                '--dy': `${-50 - (i % 4) * 20}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Subtle noise texture overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.012,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />

        {/* Content layer */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', flex: 1 }}>
          <ThemeProvider>
            <MotionProvider>
              <ToastProvider>{children}</ToastProvider>
            </MotionProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}

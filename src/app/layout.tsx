import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/contexts/ThemeContext'
import MotionProvider from '@/components/ui/MotionProvider'
import BootPreloader from '@/components/ui/BootPreloader'
import ScrollProgress from '@/components/ui/ScrollProgress'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NERO',
  description: 'NERO AI Operating System',
  keywords: ['AI', 'agent', 'nero', 'personal AI', 'brutalist'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
        suppressHydrationWarning
      >
        <BootPreloader />
        <ScrollProgress />

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

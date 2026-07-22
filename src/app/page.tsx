'use client'

import { useState, useCallback, lazy, Suspense, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/layout/Sidebar'
import AICore from '@/components/ui/AICore'
import { getAuthHeaders } from '@/lib/user-id'
import ConversationSidebar from '@/components/chat/ConversationSidebar'
import ActivityFeed from '@/components/activity/ActivityFeed'

import ShortcutsModal from '@/components/ui/ShortcutsModal'
import NotificationCenter from '@/components/ui/NotificationCenter'
import OnboardingFlow, { hasCompletedOnboarding } from '@/components/onboarding/OnboardingFlow'
import { useTheme } from '@/contexts/ThemeContext'
import type { Mood } from '@/lib/sentiment'

// Lazy-loaded page components for code-splitting
const ChatInterface = lazy(() => import('@/components/chat/ChatInterface'))
const MemoryCenter = lazy(() => import('@/components/memory/MemoryCenter'))
const ResearchMode = lazy(() => import('@/components/research/ResearchMode'))
const KnowledgeGraph = lazy(() => import('@/components/knowledge/KnowledgeGraph'))
const ProjectsWorkspace = lazy(() => import('@/components/projects/ProjectsWorkspace'))
const SettingsPanel = lazy(() => import('@/components/SettingsPanel'))


type ActivePage = 'home' | 'chat' | 'research' | 'memory' | 'projects' | 'settings' | 'knowledge' | 'activity'
type AIState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'researching' | 'generating'

const pageLabels: Record<ActivePage, string> = {
  home: 'Home',
  chat: 'Nero Chat',
  research: 'Nero Research',
  memory: 'Nero Memory',
  projects: 'Nero Projects',
  settings: 'Settings',
  knowledge: 'Nero Knowledge',
  activity: 'Activity',
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner" />
        <span className="text-xs tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Loading...
        </span>
      </div>
    </div>
  )
}

// ── Dashboard Home — SilverSoft Design ──
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const QUICK_ACTIONS = [
  { id: 'chat', label: 'Chat', shortcut: 'Ctrl+Shift+K', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'research', label: 'Research', shortcut: '', icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35' },
  { id: 'memory', label: 'Memory', shortcut: '', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 6v2 M12 16v2 M6 12h2 M16 12h2' },
  { id: 'knowledge', label: 'Knowledge', shortcut: '', icon: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z' },
  { id: 'projects', label: 'Projects', shortcut: '', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' },
  { id: 'settings', label: 'Settings', shortcut: '', icon: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' },
  { id: 'activity', label: 'Activity', shortcut: '', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
]

const STATUS_MAP: Record<AIState, { label: string; status: 'online' | 'processing' | 'error' }> = {
  idle: { label: 'Ready', status: 'online' },
  listening: { label: 'Listening', status: 'processing' },
  thinking: { label: 'Thinking', status: 'processing' },
  speaking: { label: 'Speaking', status: 'processing' },
  researching: { label: 'Researching', status: 'processing' },
  generating: { label: 'Generating', status: 'processing' },
}

function DashboardHome({
  onNavigate,
  onStartChat,
}: {
  onNavigate: (page: ActivePage) => void
  onStartChat: () => void
}) {
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string; preview?: string; time: string }>>([])
  const [quickPrompt, setQuickPrompt] = useState('')
  const [greeting, setGreeting] = useState('Hello')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Fetch user's name from memory
    fetch('/api/memory?q=name', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const memories = data.memories || []
        const nameMemory = memories.find((m: any) => m.category === 'identity' && m.key === 'identity')
        if (nameMemory) {
          setUserName(nameMemory.value)
          setGreeting(`${getGreeting()}, ${nameMemory.value}`)
        } else {
          setGreeting(getGreeting())
        }
      })
      .catch(() => setGreeting(getGreeting()))

    fetch('/api/conversations?limit=4', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const convs = (data.conversations || data || []).slice(0, 4).map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled',
          preview: c.preview || '',
          time: getRelativeTime(c.last_message_at || c.created_at),
        }))
        setRecentChats(convs)
      })
      .catch(() => {})
  }, [])

  const handleQuickPrompt = () => {
    if (!quickPrompt.trim()) return
    onStartChat()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto relative">
      {/* Soft vignette background — no grid, no floating orbs */}
      <div className="silver-vignette" />

      <div className="max-w-5xl mx-auto w-full px-8 py-10 relative z-10">

        {/* ── Section 1: Greeting — Left-aligned, personal ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="mb-10"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {greeting}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              What would you like to work on?
            </p>
          </div>
        </motion.div>

        {/* ── Section 2: Quick Prompt Bar — replaces dead zones ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.4, 0, 0.2, 1] }}
          className="mb-10"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-text"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onClick={() => document.getElementById('home-quick-prompt')?.focus()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="home-quick-prompt"
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickPrompt() }}
              placeholder="Ask Nero anything..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {quickPrompt && (
              <button
                onClick={handleQuickPrompt}
                className="text-[11px] font-medium px-3 py-1 rounded-md"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}
              >
                Ask
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Section 3: Quick Actions — Horizontal action dock ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.4, 0, 0.2, 1] }}
          className="mb-10"
        >
          <h2 className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            Tools
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.id}
                className="neu-card flex flex-col items-center gap-4 cursor-pointer"
                style={{ padding: '36px 24px' }}
                onClick={() => {
                  if (action.id === 'chat') onStartChat()
                  else onNavigate(action.id as ActivePage)
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -3 }}
              >
                <div className="neu-flat flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 16 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={action.icon} />
                  </svg>
                </div>
                <span className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: Recent Activity ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          <h2 className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            Recent Activity
          </h2>
          <div className="flex flex-col gap-1.5">
            {recentChats.length > 0 ? recentChats.map((chat, i) => (
              <motion.button
                key={chat.id}
                className="silver-card flex items-center gap-3 text-left"
                onClick={() => onNavigate('chat')}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.2 + i * 0.04 }}
                whileTap={{ scale: 0.99 }}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{
                    background: 'rgba(176, 184, 196, 0.06)',
                    border: '1px solid rgba(176, 184, 196, 0.08)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{chat.title}</div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{chat.time}</span>
              </motion.button>
            )) : (
              <div className="silver-card flex flex-col gap-3 py-6">
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v4l3 3" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No recent activity</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Your conversations and actions will appear here</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return diffMin + 'm ago'
  if (diffHr < 24) return diffHr + 'h ago'
  if (diffDay < 7) return diffDay + 'd ago'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivePageContent({
  activePage,
  activeConversationId,
  onSelectConversation,
  onSelectBrain,
  selectedBrain,
  onMoodChange,
  onNavigate,
  onStartChat,
}: {
  activePage: ActivePage
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onSelectBrain: (brainId: string) => void
  selectedBrain: string | null
  onMoodChange: () => void
  onNavigate: (page: ActivePage) => void
  onStartChat: () => void
}) {
  switch (activePage) {
    case 'home':
      return <DashboardHome onNavigate={onNavigate} onStartChat={onStartChat} />
    case 'chat':
      return (
        <ChatInterface
          activeConversationId={activeConversationId}
          onConversationCreated={onSelectConversation}
          defaultBrain={selectedBrain}
          onMoodChange={onMoodChange}
        />
      )
    case 'research':
      return <ResearchMode />
    case 'memory':
      return <MemoryCenter />
    case 'knowledge':
      return <KnowledgeGraph />
    case 'projects':
      return <ProjectsWorkspace />
    case 'activity':
      return <ActivityFeed />
    case 'settings':
      return <SettingsPanel />
    default:
      return <PlaceholderPage page={pageLabels[activePage]} />
  }
}

function PlaceholderPage({ page }: { page: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div style={{ opacity: 0.15 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
          {page}
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This module is under development
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const { toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activePage, setActivePage] = useState<ActivePage>('home')
  const [aiState, setAiState] = useState<AIState>('idle')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showConversationSidebar, setShowConversationSidebar] = useState(false)
  const [selectedBrainForChat, setSelectedBrainForChat] = useState<string | null>(null)
  const [currentMood, setCurrentMood] = useState<Mood | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!hasCompletedOnboarding()) {
      setShowOnboarding(true)
    }
  }, [])

  const fetchMood = useCallback(async () => {
    try {
      const res = await fetch('/api/mood')
      if (res.ok) {
        const data = await res.json()
        if (data.current?.mood) {
          setCurrentMood(data.current.mood as Mood)
        }
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchMood()
    const interval = setInterval(fetchMood, 15000)
    return () => clearInterval(interval)
  }, [fetchMood])

  const VALID_PAGES: ActivePage[] = ['home', 'chat', 'research', 'memory', 'projects', 'settings', 'knowledge', 'activity']
  const handleNavigate = useCallback((route: string) => {
    if (VALID_PAGES.includes(route as ActivePage)) {
      setActivePage(route as ActivePage)
    }
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
    setActivePage('chat')
  }, [])

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null)
    setSelectedBrainForChat(null)
    setActivePage('chat')
  }, [])

  const handleSelectBrain = useCallback((brainId: string) => {
    setSelectedBrainForChat(brainId)
    setActiveConversationId(null)
    setActivePage('chat')
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setShowConversationSidebar(prev => !prev)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        handleNewChat()
      }
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        setShowShortcuts(true)
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        toggleTheme()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat, toggleTheme])

  const showConvSidebar = activePage === 'chat' && showConversationSidebar
  const statusInfo = STATUS_MAP[aiState]

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <div className="silver-vignette" />
      <div className="grid-bg" />

      {/* Main navigation sidebar */}
      <Sidebar
        activeRoute={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewChat={handleNewChat}
      />

      {/* Conversation sidebar */}
      <AnimatePresence>
        {showConvSidebar && (
          <ConversationSidebar
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            isVisible={showConvSidebar}
            onToggle={() => setShowConversationSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        {/* Glass header bar */}
        <header
          className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0 glass-header"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Left */}
          <div className="flex items-center gap-3">
            {activePage === 'chat' && (
              <motion.button
                onClick={() => setShowConversationSidebar(prev => !prev)}
                className="flex items-center justify-center w-7 h-7 rounded-md"
                style={{
                  background: showConversationSidebar ? 'rgba(148, 163, 184, 0.08)' : 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: showConversationSidebar ? 'var(--accent)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
                whileHover={{ borderColor: 'var(--border-hover)' }}
                whileTap={{ scale: 0.95 }}
                title="Toggle conversation history (Ctrl+K)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </motion.button>
            )}
            <AnimatePresence mode="wait">
              <motion.h1
                key={activePage}
                className="text-[13px] font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
              >
                {pageLabels[activePage]}
              </motion.h1>
            </AnimatePresence>
          </div>

          {/* Center: empty — status lives in sidebar */}

          {/* Right */}
          <div className="flex items-center gap-3">
            <NotificationCenter />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              className="absolute inset-0"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <Suspense fallback={<PageLoader />}>
                <ActivePageContent
                  activePage={activePage}
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onSelectBrain={handleSelectBrain}
                  selectedBrain={selectedBrainForChat}
                  onMoodChange={fetchMood}
                  onNavigate={handleNavigate}
                  onStartChat={handleNewChat}
                />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Keyboard shortcuts modal */}
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Onboarding flow */}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}

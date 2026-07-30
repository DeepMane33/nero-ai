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

const ChatInterface = lazy(() => import('@/components/chat/ChatInterface'))
const MemoryCenter = lazy(() => import('@/components/memory/MemoryCenter'))
const ResearchMode = lazy(() => import('@/components/research/ResearchMode'))
const KnowledgeGraph = lazy(() => import('@/components/knowledge/KnowledgeGraph'))
const ProjectsWorkspace = lazy(() => import('@/components/projects/ProjectsWorkspace'))
const SettingsPanel = lazy(() => import('@/components/SettingsPanel'))

type ActivePage = 'home' | 'chat' | 'research' | 'memory' | 'projects' | 'settings' | 'knowledge' | 'activity'
type AIState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'researching' | 'generating'

const pageLabels: Record<ActivePage, string> = {
  home: 'HOME', chat: 'CHAT', research: 'RESEARCH', memory: 'MEMORY',
  projects: 'PROJECTS', settings: 'SETTINGS', knowledge: 'KNOWLEDGE', activity: 'ACTIVITY',
}

const pageVariants = { initial: { opacity: 0 }, enter: { opacity: 1 }, exit: { opacity: 0 } }

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner" />
        <span className="text-[11px] tracking-wider font-mono" style={{ color: '#808080', fontFamily: 'var(--font-mono)' }}>LOADING</span>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'GOOD MORNING'
  if (hour < 17) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

const QUICK_ACTIONS = [
  { id: 'chat', label: 'CHAT', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'research', label: 'RESEARCH', icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35' },
  { id: 'memory', label: 'MEMORY', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 6v2 M12 16v2 M6 12h2 M16 12h2' },
  { id: 'knowledge', label: 'KNOWLEDGE', icon: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z' },
  { id: 'projects', label: 'PROJECTS', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' },
  { id: 'activity', label: 'ACTIVITY', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
]

function DashboardHome({ onNavigate, onStartChat }: { onNavigate: (page: ActivePage) => void; onStartChat: () => void }) {
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string; preview?: string; time: string }>>([])
  const [quickPrompt, setQuickPrompt] = useState('')
  const [greeting, setGreeting] = useState('HELLO')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    fetch('/api/memory?q=name', { headers: getAuthHeaders() })
      .then(r => r.json()).then(data => {
        const memories = data.memories || []
        const nameMemory = memories.find((m: any) => m.category === 'identity' && m.key === 'identity')
        if (nameMemory) { setUserName(nameMemory.value); setGreeting(`${getGreeting()}, ${nameMemory.value.toUpperCase()}`) }
        else setGreeting(getGreeting())
      }).catch(() => setGreeting(getGreeting()))
    fetch('/api/conversations?limit=4', { headers: getAuthHeaders() })
      .then(r => r.json()).then(data => {
        const convs = (data.conversations || data || []).slice(0, 4).map((c: any) => ({
          id: c.id, title: c.title || 'UNTITLED', preview: c.preview || '', time: getRelativeTime(c.last_message_at || c.created_at),
        }))
        setRecentChats(convs)
      }).catch(() => {})
  }, [])

  const handleQuickPrompt = () => { if (!quickPrompt.trim()) return; onStartChat() }

  return (
    <div className="flex flex-col h-full overflow-y-auto relative">
      <div className="grid-bg" />
      <div className="max-w-5xl mx-auto w-full px-8 py-10 relative z-10">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>{greeting}</h1>
          <p className="text-sm mt-2 font-mono" style={{ color: '#808080' }}>WHAT WOULD YOU LIKE TO WORK ON?</p>
        </motion.div>

        {/* Quick Prompt */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.05 }} className="mb-10">
          <div className="flex items-center gap-3 px-4 py-3 border-[3px] cursor-text" style={{ background: '#000000', borderColor: '#333333' }}
            onClick={() => document.getElementById('home-quick-prompt')?.focus()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="square">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input id="home-quick-prompt" type="text" value={quickPrompt} onChange={(e) => setQuickPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickPrompt() }}
              placeholder="ASK NERO ANYTHING" className="flex-1 bg-transparent text-sm outline-none font-mono" style={{ color: '#ffffff' }}/>
            {quickPrompt && (
              <button onClick={handleQuickPrompt} className="text-[11px] font-bold px-3 py-1 font-mono" style={{ background: '#ffffff', color: '#000000', cursor: 'pointer', border: 'none' }}>
                ASK
              </button>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.08 }} className="mb-10">
          <h2 className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3 font-mono" style={{ color: '#808080' }}>TOOLS</h2>
          <div className="grid grid-cols-3 gap-0">
            {QUICK_ACTIONS.map((action, i) => (
              <motion.button key={action.id} className="flex flex-col items-center gap-3 cursor-pointer"
                style={{ padding: '28px 20px', background: '#050505', border: '2px solid #333333' }}
                onClick={() => { if (action.id === 'chat') onStartChat(); else onNavigate(action.id as ActivePage) }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 + i * 0.03 }}
                whileHover={{ borderColor: '#ffffff', background: '#0a0a0a' }} whileTap={{ scale: 0.97 }}>
                <div className="flex items-center justify-center" style={{ width: 56, height: 56, border: '2px solid #333333' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="square">
                    <path d={action.icon}/>
                  </svg>
                </div>
                <span className="text-[11px] font-bold font-mono tracking-wider" style={{ color: '#808080' }}>{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.12 }}>
          <h2 className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3 font-mono" style={{ color: '#808080' }}>RECENT ACTIVITY</h2>
          <div className="flex flex-col gap-0">
            {recentChats.length > 0 ? recentChats.map((chat, i) => (
              <motion.button key={chat.id} className="flex items-center gap-3 text-left w-full cursor-pointer"
                style={{ padding: '12px 16px', background: '#050505', borderBottom: '2px solid #333333' }}
                onClick={() => onNavigate('chat')}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: 0.14 + i * 0.03 }}
                whileHover={{ borderLeft: '3px solid #ffffff' }}>
                <div className="flex items-center justify-center w-8 h-8 flex-shrink-0" style={{ border: '2px solid #333333' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="square">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold truncate font-mono" style={{ color: '#c0c0c0' }}>{chat.title}</div>
                </div>
                <span className="text-[10px] flex-shrink-0 font-mono" style={{ color: '#505050' }}>{chat.time}</span>
              </motion.button>
            )) : (
              <div style={{ padding: '24px 16px', background: '#050505', border: '2px solid #333333' }}>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="square">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                  <span className="text-[12px] font-mono" style={{ color: '#808080' }}>NO RECENT ACTIVITY</span>
                </div>
                <p className="text-[10px] mt-2 font-mono" style={{ color: '#505050' }}>YOUR CONVERSATIONS AND ACTIONS WILL APPEAR HERE</p>
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
  const now = new Date(); const date = new Date(dateStr); const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000); const diffHr = Math.floor(diffMs / 3600000); const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'NOW'; if (diffMin < 60) return diffMin + 'M AGO'; if (diffHr < 24) return diffHr + 'H AGO'
  if (diffDay < 7) return diffDay + 'D AGO'; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivePageContent({ activePage, activeConversationId, onSelectConversation, onSelectBrain, selectedBrain, onMoodChange, onNavigate, onStartChat }: {
  activePage: ActivePage; activeConversationId: string | null; onSelectConversation: (id: string) => void
  onSelectBrain: (brainId: string) => void; selectedBrain: string | null; onMoodChange: () => void
  onNavigate: (page: ActivePage) => void; onStartChat: () => void
}) {
  switch (activePage) {
    case 'home': return <DashboardHome onNavigate={onNavigate} onStartChat={onStartChat} />
    case 'chat': return <ChatInterface activeConversationId={activeConversationId} onConversationCreated={onSelectConversation} defaultBrain={selectedBrain} onMoodChange={onMoodChange} />
    case 'research': return <ResearchMode />
    case 'memory': return <MemoryCenter />
    case 'knowledge': return <KnowledgeGraph />
    case 'projects': return <ProjectsWorkspace />
    case 'activity': return <ActivityFeed />
    case 'settings': return <SettingsPanel />
    default: return <PlaceholderPage page={pageLabels[activePage]} />
  }
}

function PlaceholderPage({ page }: { page: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div style={{ opacity: 0.3 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="square">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-sm font-bold mb-1 font-mono" style={{ color: '#808080' }}>{page}</h2>
        <p className="text-[11px] font-mono" style={{ color: '#505050' }}>UNDER DEVELOPMENT</p>
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

  useEffect(() => { setMounted(true); if (!hasCompletedOnboarding()) setShowOnboarding(true) }, [])

  const fetchMood = useCallback(async () => {
    try { const res = await fetch('/api/mood'); if (res.ok) { const data = await res.json(); if (data.current?.mood) setCurrentMood(data.current.mood as Mood) } } catch {}
  }, [])

  useEffect(() => { fetchMood(); const interval = setInterval(fetchMood, 15000); return () => clearInterval(interval) }, [fetchMood])

  const VALID_PAGES: ActivePage[] = ['home', 'chat', 'research', 'memory', 'projects', 'settings', 'knowledge', 'activity']
  const handleNavigate = useCallback((route: string) => { if (VALID_PAGES.includes(route as ActivePage)) setActivePage(route as ActivePage) }, [])
  const handleSelectConversation = useCallback((id: string) => { setActiveConversationId(id); setActivePage('chat') }, [])
  const handleNewChat = useCallback(() => { setActiveConversationId(null); setSelectedBrainForChat(null); setActivePage('chat') }, [])
  const handleSelectBrain = useCallback((brainId: string) => { setSelectedBrainForChat(brainId); setActiveConversationId(null); setActivePage('chat') }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setShowConversationSidebar(prev => !prev) }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') { e.preventDefault(); handleNewChat() }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowShortcuts(true) }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); toggleTheme() }
    }
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat, toggleTheme])

  const showConvSidebar = activePage === 'chat' && showConversationSidebar

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#000000' }}>
      <div className="grid-bg" />

      <Sidebar activeRoute={activePage} onNavigate={handleNavigate} collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onNewChat={handleNewChat} />

      <AnimatePresence>
        {showConvSidebar && (
          <ConversationSidebar activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat} isVisible={showConvSidebar} onToggle={() => setShowConversationSidebar(false)} />
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ background: '#000000', borderBottom: '3px solid #333333' }}>
          <div className="flex items-center gap-3">
            {activePage === 'chat' && (
              <motion.button onClick={() => setShowConversationSidebar(prev => !prev)}
                className="flex items-center justify-center w-7 h-7" style={{
                  background: showConversationSidebar ? '#0a0a0a' : 'transparent',
                  border: '2px solid #333333', color: showConversationSidebar ? '#ffffff' : '#808080', cursor: 'pointer'
                }} whileHover={{ borderColor: '#ffffff' }} whileTap={{ scale: 0.95 }} title="Toggle (Ctrl+K)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                  <rect x="3" y="3" width="18" height="18" rx="0"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </motion.button>
            )}
            <AnimatePresence mode="wait">
              <motion.h1 key={activePage} className="text-[12px] font-bold tracking-wider font-mono" style={{ color: '#ffffff' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                {pageLabels[activePage]}
              </motion.h1>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} className="absolute inset-0" variants={pageVariants}
              initial="initial" animate="enter" exit="exit" transition={{ duration: 0.15 }}>
              <Suspense fallback={<PageLoader />}>
                <ActivePageContent activePage={activePage} activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation} onSelectBrain={handleSelectBrain}
                  selectedBrain={selectedBrainForChat} onMoodChange={fetchMood}
                  onNavigate={handleNavigate} onStartChat={handleNewChat} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
    </div>
  )
}

'use client'

import { useState, useEffect, type ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAuthHeaders } from '@/lib/user-id'

interface SidebarProps {
  activeRoute?: string
  onNavigate?: (route: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNewChat?: () => void
}

interface NavItem {
  id: string
  label: string
  icon: ReactElement
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'research',
    label: 'Research',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
    ),
  },

  {
    id: 'memory',
    label: 'Memory',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 6v2" />
        <path d="M12 16v2" />
        <path d="M6 12h2" />
        <path d="M16 12h2" />
      </svg>
    ),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },

  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" />
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <line x1="8" y1="7" x2="10" y2="10" />
        <line x1="16" y1="7" x2="14" y2="10" />
        <line x1="8" y1="17" x2="10" y2="14" />
        <line x1="16" y1="17" x2="14" y2="14" />
      </svg>
    ),
  },

  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export default function Sidebar({
  activeRoute = 'home',
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  onNewChat,
}: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [recentChats, setRecentChats] = useState<Array<{ id: string; title: string }>>([])
  const [newsCount, setNewsCount] = useState(0)
  const [isRefreshingNews, setIsRefreshingNews] = useState(false)

  useEffect(() => {
    fetch('/api/conversations?limit=5', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const convs = (data.conversations || data || []).slice(0, 5).map((c: any) => ({
          id: c.id,
          title: c.title || 'Untitled',
        }))
        setRecentChats(convs)
      })
      .catch(() => {})

    fetch('/api/news?action=status')
      .then(r => r.json())
      .then(data => setNewsCount(data.todayCount || 0))
      .catch(() => {})
  }, [activeRoute])

  const handleRefreshNews = async () => {
    if (isRefreshingNews) return
    setIsRefreshingNews(true)
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const data = await res.json()
      setNewsCount(data.totalArticles || 0)
    } catch {}
    setIsRefreshingNews(false)
  }

  const navWidth = collapsed ? 64 : 240

  return (
    <motion.aside
      className="relative flex flex-col h-full flex-shrink-0 neu-raised"
      style={{
        borderRadius: 0,
      }}
      animate={{ width: navWidth }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '2px solid #333333' }}>
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-xl neu-flat"
          style={{
            width: 34,
            height: 34,
          }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>N</span>
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Nero
              </div>
              <div className="text-[10px] tracking-wide" style={{ color: 'var(--text-muted)' }}>
                AI Operating System
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = activeRoute === item.id
            const isHovered = hoveredItem === item.id

            return (
              <li key={item.id}>
                <motion.button
                  className={`relative flex items-center w-full transition-colors ${isActive ? 'neu-flat' : ''}`}
                  style={{
                    padding: collapsed ? '9px' : '9px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? undefined : isHovered ? 'rgba(200, 210, 224, 0.03)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => onNavigate?.(item.id)}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Neon blue active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                      style={{
                        width: 3,
                        height: 20,
                        background: 'var(--accent)',
                        boxShadow: '0 0 10px rgba(148, 163, 184, 0.5), 0 0 20px rgba(148, 163, 184, 0.2)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <span className="flex-shrink-0" style={{ opacity: isActive ? 1 : 0.5 }}>
                    {item.icon}
                  </span>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        className="text-[13px] whitespace-nowrap"
                        style={{ fontWeight: isActive ? 500 : 400 }}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for collapsed state */}
                  {collapsed && isHovered && (
                    <motion.div
                      className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs whitespace-nowrap z-50"
                      style={{
                        background: '#000000',


                        border: '2px solid #333333',
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(148, 163, 184, 0.06)',
                      }}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                    >
                      {item.label}
                    </motion.div>
                  )}
                </motion.button>
              </li>
            )
          })}
        </ul>

        {/* Recent Chats section */}
        {!collapsed && recentChats.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '2px solid #333333' }}>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
                Recent
              </span>
              <motion.button
                onClick={onNewChat}
                className="flex items-center justify-center w-5 h-5 rounded"
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                whileHover={{ color: 'var(--accent)', background: 'var(--accent-subtle)' }}
                whileTap={{ scale: 0.9 }}
                title="New Chat"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.button>
            </div>
            <ul className="flex flex-col gap-0.5">
              {recentChats.map((chat) => (
                <li key={chat.id}>
                  <motion.button
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-left"
                    style={{
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                    whileHover={{
                      background: '#0a0a0a',
                      color: 'var(--text-secondary)',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onNavigate?.('chat')
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-[12px] truncate">{chat.title}</span>
                  </motion.button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3" style={{ borderTop: '2px solid #333333' }}>
        {!collapsed && (
          <motion.button
            onClick={handleRefreshNews}
            disabled={isRefreshingNews}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left"
            style={{
              color: isRefreshingNews ? 'var(--text-muted)' : 'var(--text-tertiary)',
              cursor: isRefreshingNews ? 'wait' : 'pointer',
              fontSize: '11px',
            }}
            whileHover={!isRefreshingNews ? {
              background: '#0a0a0a',
              color: 'var(--accent)',
            } : undefined}
            whileTap={!isRefreshingNews ? { scale: 0.98 } : undefined}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                flexShrink: 0,
                animation: isRefreshingNews ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>
              {isRefreshingNews ? 'Refreshing news...' : `News: ${newsCount} articles today`}
            </span>
          </motion.button>
        )}
      </div>

      {/* Collapse toggle — neumorphic */}
      <motion.button
        className="absolute top-4 -right-3 flex items-center justify-center rounded-full z-10 neu-btn"
        style={{
          width: 22,
          height: 22,
          padding: 0,
          color: 'var(--text-tertiary)',
        }}
        onClick={onToggleCollapse}
        whileHover={{
          background: 'rgba(10, 10, 11, 0.95)',
          color: 'var(--accent)',
          borderColor: '#222222',
        }}
        whileTap={{ scale: 0.9 }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="8 2 4 6 8 10" />
        </svg>
      </motion.button>
    </motion.aside>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  timestamp: number
  read: boolean
}

const MAX_NOTIFICATIONS = 50

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('nero-notifications') || '[]')
    } catch {
      return []
    }
  })

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    setNotifications(prev => {
      const next = [{ id: Date.now().toString(), message, type, timestamp: Date.now(), read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
      localStorage.setItem('nero-notifications', JSON.stringify(next))
      return next
    })
  }, [])

  const markAllRead = () => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('nero-notifications', JSON.stringify(next))
      return next
    })
  }

  const clearAll = () => {
    setNotifications([])
    localStorage.removeItem('nero-notifications')
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <div className="relative">
      <motion.button
        onClick={() => { setOpen(!open); if (!open) markAllRead() }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg"
        style={{
          background: open ? 'var(--accent-dim)' : 'transparent',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
        }}
        whileHover={{ borderColor: 'var(--border-hover)' }}
        whileTap={{ scale: 0.95 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: 'var(--color-error)', color: 'white' }}
          >
            {unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-xl z-50"
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',

              boxShadow: 'var(--glass-shadow-lg)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
              <button
                onClick={clearAll}
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
              >
                Clear all
              </button>
            </div>
            <div className="overflow-y-auto max-h-80">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className="px-4 py-3 flex items-start gap-3"
                    style={{ borderBottom: '1px solid var(--border-subtle)', opacity: n.read ? 0.6 : 1 }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        background: n.type === 'error' ? 'var(--color-error)' : n.type === 'success' ? 'var(--color-success)' : 'var(--accent)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatTime(n.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Export for use in other components
export function useNotificationCenter() {
  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setGlobalNotifications(prev => {
      const next = [{ id: Date.now().toString(), message, type, timestamp: Date.now(), read: false }, ...prev].slice(0, MAX_NOTIFICATIONS)
      localStorage.setItem('nero-notifications', JSON.stringify(next))
      return next
    })
  }, [])
  return { addNotification }
}

let setGlobalNotifications: React.Dispatch<React.SetStateAction<Notification[]>> = () => {}

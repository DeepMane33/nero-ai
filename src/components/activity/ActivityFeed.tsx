'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getActivities, addActivity, type ActivityType, type Activity } from '@/lib/client-activity'

const activityConfig: Record<ActivityType, { icon: React.ReactNode; color: string; glow: string; label: string }> = {
  chat: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    color: '#94a3b8', glow: 'none', label: 'Chat',
  },
  memory: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    color: '#94a3b8', glow: 'none', label: 'Memory',
  },
  research: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    color: '#94a3b8', glow: 'none', label: 'Research',
  },
  project: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    color: '#94a3b8', glow: 'none', label: 'Project',
  },
  system: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    color: '#94a3b8', glow: 'none', label: 'System',
  },
}

const filterOptions: { key: ActivityType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chat', label: 'Chats' },
  { key: 'memory', label: 'Memory' },
  { key: 'research', label: 'Research' },
  { key: 'project', label: 'Projects' },
  { key: 'system', label: 'System' },
]

function getRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'm ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  return days + 'd ago'
}

function groupByDate(activities: Activity[]): Map<string, Activity[]> {
  const groups = new Map<string, Activity[]>()
  for (const a of activities) {
    const d = new Date(a.timestamp)
    const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const arr = groups.get(key) || []
    arr.push(a)
    groups.set(key, arr)
  }
  return groups
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<ActivityType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchActivities = useCallback(() => {
    try {
      const items = getActivities(100)
      setActivities(items)
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load activities'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 15000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  const filtered = useMemo(() => {
    let result = activities
    if (activeFilter !== 'all') {
      result = result.filter((a) => a.type === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      )
    }
    return result
  }, [activities, activeFilter, searchQuery])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activities.length }
    for (const a of activities) {
      counts[a.type] = (counts[a.type] || 0) + 1
    }
    return counts
  }, [activities])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div className="neu-card" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="neu-flat" style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Activity Feed
            </h3>
            <p style={{
              margin: 0,
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {activities.length} events
            </p>
          </div>
        </div>

        <button
          onClick={fetchActivities}
          className="neu-btn"
          style={{
            padding: '6px 12px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
          }}
        >
          {'\u21BB'}
        </button>
      </div>

      {/* Search + Filters */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* Search — neumorphic */}
        <div className="neu-search" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '13px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {filterOptions.map((f) => {
            const isActive = activeFilter === f.key
            const count = typeCounts[f.key] || 0
            const cfg = f.key !== 'all' ? activityConfig[f.key] : null
            return (
              <motion.button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={isActive ? '' : 'neu-btn'}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  background: isActive
                    ? 'rgba(255, 255, 255, 0.06)'
                    : undefined,
                  boxShadow: isActive
                    ? 'inset 2px 2px 4px rgba(0, 0, 0, 0.4), inset -2px -2px 4px rgba(40, 44, 52, 0.06)'
                    : undefined,
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : undefined,
                  color: isActive
                    ? 'rgba(255, 255, 255, 0.8)'
                    : 'var(--text-tertiary)',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {cfg && <span style={{ display: 'flex', alignItems: 'center' }}>{cfg.icon}</span>}
                {f.label}
                <span style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? 'inherit' : 'rgba(255, 255, 255, 0.25)',
                }}>
                  {count}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        maxHeight: '480px',
        overflowY: 'auto',
        padding: '8px 0',
      }}>
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(56, 189, 248, 0.2)',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>Loading activities...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{
            margin: '16px',
            padding: '14px',
            background: 'rgba(248, 113, 113, 0.08)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '13px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>{'\uD83D\uDCED'}</div>
            <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px', margin: 0 }}>
              {searchQuery ? 'No matching activities' : 'No activity yet'}
            </p>
            <p style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '12px', margin: '4px 0 0' }}>
              {searchQuery ? 'Try a different search or filter' : 'Start chatting to see your activity log'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <AnimatePresence>
            {Array.from(grouped.entries()).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date group header */}
                <div style={{
                  padding: '8px 20px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'rgba(255, 255, 255, 0.25)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {dateLabel}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.04)',
                  }} />
                  <span style={{
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'rgba(255, 255, 255, 0.15)',
                  }}>
                    {items.length}
                  </span>
                </div>

                {items.map((activity, index) => {
                  const config = activityConfig[activity.type] || activityConfig.system
                  const isLast = index === items.length - 1
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ delay: index * 0.04, duration: 0.3 }}
                      className="neu-flat"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '10px 16px',
                        margin: '4px 12px',
                        cursor: 'pointer',
                        borderRadius: '10px',
                      }}
                      whileHover={{ backgroundColor: 'rgba(176, 184, 196, 0.04)' }}
                    >
                      {/* Timeline column */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0,
                        position: 'relative',
                      }}>
                        {/* Icon */}
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255, 255, 255, 0.5)',
                          position: 'relative',
                          zIndex: 1,
                        }}>
                          {config.icon}
                        </div>
                        {/* Connector line */}
                        {!isLast && (
                          <div style={{
                            width: '1px',
                            flex: 1,
                            minHeight: '16px',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                            marginTop: '4px',
                          }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'rgba(255, 255, 255, 0.9)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {activity.title}
                            </h4>
                            <span style={{
                              fontSize: '9px',
                              fontFamily: "'JetBrains Mono', monospace",
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'rgba(255, 255, 255, 0.45)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              flexShrink: 0,
                              textTransform: 'uppercase',
                            }}>
                              {config.label}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            color: 'rgba(255, 255, 255, 0.3)',
                            fontFamily: "'JetBrains Mono', monospace",
                            flexShrink: 0,
                          }}>
                            {getRelativeTime(activity.timestamp)}
                          </span>
                        </div>
                        <p style={{
                          margin: '4px 0 0',
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.45)',
                          lineHeight: 1.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {activity.description}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

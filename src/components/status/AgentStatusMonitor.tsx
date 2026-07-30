'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type BrainStatus = 'idle' | 'active' | 'error' | 'standby'

interface BrainStats {
  requestCount: number
  avgResponseTime: number
  successRate: number
  lastError?: string
}

interface BrainInfo {
  id: string
  name: string
  icon: string
  color: string
  description: string
  status: BrainStatus
  lastUsed: string | null
  stats?: BrainStats
  recentConversations?: { id: string; title: string; timestamp: string }[]
}

interface SystemHealth {
  uptime: string
  totalRequests: number
  avgLatency: number
  errorRate: number
  memoryUsage: number
  cpuUsage: number
}

const brainDefaults: Omit<BrainInfo, 'status' | 'lastUsed' | 'stats'>[] = [
  { id: 'reasoning', name: 'Reasoning', icon: '\uD83E\uDDE9', color: '#808080', description: 'Logical analysis, problem solving' },
  { id: 'coding', name: 'Coding', icon: '\uD83D\uDCBB', color: '#8fb996', description: 'Code generation, debugging' },
  { id: 'research', name: 'Research', icon: '\uD83D\uDD2C', color: '#b4a0d4', description: 'Information gathering, analysis' },
  { id: 'creative', name: 'Creative', icon: '\uD83C\uDFA8', color: '#808080', description: 'Writing, brainstorming, ideation' },
  { id: 'memory', name: 'Memory', icon: '\uD83E\uDDE0', color: '#c8b86a', description: 'Recall, context management' },
  { id: 'learning', name: 'Learning', icon: '\uD83D\uDCDA', color: '#7b8da4', description: 'Knowledge synthesis, teaching' },
  { id: 'automation', name: 'Automation', icon: '\uD83E\uDD16', color: '#808080', description: 'Task execution, workflows' },
]

const statusColors: Record<BrainStatus, { bg: string; text: string; glow: string }> = {
  active: { bg: 'rgba(126, 221, 214, 0.12)', text: '#c0c0c0', glow: 'rgba(126, 221, 214, 0.35)' },
  idle: { bg: 'rgba(200, 205, 215, 0.04)', text: 'rgba(138, 143, 152, 0.4)', glow: 'transparent' },
  standby: { bg: '#111111', text: '#808080', glow: '#222222' },
  error: { bg: 'rgba(212, 115, 110, 0.1)', text: '#ffffff', glow: 'rgba(212, 115, 110, 0.25)' },
}

interface AgentStatusMonitorProps {
  onSelectBrain?: (brainId: string) => void
}

export default function AgentStatusMonitor({ onSelectBrain }: AgentStatusMonitorProps) {
  const [brains, setBrains] = useState<BrainInfo[]>(
    brainDefaults.map((b) => ({ ...b, status: 'idle' as BrainStatus, lastUsed: null }))
  )
  const [selectedBrain, setSelectedBrain] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    uptime: '0m',
    totalRequests: 0,
    avgLatency: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  })

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const data = await response.json()
      if (data.brains && Array.isArray(data.brains)) {
        setBrains((prev) =>
          prev.map((brain) => {
            const remote = data.brains.find((b: any) => b.id === brain.id)
            return remote ? { ...brain, ...remote } : brain
          })
        )
      }
      if (data.health) {
        setSystemHealth((prev) => ({ ...prev, ...data.health }))
      }
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch status'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const activeCount = brains.filter((b) => b.status === 'active').length
  const idleCount = brains.filter((b) => b.status === 'idle').length
  const errorCount = brains.filter((b) => b.status === 'error').length
  const usagePercent = Math.round((activeCount / brains.length) * 100)

  const healthScore = useMemo(() => {
    const statusWeight = (brains.length - errorCount) / brains.length
    const errorWeight = 1 - systemHealth.errorRate
    return Math.round(statusWeight * errorWeight * 100)
  }, [brains, systemHealth.errorRate])

  const selectedBrainData = brains.find((b) => b.id === selectedBrain)

  const formatLastUsed = (timestamp: string | null): string => {
    if (!timestamp) return 'Never'
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return mins + 'm ago'
    const hours = Math.floor(mins / 60)
    if (hours < 24) return hours + 'h ago'
    return Math.floor(hours / 24) + 'd ago'
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#c0c0c0'
    if (score >= 50) return '#eab308'
    return '#ffffff'
  }

  return (
    <div style={{
      background: 'rgba(13, 17, 23, 0.7)',

      border: '2px solid #333333',
      borderRadius: '0px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '2px solid #333333',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0px',
            background: '#000000',
            border: '2px solid #333333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            {'\uD83E\uDDE0'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
              Agent Status
            </h3>
            <p style={{
              margin: 0,
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {activeCount} OF {brains.length} ACTIVE
            </p>
          </div>
        </div>

        {/* Health badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '0px',
          background: getHealthColor(healthScore) + '12',
          border: '1px solid ' + getHealthColor(healthScore) + '30',
        }}>
          <motion.div
            animate={healthScore < 80 ? { opacity: [0.4, 1, 0.4] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: getHealthColor(healthScore),
              boxShadow: '0 0 6px ' + getHealthColor(healthScore) + '80',
            }}
          />
          <span style={{
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
            color: getHealthColor(healthScore),
            fontWeight: 600,
          }}>
            {healthScore}%
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(255, 255, 255, 0.3)',
          }}>
            HEALTH
          </span>
        </div>
      </div>

      {/* System Health Dashboard */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '2px solid #333333',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Usage bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              SYSTEM LOAD
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: usagePercent > 66 ? '#ffffff' : usagePercent > 33 ? '#eab308' : '#c0c0c0',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {usagePercent}%
            </span>
          </div>
          <div style={{
            height: '6px',
            borderRadius: '0px',
            background: '#0a0a0a',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: usagePercent + '%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                height: '100%',
                borderRadius: '0px',
                background: usagePercent > 66
                  ? '#000000'
                  : usagePercent > 33
                  ? '#000000'
                  : '#000000',
                boxShadow: '0 0 8px ' + (usagePercent > 66 ? 'rgba(248, 113, 113, 0.4)' : usagePercent > 33 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(52, 211, 153, 0.4)'),
              }}
            />
          </div>
        </div>

        {/* System metrics grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}>
          {[
            { label: 'UPTIME', value: systemHealth.uptime, color: '#38bdf8' },
            { label: 'REQUESTS', value: systemHealth.totalRequests.toString(), color: '#c0c0c0' },
            { label: 'LATENCY', value: systemHealth.avgLatency + 'ms', color: '#a855f7' },
            { label: 'ERRORS', value: (systemHealth.errorRate * 100).toFixed(1) + '%', color: systemHealth.errorRate > 0.05 ? '#ffffff' : '#c0c0c0' },
          ].map((metric) => (
            <div key={metric.label} style={{
              padding: '10px 12px',
              borderRadius: '0px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '2px solid #333333',
              textAlign: 'center',
            }}>
              <p style={{
                margin: '0 0 4px',
                fontSize: '9px',
                fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(255, 255, 255, 0.3)',
                letterSpacing: '0.05em',
              }}>
                {metric.label}
              </p>
              <p style={{
                margin: 0,
                fontSize: '14px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: metric.color,
              }}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* Status summary row */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {[
            { label: 'Active', count: activeCount, color: '#c0c0c0' },
            { label: 'Idle', count: idleCount, color: 'rgba(255, 255, 255, 0.3)' },
            { label: 'Standby', count: brains.filter((b) => b.status === 'standby').length, color: '#eab308' },
            { label: 'Error', count: errorCount, color: '#ffffff' },
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: s.color,
                boxShadow: s.count > 0 ? '0 0 6px ' + s.color + '60' : 'none',
              }} />
              <span style={{
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                color: s.count > 0 ? s.color : 'rgba(255, 255, 255, 0.2)',
              }}>
                {s.count} {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Brain Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: '10px',
        padding: '16px 20px',
      }}>
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{
              padding: '16px',
              borderRadius: '0px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '2px solid #333333',
              height: '120px',
            }}>
              <motion.div
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '0px',
                  background: '#0a0a0a',
                }}
              />
            </div>
          ))
        ) : (
          brains.map((brain, index) => {
            const sc = statusColors[brain.status]
            return (
              <motion.div
                key={brain.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedBrain(selectedBrain === brain.id ? null : brain.id)}
                style={{
                  padding: '16px',
                  borderRadius: '0px',
                  background: selectedBrain === brain.id
                    ? 'linear-gradient(135deg, ' + brain.color + '15, ' + brain.color + '05)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid ' + (selectedBrain === brain.id ? brain.color + '40' : '#0a0a0a'),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                whileHover={{
                  borderColor: brain.color + '30',
                  backgroundColor: brain.color + '08',
                }}
              >
                {/* Active pulse */}
                {brain.status === 'active' && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: brain.color,
                      boxShadow: '0 0 8px ' + brain.color + '60',
                    }}
                  />
                )}

                {/* Brain icon */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0px',
                  background: 'linear-gradient(135deg, ' + brain.color + '20, ' + brain.color + '08)',
                  border: '1px solid ' + brain.color + '30',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  marginBottom: '10px',
                }}>
                  {brain.icon}
                </div>

                <h4 style={{
                  margin: '0 0 4px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}>
                  {brain.name}
                </h4>
                <p style={{
                  margin: '0 0 10px',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.35)',
                  lineHeight: 1.4,
                }}>
                  {brain.description}
                </p>

                {/* Stats mini row */}
                {brain.stats && (
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      fontSize: '9px',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '2px 5px',
                      borderRadius: '0px',
                      background: '#0a0a0a',
                      color: 'rgba(255, 255, 255, 0.3)',
                    }}>
                      {brain.stats.requestCount} req
                    </span>
                    <span style={{
                      fontSize: '9px',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '2px 5px',
                      borderRadius: '0px',
                      background: '#0a0a0a',
                      color: 'rgba(255, 255, 255, 0.3)',
                    }}>
                      {brain.stats.avgResponseTime}ms
                    </span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '2px 8px',
                    borderRadius: '0px',
                    background: sc.bg,
                    color: sc.text,
                    textTransform: 'uppercase',
                    boxShadow: brain.status === 'active' ? '0 0 8px ' + sc.glow : 'none',
                  }}>
                    {brain.status}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.25)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {formatLastUsed(brain.lastUsed)}
                  </span>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Brain Detail Panel */}
      <AnimatePresence>
        {selectedBrainData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              borderTop: '1px solid ' + selectedBrainData.color + '20',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px' }}>{selectedBrainData.icon}</span>
                <div style={{ flex: 1 }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 600,
                    color: selectedBrainData.color,
                  }}>
                    {selectedBrainData.name} Brain
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                    {selectedBrainData.description}
                  </p>
                </div>
                {/* Chat with this agent button */}
                <motion.button
                  onClick={() => onSelectBrain?.(selectedBrainData.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '0px',
                    background: `linear-gradient(135deg, ${selectedBrainData.color}30, ${selectedBrainData.color}15)`,
                    border: `1px solid ${selectedBrainData.color}50`,
                    color: selectedBrainData.color,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                  whileHover={{ scale: 1.03, boxShadow: `0 0 12px ${selectedBrainData.color}40` }}
                  whileTap={{ scale: 0.97 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Chat
                </motion.button>
              </div>

              {/* Brain stats detail */}
              {selectedBrainData.stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  marginBottom: '14px',
                }}>
                  {[
                    { label: 'REQUESTS', value: selectedBrainData.stats.requestCount.toString(), color: selectedBrainData.color },
                    { label: 'AVG LATENCY', value: selectedBrainData.stats.avgResponseTime + 'ms', color: '#a855f7' },
                    { label: 'SUCCESS', value: Math.round(selectedBrainData.stats.successRate * 100) + '%', color: selectedBrainData.stats.successRate > 0.9 ? '#c0c0c0' : '#eab308' },
                  ].map((s) => (
                    <div key={s.label} style={{
                      padding: '10px',
                      borderRadius: '0px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '2px solid #333333',
                      textAlign: 'center',
                    }}>
                      <p style={{
                        margin: '0 0 4px',
                        fontSize: '9px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.25)',
                        letterSpacing: '0.05em',
                      }}>
                        {s.label}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '16px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        color: s.color,
                      }}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent conversations */}
              {selectedBrainData.recentConversations && selectedBrainData.recentConversations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    RECENT CONVERSATIONS
                  </span>
                  {selectedBrainData.recentConversations.map((conv) => (
                    <div key={conv.id} style={{
                      padding: '10px 12px',
                      borderRadius: '0px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '2px solid #333333',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.7)',
                      }}>
                        {conv.title}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        color: 'rgba(255, 255, 255, 0.3)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {formatLastUsed(conv.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.3)',
                  textAlign: 'center',
                  padding: '12px 0',
                }}>
                  No recent conversations
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 20px 16px',
          padding: '10px 14px',
          background: 'rgba(248, 113, 113, 0.08)',
          border: '2px solid #333333',
          borderRadius: '0px',
          color: '#ffffff',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

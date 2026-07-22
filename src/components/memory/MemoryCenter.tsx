'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GlowButton from '@/components/ui/GlowButton'
import { getMemories, addMemory, deleteMemory, clearAllMemories, type ClientMemory } from '@/lib/client-memory'

interface Memory {
  id: string
  category: string
  key: string
  value: string
  confidence: number
  source?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  'all',
  'identity',
  'location',
  'work',
  'preferences',
  'projects',
  'notes',
  'tools',
  'general',
] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  identity: {
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.2)',
    text: '#94a3b8',
  },
  location: {
    bg: 'rgba(126, 221, 214, 0.08)',
    border: 'rgba(126, 221, 214, 0.2)',
    text: '#7eddd6',
  },
  work: {
    bg: 'rgba(180, 160, 212, 0.08)',
    border: 'rgba(180, 160, 212, 0.2)',
    text: '#b4a0d4',
  },
  preferences: {
    bg: 'rgba(126, 200, 227, 0.08)',
    border: 'rgba(126, 200, 227, 0.2)',
    text: '#7ec8e3',
  },
  projects: {
    bg: 'rgba(126, 221, 214, 0.08)',
    border: 'rgba(126, 221, 214, 0.2)',
    text: '#7eddd6',
  },
  notes: {
    bg: 'rgba(143, 185, 150, 0.06)',
    border: 'rgba(143, 185, 150, 0.15)',
    text: '#8fb996',
  },
  tools: {
    bg: 'rgba(200, 184, 106, 0.08)',
    border: 'rgba(200, 184, 106, 0.2)',
    text: '#c8b86a',
  },
  general: {
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: 'rgba(156, 179, 201, 0.5)',
  },
}

export default function MemoryCenter() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'grid' | 'timeline'>('grid')
  const [showDashboard, setShowDashboard] = useState(true)

  // Form state
  const [formCategory, setFormCategory] = useState('general')
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formConfidence, setFormConfidence] = useState(1.0)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch memories from localStorage
  const fetchMemories = useCallback(() => {
    setIsLoading(true)
    try {
      const results = getMemories(activeCategory, debouncedSearch)
      setMemories(results)
    } catch (err: unknown) {
      console.error('Fetch memories error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeCategory, debouncedSearch])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  // Stats computed from all memories (client-side)
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {}
    for (const cat of CATEGORIES) {
      if (cat !== 'all') byCategory[cat] = 0
    }
    let highConfidence = 0
    let recentCount = 0
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1
      if (m.confidence >= 0.8) highConfidence++
      const created = new Date(m.created_at + 'Z').getTime()
      if (now - created < oneDay * 7) recentCount++
    }

    return {
      total: memories.length,
      byCategory,
      highConfidence,
      recentCount,
      avgConfidence:
        memories.length > 0
          ? Math.round(
              (memories.reduce((s, m) => s + m.confidence, 0) / memories.length) * 100
            )
          : 0,
    }
  }, [memories])

  // Reset form
  const resetForm = useCallback(() => {
    setFormCategory('general')
    setFormKey('')
    setFormValue('')
    setFormConfidence(1.0)
    setEditingMemory(null)
  }, [])

  // Open add modal
  const openAddModal = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  // Open edit modal
  const openEditModal = useCallback((memory: Memory) => {
    setEditingMemory(memory)
    setFormCategory(memory.category)
    setFormKey(memory.key)
    setFormValue(memory.value)
    setFormConfidence(memory.confidence)
    setShowModal(true)
  }, [])

  // Save memory (add or update)
  const handleSave = useCallback(async () => {
    if (!formKey.trim() || !formValue.trim()) return

    try {
      if (editingMemory) {
        // Update existing memory
        const memories = getMemories()
        const existing = memories.find(m => m.id === editingMemory.id)
        if (existing) {
          existing.category = formCategory
          existing.key = formKey.trim()
          existing.value = formValue.trim()
          existing.confidence = formConfidence
          existing.updated_at = new Date().toISOString()
          localStorage.setItem('nero-memories', JSON.stringify(memories))
        }
      } else {
        // Add new memory
        addMemory(formCategory, formKey.trim(), formValue.trim(), formConfidence)
      }

      setShowModal(false)
      resetForm()
      fetchMemories()
    } catch (err: unknown) {
      console.error('Save memory error:', err)
    }
  }, [editingMemory, formCategory, formKey, formValue, formConfidence, resetForm, fetchMemories])

  // Delete memory
  const handleDelete = useCallback(
    (id: string) => {
      deleteMemory(id)
      setDeleteConfirm(null)
      fetchMemories()
    },
    [fetchMemories]
  )

  // Export as JSON
  const handleExport = useCallback(() => {
    const exportData = {
      exported_at: new Date().toISOString(),
      total: memories.length,
      memories: memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        source: m.source || null,
        tags: m.tags || [],
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memories-export-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [memories])

  // Format date
  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'Z')
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  // Format time
  const formatTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'Z')
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  // Format relative time
  const formatRelative = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'Z')
    const now = Date.now()
    const diff = now - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    const days = Math.floor(hrs / 24)
    if (days < 7) return days + 'd ago'
    return formatDate(dateStr)
  }, [formatDate])

  // Get confidence color
  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'var(--accent)'
    if (confidence >= 0.5) return '#ffa502'
    return '#ff4757'
  }, [])

  // Group memories by date for timeline
  const timelineGroups = useMemo(() => {
    const groups: Record<string, Memory[]> = {}
    const sorted = [...memories].sort(
      (a, b) => new Date(b.created_at + 'Z').getTime() - new Date(a.created_at + 'Z').getTime()
    )
    for (const m of sorted) {
      const d = new Date(m.created_at + 'Z')
      const key = d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
    return groups
  }, [memories])

  // Form category options (excluding 'all')
  const formCategories = CATEGORIES.filter((c) => c !== 'all')

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(148, 163, 184, 0.03) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 relative z-10"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          background: 'rgba(10, 11, 15, 0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow-strong)' }}
            />
            <h2
              className="text-sm font-medium tracking-wide"
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              MEMORY CENTER
            </h2>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              {memories.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <button
                onClick={() => setActiveView('grid')}
                className="px-2.5 py-1.5 text-[10px] font-mono cursor-pointer"
                style={{
                  background:
                    activeView === 'grid'
                      ? 'var(--accent-dim)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color:
                    activeView === 'grid' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)',
                }}
              >
                GRID
              </button>
              <button
                onClick={() => setActiveView('timeline')}
                className="px-2.5 py-1.5 text-[10px] font-mono cursor-pointer"
                style={{
                  background:
                    activeView === 'timeline'
                      ? 'var(--accent-dim)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color:
                    activeView === 'timeline' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)',
                }}
              >
                TIMELINE
              </button>
            </div>

            {/* Export button */}
            <motion.button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider cursor-pointer"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                color: 'rgba(255, 255, 255, 0.4)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              EXPORT JSON
            </motion.button>

            {/* Dashboard toggle */}
            <motion.button
              onClick={() => setShowDashboard(!showDashboard)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider cursor-pointer"
              style={{
                background: showDashboard
                  ? 'var(--accent-dim)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid ' + (showDashboard
                  ? 'rgba(148, 163, 184, 0.3)'
                  : 'rgba(255, 255, 255, 0.06)'),
                color: showDashboard ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              STATS
            </motion.button>

            <GlowButton variant="primary" size="sm" onClick={openAddModal}>
              <span className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Memory
              </span>
            </GlowButton>
          </div>
        </div>

        {/* Search bar — neumorphic */}
        <div className="mb-3">
          <div
            className="flex items-center gap-2 px-3 py-2 neu-search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'rgba(255, 255, 255, 0.85)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="cursor-pointer"
                style={{ color: 'rgba(255, 255, 255, 0.3)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
            return (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider capitalize shrink-0 cursor-pointer"
                style={{
                  background:
                    activeCategory === cat ? catColors.bg : 'rgba(255, 255, 255, 0.03)',
                  border:
                    '1px solid ' +
                    (activeCategory === cat ? catColors.border : 'rgba(255, 255, 255, 0.06)'),
                  color: activeCategory === cat ? catColors.text : 'rgba(255, 255, 255, 0.4)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {cat}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10">
        {/* Dashboard */}
        <AnimatePresence>
          {showDashboard && stats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {/* Total memories */}
                <div
                  className="neu-flat"
                  style={{ padding: 16 }}
                >
                  <p
                    className="text-[10px] font-mono tracking-wider mb-1"
                    style={{ color: 'rgba(148, 163, 184, 0.6)' }}
                  >
                    TOTAL MEMORIES
                  </p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: 'var(--accent)' }}
                  >
                    {stats.total}
                  </p>
                </div>

                {/* Avg confidence */}
                <div
                  className="neu-flat"
                  style={{ padding: 16 }}
                >
                  <p
                    className="text-[10px] font-mono tracking-wider mb-1"
                    style={{ color: 'rgba(148, 163, 184, 0.6)' }}
                  >
                    AVG CONFIDENCE
                  </p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: 'var(--accent)' }}
                  >
                    {stats.avgConfidence}%
                  </p>
                </div>

                {/* High confidence */}
                <div
                  className="neu-flat"
                  style={{ padding: 16 }}
                >
                  <p
                    className="text-[10px] font-mono tracking-wider mb-1"
                    style={{ color: 'rgba(160, 184, 208, 0.6)' }}
                  >
                    HIGH CONFIDENCE
                  </p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: 'var(--ice)' }}
                  >
                    {stats.highConfidence}
                  </p>
                </div>

                {/* Recent (7 days) */}
                <div
                  className="neu-flat"
                  style={{ padding: 16 }}
                >
                  <p
                    className="text-[10px] font-mono tracking-wider mb-1"
                    style={{ color: 'rgba(136, 152, 184, 0.6)' }}
                  >
                    ADDED THIS WEEK
                  </p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: 'var(--sage)' }}
                  >
                    {stats.recentCount}
                  </p>
                </div>
              </div>

              {/* Category breakdown bar */}
              <div
                className="neu-flat"
                style={{ padding: 16 }}
              >
                <p
                  className="text-[10px] font-mono tracking-wider mb-3"
                  style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                >
                  BY CATEGORY
                </p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(stats.byCategory).map(([cat, count]) => {
                    const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
                    const pct =
                      stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: catColors.text }}
                        />
                        <span
                          className="text-xs font-mono capitalize"
                          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                        >
                          {cat}
                        </span>
                        <span
                          className="text-xs font-mono font-medium"
                          style={{ color: catColors.text }}
                        >
                          {count}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: 'rgba(255, 255, 255, 0.2)' }}
                        >
                          ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Visual bar */}
                <div
                  className="flex rounded-full overflow-hidden h-1.5 mt-3"
                  style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                >
                  {Object.entries(stats.byCategory).map(([cat, count]) => {
                    const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                    if (pct === 0) return null
                    return (
                      <motion.div
                        key={cat}
                        className="h-full"
                        style={{ background: catColors.text, width: pct + '%' }}
                        initial={{ width: 0 }}
                        animate={{ width: pct + '%' }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      />
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="spinner-neon" />
            <p
              className="text-xs font-mono tracking-wider"
              style={{ color: 'rgba(148, 163, 184, 0.5)' }}
            >
              LOADING MEMORIES...
            </p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(148, 163, 184, 0.05)',
                border: '1px dashed rgba(148, 163, 184, 0.2)',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(148, 163, 184, 0.4)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="text-center">
              <p
                className="text-sm font-medium"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                No memories found
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'rgba(255, 255, 255, 0.25)' }}
              >
                {searchQuery
                  ? 'Try a different search term'
                  : 'Add your first memory to get started'}
              </p>
            </div>
            {!searchQuery && (
              <GlowButton variant="primary" size="sm" onClick={openAddModal}>
                Add First Memory
              </GlowButton>
            )}
          </div>
        ) : activeView === 'timeline' ? (
          /* Timeline view */
          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="popLayout">
              {Object.entries(timelineGroups).map(([dateLabel, group], groupIdx) => (
                <motion.div
                  key={dateLabel}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: groupIdx * 0.05 }}
                  className="mb-6"
                >
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: 'var(--accent)',
                        boxShadow: '0 0 6px rgba(148, 163, 184, 0.4)',
                      }}
                    />
                    <span
                      className="text-xs font-mono tracking-wider"
                      style={{ color: 'rgba(148, 163, 184, 0.6)' }}
                    >
                      {dateLabel}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: 'rgba(148, 163, 184, 0.1)' }}
                    />
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: 'rgba(255, 255, 255, 0.2)' }}
                    >
                      {group.length} {group.length === 1 ? 'memory' : 'memories'}
                    </span>
                  </div>

                  {/* Timeline entries */}
                  <div className="ml-3 pl-5 relative">
                    {/* Vertical line */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-px"
                      style={{ background: 'rgba(148, 163, 184, 0.1)' }}
                    />

                    {group.map((memory, idx) => {
                      const catColors =
                        CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.general
                      return (
                        <motion.div
                          key={memory.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.04 }}
                          className="relative mb-3 last:mb-0 group"
                        >
                          {/* Dot on timeline */}
                          <div
                            className="absolute -left-5 top-3 w-1.5 h-1.5 rounded-full"
                            style={{ background: catColors.text }}
                          />

                          <div
                            className="rounded-lg p-3 group-hover:scale-[1.01] transition-transform"
                            style={{
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                                  style={{
                                    background: catColors.bg,
                                    border: '1px solid ' + catColors.border,
                                    color: catColors.text,
                                  }}
                                >
                                  {memory.category}
                                </span>
                                {/* Confidence dot */}
                                <div className="flex items-center gap-1">
                                  <div
                                    className="w-1 h-1 rounded-full"
                                    style={{
                                      background: getConfidenceColor(memory.confidence),
                                    }}
                                  />
                                  <span
                                    className="text-[9px] font-mono"
                                    style={{ color: 'rgba(255, 255, 255, 0.2)' }}
                                  >
                                    {Math.round(memory.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: 'rgba(255, 255, 255, 0.15)' }}
                              >
                                {formatTime(memory.created_at)}
                              </span>
                            </div>
                            <h4
                              className="text-sm font-medium mb-1"
                              style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                            >
                              {memory.key}
                            </h4>
                            <p
                              className="text-xs leading-relaxed line-clamp-2"
                              style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                            >
                              {memory.value}
                            </p>

                            {/* Inline actions */}
                            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(memory)}
                                className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                                style={{
                                  background: 'rgba(148, 163, 184, 0.08)',
                                  color: 'rgba(148, 163, 184, 0.6)',
                                }}
                              >
                                EDIT
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(memory.id)}
                                className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                                style={{
                                  background: 'rgba(248, 113, 113, 0.08)',
                                  color: 'rgba(248, 113, 113, 0.6)',
                                }}
                              >
                                DELETE
                              </button>
                            </div>
                          </div>

                          {/* Delete confirm inline */}
                          <AnimatePresence>
                            {deleteConfirm === memory.id && (
                              <motion.div
                                className="mt-1.5 flex items-center gap-2 p-2 rounded-lg"
                                style={{
                                  background: 'rgba(248, 113, 113, 0.06)',
                                  border: '1px solid rgba(248, 113, 113, 0.15)',
                                }}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <span
                                  className="text-[10px] font-mono"
                                  style={{ color: 'rgba(248, 113, 113, 0.7)' }}
                                >
                                  Confirm delete?
                                </span>
                                <button
                                  onClick={() => handleDelete(memory.id)}
                                  className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                                  style={{
                                    background: 'rgba(248, 113, 113, 0.2)',
                                    color: '#f87171',
                                  }}
                                >
                                  YES
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'rgba(255, 255, 255, 0.4)',
                                  }}
                                >
                                  NO
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <AnimatePresence mode="popLayout">
              {memories.map((memory, index) => {
                const catColors =
                  CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.general
                return (
                  <motion.div
                    key={memory.id}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    className="relative rounded-xl p-4 group"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {/* Category badge + confidence */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider"
                        style={{
                          background: catColors.bg,
                          border: '1px solid ' + catColors.border,
                          color: catColors.text,
                        }}
                      >
                        {memory.category}
                      </span>

                      {/* Confidence indicator */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className="relative w-6 h-6 rounded-full flex items-center justify-center"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border:
                              '1.5px solid ' + getConfidenceColor(memory.confidence),
                          }}
                        >
                          <span
                            className="text-[7px] font-mono font-bold"
                            style={{
                              color: getConfidenceColor(memory.confidence),
                            }}
                          >
                            {Math.round(memory.confidence * 100)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Key */}
                    <h3
                      className="text-sm font-medium mb-1.5"
                      style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {memory.key}
                    </h3>

                    {/* Value */}
                    <p
                      className="text-xs leading-relaxed mb-3 line-clamp-3"
                      style={{ color: 'rgba(255, 255, 255, 0.55)' }}
                    >
                      {memory.value}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: 'rgba(255, 255, 255, 0.15)' }}
                        >
                          {formatRelative(memory.created_at)}
                        </span>
                        {memory.source && (
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              color: 'rgba(255, 255, 255, 0.2)',
                            }}
                          >
                            {memory.source}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <motion.button
                          className="p-1 rounded cursor-pointer"
                          style={{ color: 'rgba(148, 163, 184, 0.5)' }}
                          onClick={() => openEditModal(memory)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Edit"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </motion.button>

                        <motion.button
                          className="p-1 rounded cursor-pointer"
                          style={{ color: 'rgba(248, 113, 113, 0.5)' }}
                          onClick={() => setDeleteConfirm(memory.id)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </motion.button>
                      </div>
                    </div>

                    {/* Delete confirmation overlay */}
                    <AnimatePresence>
                      {deleteConfirm === memory.id && (
                        <motion.div
                          className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 z-10"
                          style={{
                            background: 'rgba(10, 11, 15, 0.95)',
                            backdropFilter: 'blur(8px)',
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <p
                            className="text-xs font-medium"
                            style={{ color: 'rgba(248, 113, 113, 0.8)' }}
                          >
                            Delete this memory?
                          </p>
                          <div className="flex gap-2">
                            <GlowButton
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(memory.id)}
                            >
                              Delete
                            </GlowButton>
                            <GlowButton
                              variant="secondary"
                              size="sm"
                              onClick={() => setDeleteConfirm(null)}
                            >
                              Cancel
                            </GlowButton>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
            />

            {/* Modal content */}
            <motion.div
              className="relative w-full max-w-md rounded-xl p-6 z-10"
              style={{
                background: '#0a0a0b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow:
                  '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 60px rgba(148, 163, 184, 0.05)',
              }}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <h3
                className="text-sm font-medium tracking-wide mb-5"
                style={{ color: 'rgba(255, 255, 255, 0.8)' }}
              >
                {editingMemory ? 'EDIT MEMORY' : 'NEW MEMORY'}
              </h3>

              <div className="space-y-4">
                {/* Category select */}
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-wider mb-1.5"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    CATEGORY
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                  >
                    {formCategories.map((cat) => (
                      <option key={cat} value={cat} style={{ background: '#0d1117' }}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Key input */}
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-wider mb-1.5"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    KEY
                  </label>
                  <input
                    type="text"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="e.g. favorite_language"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                  />
                </div>

                {/* Value input */}
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-wider mb-1.5"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    VALUE
                  </label>
                  <textarea
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="Memory content..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                  />
                </div>

                {/* Confidence slider */}
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-wider mb-1.5"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    CONFIDENCE: {Math.round(formConfidence * 100)}%
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formConfidence}
                      onChange={(e) => setFormConfidence(parseFloat(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border:
                          '1.5px solid ' + getConfidenceColor(formConfidence),
                      }}
                    >
                      <span
                        className="text-[9px] font-mono font-bold"
                        style={{
                          color: getConfidenceColor(formConfidence),
                        }}
                      >
                        {Math.round(formConfidence * 100)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[9px] font-mono"
                      style={{ color: 'rgba(255, 71, 87, 0.5)' }}
                    >
                      LOW
                    </span>
                    <span
                      className="text-[9px] font-mono"
                      style={{ color: 'rgba(255, 165, 2, 0.5)' }}
                    >
                      MEDIUM
                    </span>
                    <span
                      className="text-[9px] font-mono"
                      style={{ color: 'rgba(148, 163, 184, 0.5)' }}
                    >
                      HIGH
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <GlowButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </GlowButton>
                <GlowButton
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!formKey.trim() || !formValue.trim()}
                >
                  {editingMemory ? 'Update' : 'Save'}
                </GlowButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

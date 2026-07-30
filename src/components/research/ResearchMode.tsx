'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AICore from '@/components/ui/AICore'
import GlowButton from '@/components/ui/GlowButton'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface SearchEntry {
  id: string
  query: string
  results: SearchResult[]
  timestamp: string
}

export default function ResearchMode() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [currentResults, setCurrentResults] = useState<SearchResult[]>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<SearchEntry[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Perform search
  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || isSearching) return

    setIsSearching(true)
    setError(null)
    setSummary(null)
    setCurrentQuery(trimmed)
    setCurrentResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Search failed (${response.status})`)
      }

      const data = await response.json()
      const results: SearchResult[] = data.results || []
      setCurrentResults(results)
      if (data.info) setError(data.info)

      // Add to history
      const entry: SearchEntry = {
        id: Date.now().toString(),
        query: trimmed,
        results,
        timestamp: new Date().toISOString(),
      }
      setSearchHistory((prev) => [entry, ...prev].slice(0, 20))
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [isSearching])

  // Generate summary of current results
  const generateSummary = useCallback(async () => {
    if (currentResults.length === 0 || isSummarizing) return

    setIsSummarizing(true)
    setSummary(null)

    try {
      const snippetsText = currentResults
        .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
        .join('\n')

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Summarize these search results for the query "${currentQuery}" in 3-5 concise bullet points:\n\n${snippetsText}`,
          apiKey: localStorage.getItem('nero-gemini-key') || undefined,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Summary generation failed')
      }

      if (!response.body) throw new Error('No response stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              fullContent += parsed.content
              setSummary(fullContent)
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate summary')
    } finally {
      setIsSummarizing(false)
    }
  }, [currentResults, currentQuery, isSummarizing])

  // Export results as text
  const exportResults = useCallback(() => {
    if (currentResults.length === 0) return

    let text = `Search Results: "${currentQuery}"\n`
    text += `Generated: ${new Date().toLocaleString()}\n`
    text += `${'='.repeat(50)}\n\n`

    currentResults.forEach((r, i) => {
      text += `${i + 1}. ${r.title}\n`
      text += `   ${r.url}\n`
      if (r.snippet) text += `   ${r.snippet}\n`
      text += '\n'
    })

    if (summary) {
      text += `\n${'='.repeat(50)}\n`
      text += `SUMMARY:\n${summary}\n`
    }

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-${currentQuery.replace(/\s+/g, '-').toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [currentResults, currentQuery, summary])

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        performSearch(searchQuery)
      }
    },
    [performSearch, searchQuery]
  )

  // Load from history
  const loadFromHistory = useCallback((entry: SearchEntry) => {
    setSearchQuery(entry.query)
    setCurrentQuery(entry.query)
    setCurrentResults(entry.results)
    setSummary(null)
    setError(null)
    setShowHistory(false)
  }, [])

  // Extract domain from URL
  const getDomain = useCallback((url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }, [])

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(148, 163, 184, 0.02) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 relative z-10"
        style={{
          borderBottom: '2px solid #333333',
          background: '#050505',

        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow-strong)' }}
            />
            <h2 className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              RESEARCH MODE
            </h2>
          </div>

          <GlowButton
            variant="secondary"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History
              {searchHistory.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-mono"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  {searchHistory.length}
                </span>
              )}
            </span>
          </GlowButton>
        </div>

        {/* Search input — neumorphic */}
        <div
          className="flex items-center gap-3 px-4 py-3 neu-search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search the web..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
            disabled={isSearching}
          />

          {isSearching ? (
            <div className="spinner-neon-sm" />
          ) : (
            <GlowButton
              variant="primary"
              size="sm"
              onClick={() => performSearch(searchQuery)}
              disabled={!searchQuery.trim()}
            >
              Search
            </GlowButton>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {/* History sidebar overlay */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-80 z-20 overflow-y-auto"
              style={{
                background: 'rgba(10, 11, 15, 0.95)',
                borderLeft: '2px solid #333333',

              }}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    SEARCH HISTORY
                  </h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="cursor-pointer p-1"
                    style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {searchHistory.length === 0 ? (
                  <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.2)' }}>
                    No searches yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {searchHistory.map((entry) => (
                      <motion.button
                        key={entry.id}
                        className="w-full text-left px-3 py-2 rounded-lg cursor-pointer"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '2px solid #333333',
                        }}
                        onClick={() => loadFromHistory(entry)}
                        whileHover={{ background: 'var(--accent-subtle)' }}
                      >
                        <p className="text-xs font-medium truncate" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {entry.query}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255, 255, 255, 0.2)' }}>
                          {entry.results.length} results • {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="p-6">
          {isSearching ? (
            /* Loading state */
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AICore state="thinking" size={100} />
              <p className="text-xs font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
                SEARCHING...
              </p>
            </div>
          ) : error ? (
            /* Error state */
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '2px solid #333333',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: '#ffffff' }}>{error}</p>
              <GlowButton variant="secondary" size="sm" onClick={() => setError(null)}>
                Dismiss
              </GlowButton>
            </div>
          ) : currentResults.length > 0 ? (
            /* Results */
            <div className="max-w-3xl mx-auto">
              {/* Results header */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-mono tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                  {currentResults.length} RESULTS FOR &ldquo;{currentQuery}&rdquo;
                </p>
                <div className="flex gap-2">
                  <GlowButton variant="secondary" size="sm" onClick={generateSummary} disabled={isSummarizing}>
                    <span className="flex items-center gap-1.5">
                      {isSummarizing ? (
                        <div className="spinner-neon-sm" />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      )}
                      Summarize
                    </span>
                  </GlowButton>
                  <GlowButton variant="secondary" size="sm" onClick={exportResults}>
                    <span className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export
                    </span>
                  </GlowButton>
                </div>
              </div>

              {/* Summary card */}
              <AnimatePresence>
                {(summary || isSummarizing) && (
                  <motion.div
                    className="mb-6 rounded-xl p-4 neu-raised"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--accent)' }}>
                        AI SUMMARY
                      </span>
                      {isSummarizing && <div className="spinner-neon-sm" />}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                      {summary || 'Generating summary...'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Result cards */}
              <div className="space-y-3">
                <AnimatePresence>
                  {currentResults.map((result, index) => (
                    <motion.a
                      key={`${currentQuery}-${index}`}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl p-4 group neu-flat"
                      style={{
                        textDecoration: 'none',
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      whileHover={{
                        borderColor: 'var(--border-hover)',
                        background: 'var(--accent-subtle)',
                      }}
                    >
                      {/* URL / domain */}
                      <p className="text-[10px] font-mono mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {getDomain(result.url)}
                      </p>

                      {/* Title */}
                      <h3
                        className="text-sm font-medium mb-1.5 group-hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {result.title}
                      </h3>

                      {/* Snippet */}
                      {result.snippet && (
                        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                          {result.snippet}
                        </p>
                      )}
                    </motion.a>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* Empty / initial state — clean, no floating icon */
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Search the web, get AI summaries, and export your findings
                </p>
              </div>

              {/* Quick search suggestions — current, timeless topics */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {['Latest AI developments', 'Local LLM optimization', 'Next.js performance guides', 'Rust vs Go benchmarks'].map(
                  (suggestion) => (
                    <motion.button
                      key={suggestion}
                      className="px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                      style={{
                        background: '#0a0a0a',
                        border: '2px solid #333333',
                        color: 'var(--text-tertiary)',
                      }}
                      onClick={() => {
                        setSearchQuery(suggestion)
                        performSearch(suggestion)
                      }}
                      whileHover={{
                        borderColor: 'var(--border-hover)',
                        color: 'var(--text-secondary)',
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {suggestion}
                    </motion.button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

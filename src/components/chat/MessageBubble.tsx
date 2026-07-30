'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  brainUsed?: string
  provider?: string
  model?: string
  timestamp?: string | Date
  isNew?: boolean
  isStreaming?: boolean
  onCopy?: (content: string) => void
  onSpeak?: (content: string) => void
  messageId?: string
  onFeedback?: (messageId: string, type: string, content?: string) => void
  feedbackGiven?: string | null
  confidence?: string | null
}

// ---------------------------------------------------------------------------
// Markdown parsing with code block copy
// ---------------------------------------------------------------------------

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-default)' }}>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{language || 'code'}</span>
        <motion.button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
          style={{
            color: copied ? 'var(--color-success)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy
            </>
          )}
        </motion.button>
      </div>
      <pre
        className="p-3 text-xs overflow-x-auto"
        style={{ background: 'rgba(0, 0, 0, 0.25)', fontFamily: 'var(--font-mono)', lineHeight: 1.7, margin: 0, border: 'none', borderRadius: 0 }}
      >
        <code style={{ color: 'var(--text-secondary)' }}>{code}</code>
      </pre>
    </div>
  )
}

function parseTable(lines: string[]): ReactNode {
  if (lines.length < 2) return null
  const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean)
  // Skip separator line (line 1)
  const dataRows = lines.slice(2).map(row =>
    row.split('|').map(c => c.trim()).filter(Boolean)
  )

  return (
    <div className="my-2 overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headerCells.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold"
                style={{
                  background: '#0a0a0a',
                  borderBottom: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2"
                  style={{
                    borderBottom: ri < dataRows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function parseBasicMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let codeLanguage = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(<CodeBlock key={`code-${i}`} code={codeLines.join('\n')} language={codeLanguage} />)
        codeLines = []
        codeLanguage = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeLanguage = line.slice(3).trim()
      }
      i++
      continue
    }

    if (inCodeBlock) { codeLines.push(line); i++; continue }

    // Empty lines
    if (line.trim() === '') { elements.push(<br key={`br-${i}`} />); i++; continue }

    // Horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '12px 0' }} />)
      i++
      continue
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes: Record<number, string> = { 1: '1.25rem', 2: '1.1rem', 3: '1rem', 4: '0.9rem', 5: '0.85rem', 6: '0.8rem' }
      elements.push(
        <div key={`h-${i}`} style={{ fontSize: sizes[level], fontWeight: 700, color: 'var(--text-primary)', marginTop: level <= 2 ? 12 : 8, marginBottom: 4 }}>
          {processInline(headerMatch[2])}
        </div>
      )
      i++
      continue
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="my-2 pl-3 py-1" style={{ borderLeft: '3px solid var(--accent)', background: 'var(--accent-subtle)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', color: 'var(--text-secondary)' }}>
          {quoteLines.map((ql, qi) => (
            <div key={qi} className="text-xs leading-relaxed">{processInline(ql)}</div>
          ))}
        </blockquote>
      )
      continue
    }

    // Tables
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1])) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<div key={`tbl-${i}`}>{parseTable(tableLines)}</div>)
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`line-${i}`} className="my-0.5 leading-relaxed">
        {processInline(line)}
      </p>
    )
    i++
  }
  return elements
}

function processInline(text: string): ReactNode {
  const parts: ReactNode[] = []
  let remaining = text
  let keyCounter = 0

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(
        <code key={`ic-${keyCounter++}`} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(245,158,11,0.06)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Images (must be before links)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      parts.push(
        <img key={`img-${keyCounter++}`} src={imgMatch[2]} alt={imgMatch[1]} className="my-1 rounded-lg" style={{ maxWidth: '100%', maxHeight: 300, border: '1px solid var(--border-default)' }} />
      )
      remaining = remaining.slice(imgMatch[0].length)
      continue
    }

    // Links
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      parts.push(
        <a key={`a-${keyCounter++}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'rgba(0,191,255,0.3)', textUnderlineOffset: '2px' }}>
          {linkMatch[1]}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={`b-${keyCounter++}`} className="font-semibold" style={{ color: 'var(--text-primary)' }}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~([^~]+)~~/)
    if (strikeMatch) {
      parts.push(<del key={`del-${keyCounter++}`} style={{ opacity: 0.6 }}>{strikeMatch[1]}</del>)
      remaining = remaining.slice(strikeMatch[0].length)
      continue
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      parts.push(<em key={`em-${keyCounter++}`} className="italic" style={{ opacity: 0.85 }}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // List items
    const listMatch = remaining.match(/^[-*]\s+(.+)/)
    if (listMatch) {
      parts.push(
        <span key={`li-${keyCounter++}`} className="flex items-start gap-2 my-0.5">
          <span style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 10 }}>&#x2022;</span>
          <span>{listMatch[1]}</span>
        </span>
      )
      remaining = remaining.slice(listMatch[0].length)
      continue
    }

    // No special chars found, push remaining
    const nextSpecial = remaining.search(/[`*~!\[]/)
    if (nextSpecial === -1) { parts.push(remaining); break }
    else if (nextSpecial === 0) { parts.push(remaining[0]); remaining = remaining.slice(1) }
    else { parts.push(remaining.slice(0, nextSpecial)); remaining = remaining.slice(nextSpecial) }
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function TypewriterText({ content }: { content: string }) {
  const [displayText, setDisplayText] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = 0
    setDisplayText('')
    setDone(false)
    const interval = setInterval(() => {
      if (indexRef.current < content.length) {
        const chars = content[indexRef.current] === ' ' ? 3 : 1
        const nextIndex = Math.min(indexRef.current + chars, content.length)
        setDisplayText(content.slice(0, nextIndex))
        indexRef.current = nextIndex
      } else {
        setDone(true)
        clearInterval(interval)
      }
    }, 18)
    return () => clearInterval(interval)
  }, [content])

  return <span className={!done ? 'typewriter-cursor' : ''}>{parseBasicMarkdown(displayText)}</span>
}

function formatTimestamp(ts: string | Date): string {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MessageBubble({
  role,
  content,
  brainUsed,
  provider,
  model,
  timestamp,
  isNew = false,
  isStreaming = false,
  onCopy,
  onSpeak,
  messageId,
  onFeedback,
  feedbackGiven,
  confidence,
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCorrectionInput, setShowCorrectionInput] = useState(false)
  const [correctionText, setCorrectionText] = useState('')
  const isUser = role === 'user'

  const confidenceColor = confidence === 'high' ? '#22c55e' : confidence === 'low' ? '#ef4444' : '#f59e0b'

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(content)
    setCopied(true)
    onCopy?.(content)
    setTimeout(() => setCopied(false), 2000)
  }, [content, onCopy])

  return (
    <motion.div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={isNew ? { opacity: 0, y: 8, boxShadow: isUser ? 'none' : '0 0 20px var(--accent-glow)' } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0, boxShadow: '0 0 0px transparent' }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`relative max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
        style={{
          background: isUser
            ? 'rgba(245, 158, 11, 0.06)'
            : 'var(--bg-secondary)',
          border: isUser
            ? '2px solid #333333'
            : '1px solid var(--border-default)',
        }}
      >
        {/* Minimal metadata line — no heavy pills */}
        {!isUser && (brainUsed || provider) && (
          <div className="flex items-center gap-2 mb-1.5">
            {brainUsed && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {brainUsed}
              </span>
            )}
            {provider && (
              <>
                {brainUsed && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>}
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {provider}{model ? ` ${model}` : ''}
                </span>
              </>
            )}
            {confidence && (
              <>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: confidenceColor }} title={confidence === 'high' ? 'High confidence' : confidence === 'low' ? 'Low confidence' : 'Medium confidence'} />
              </>
            )}
          </div>
        )}

        {/* Text content */}
        {content ? (
          <div className="text-[13px] leading-relaxed" style={{ color: isUser ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {isNew && !isUser ? <TypewriterText content={content} /> : parseBasicMarkdown(content)}
          </div>
        ) : null}

        {/* Streaming indicator */}
        {isStreaming && !isUser && content.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <div className="h-0.5 rounded-full overflow-hidden flex-1" style={{ background: 'var(--bg-tertiary)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--accent-gradient)', width: '60%' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{content.length} chars</span>
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {formatTimestamp(timestamp)}
          </div>
        )}

        {/* Feedback buttons for assistant messages */}
        {!isUser && messageId && onFeedback && (
          <div className="mt-2 flex items-center gap-1.5">
            <motion.button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
              style={{
                background: feedbackGiven === 'praise' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                border: `1px solid ${feedbackGiven === 'praise' ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-subtle)'}`,
                color: feedbackGiven === 'praise' ? '#22c55e' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => onFeedback(messageId, 'praise')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Good response"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={feedbackGiven === 'praise' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              {feedbackGiven === 'praise' ? 'Liked' : ''}
            </motion.button>
            <motion.button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
              style={{
                background: feedbackGiven === 'complaint' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                border: `1px solid ${feedbackGiven === 'complaint' ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-subtle)'}`,
                color: feedbackGiven === 'complaint' ? '#ef4444' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => onFeedback(messageId, 'complaint')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Bad response"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={feedbackGiven === 'complaint' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              {feedbackGiven === 'complaint' ? 'Disliked' : ''}
            </motion.button>
            <motion.button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
              style={{
                background: showCorrectionInput ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                border: `1px solid ${showCorrectionInput ? 'rgba(245, 158, 11, 0.2)' : 'var(--border-subtle)'}`,
                color: showCorrectionInput ? '#f59e0b' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
              onClick={() => setShowCorrectionInput(!showCorrectionInput)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Correct this response"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </motion.button>
          </div>
        )}

        {/* Correction input */}
        <AnimatePresence>
          {showCorrectionInput && (
            <motion.div
              className="mt-2 flex gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type="text"
                className="flex-1 px-3 py-1.5 rounded-lg text-[11px]"
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                placeholder="What should the correct answer be?"
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && correctionText.trim()) {
                    onFeedback!(messageId!, 'correction', correctionText.trim())
                    setCorrectionText('')
                    setShowCorrectionInput(false)
                  }
                }}
              />
              <motion.button
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '2px solid #333333',
                  color: '#f59e0b',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (correctionText.trim()) {
                    onFeedback!(messageId!, 'correction', correctionText.trim())
                    setCorrectionText('')
                    setShowCorrectionInput(false)
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Save
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute -top-3 right-2 flex items-center gap-1"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <motion.button
                className="flex items-center justify-center rounded-md px-1.5 py-1 text-[10px]"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: copied ? 'var(--color-success)' : 'var(--text-tertiary)', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                onClick={handleCopy}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Copy message"
              >
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </motion.button>
              {!isUser && onSpeak && (
                <motion.button
                  className="flex items-center justify-center rounded-md px-1.5 py-1"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                  onClick={() => onSpeak(content)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Read aloud"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

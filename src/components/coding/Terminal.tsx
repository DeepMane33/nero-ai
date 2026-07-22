'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TerminalProps {
  onCommand?: (command: string) => Promise<string>
  placeholder?: string
  height?: string
}

interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'system'
  content: string
  timestamp: Date
}

/* ------------------------------------------------------------------ */
/*  Terminal Component                                                 */
/* ------------------------------------------------------------------ */

export default function Terminal({
  onCommand,
  placeholder = '$ ',
  height = '300px',
}: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'system',
      content: 'Nero AI Terminal — Type commands or press Ctrl+L to clear',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on click
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  // Add a line to the terminal
  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type,
        content,
        timestamp: new Date(),
      },
    ])
  }, [])

  // Handle command submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    const command = input.trim()
    if (!command) return

    // Add input line
    addLine('input', `${placeholder}${command}`)
    
    // Add to history
    setHistory(prev => [...prev, command])
    setHistoryIndex(-1)
    setInput('')

    // Handle special commands
    if (command === 'clear' || command === 'cls') {
      setLines([])
      return
    }

    if (command === 'help') {
      addLine('system', 'Available commands:\n  clear/cls - Clear terminal\n  help - Show this help\n  Any other command will be executed in the shell.')
      return
    }

    // Execute command
    if (onCommand) {
      setIsRunning(true)
      try {
        const output = await onCommand(command)
        if (output) {
          // Check if output looks like an error
          const isError = output.toLowerCase().includes('error') || 
                         output.toLowerCase().includes('failed') ||
                         output.toLowerCase().includes('not found')
          addLine(isError ? 'error' : 'output', output)
        }
      } catch (err: any) {
        addLine('error', err.message || 'Command failed')
      } finally {
        setIsRunning(false)
      }
    } else {
      addLine('error', 'No command handler configured')
    }
  }, [input, placeholder, onCommand, addLine])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Arrow up - previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex])
      }
    }
    
    // Arrow down - next command
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }

    // Ctrl+L - clear
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault()
      setLines([])
    }

    // Ctrl+C - cancel
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault()
      addLine('system', '^C')
      setInput('')
    }
  }, [history, historyIndex, addLine])

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border border-white/10 bg-black/60 backdrop-blur-xl font-mono"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-white/50 ml-2">Terminal</span>
        {isRunning && (
          <span className="text-xs text-yellow-400 ml-auto">
            <svg className="w-3 h-3 inline animate-spin mr-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running...
          </span>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 text-sm text-white/80 cursor-text"
        onClick={handleContainerClick}
        style={{ scrollBehavior: 'smooth' }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap mb-1 ${
              line.type === 'input'
                ? 'text-green-400'
                : line.type === 'error'
                ? 'text-red-400'
                : line.type === 'system'
                ? 'text-blue-400 italic'
                : 'text-white/70'
            }`}
          >
            {line.content}
          </div>
        ))}

        {/* Input line */}
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-green-400 mr-2">{placeholder}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            className="flex-1 bg-transparent text-white/90 focus:outline-none placeholder-white/30 disabled:opacity-50"
            placeholder={isRunning ? 'Executing...' : 'Type a command...'}
            autoFocus
          />
        </form>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-t border-white/10 text-xs text-white/40">
        <span>{lines.length} lines</span>
        <span>{history.length} in history</span>
      </div>
    </div>
  )
}

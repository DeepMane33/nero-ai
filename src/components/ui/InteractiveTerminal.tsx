'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

interface TerminalLine {
  text: string
  type?: 'normal' | 'hl' | 'ok' | 'warn'
}

interface InteractiveTerminalProps {
  className?: string
  title?: string
}

const COMMANDS: Record<string, string | (() => string)> = {
  help: 'Available commands: help, about, status, clear, time, date, whoami, echo [text]',
  about: 'Nero AI — Personal AI Operating System. Building minds, not just code.',
  status: 'All systems operational. Memory: OK. Network: OK. LLM: Online.',
  time: () => `Current time: ${new Date().toLocaleTimeString()}`,
  date: () => `Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
  whoami: 'You are Deep — the creator of Nero AI.',
  clear: '__CLEAR__',
}

export default function InteractiveTerminal({
  className = '',
  title = 'TERMINAL // v1.0',
}: InteractiveTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: 'Type "help" for commands.', type: 'hl' },
  ])
  const [input, setInput] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  const addLines = (newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim()) return

    const cmd = input.trim().toLowerCase()
    setInput('')

    addLines([{ text: `❯ ${cmd}` }])

    const parts = cmd.split(' ')
    const baseCmd = parts[0]
    const args = parts.slice(1).join(' ')

    if (baseCmd === 'echo' && args) {
      addLines([{ text: args }])
      return
    }

    const result = COMMANDS[baseCmd]
    if (!result) {
      addLines([{ text: `Unknown command: ${baseCmd}`, type: 'warn' }])
      return
    }

    if (result === '__CLEAR__') {
      setLines([])
      return
    }

    const output = typeof result === 'function' ? result() : result
    addLines([{ text: output }])
  }

  return (
    <div
      className={`terminal ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="terminal-header">
        <div className="terminal-dots">
          <span style={{ background: '#e74c3c' }} />
          <span style={{ background: '#f39c12' }} />
          <span style={{ background: '#27ae60' }} />
        </div>
        <span className="terminal-title">{title}</span>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {lines.map((line, i) => (
          <div key={i} className="terminal-line">
            {line.type ? (
              <span className={line.type}>{line.text}</span>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>

      <div className="terminal-input-line">
        <span className="terminal-prompt">❯</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type 'help'..."
          autoFocus
        />
      </div>
    </div>
  )
}

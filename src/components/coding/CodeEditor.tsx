'use client'

import { useState, useCallback } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CodeEditorProps {
  initialCode?: string
  language?: string
  onChange?: (code: string) => void
  onRun?: (code: string, language: string) => void
  readOnly?: boolean
  height?: string
}

/* ------------------------------------------------------------------ */
/*  Language Configurations                                            */
/* ------------------------------------------------------------------ */

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: '.js', icon: '🟨' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts', icon: '🟦' },
  { id: 'python', name: 'Python', ext: '.py', icon: '🐍' },
  { id: 'shell', name: 'Shell', ext: '.sh', icon: '🖥️' },
]

const LANGUAGE_THEMES: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  shell: 'shell',
}

/* ------------------------------------------------------------------ */
/*  CodeEditor Component                                               */
/* ------------------------------------------------------------------ */

export default function CodeEditor({
  initialCode = '',
  language = 'javascript',
  onChange,
  onRun,
  readOnly = false,
  height = '400px',
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode)
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [isRunning, setIsRunning] = useState(false)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value
    setCode(newCode)
    onChange?.(newCode)
  }, [onChange])

  const handleRun = useCallback(async () => {
    if (!onRun || isRunning) return
    setIsRunning(true)
    try {
      await onRun(code, selectedLanguage)
    } finally {
      setIsRunning(false)
    }
  }, [code, selectedLanguage, onRun, isRunning])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
    // Tab to insert spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      onChange?.(newCode)
      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }, [code, handleRun, onChange])

  const currentLang = LANGUAGES.find(l => l.id === selectedLanguage) || LANGUAGES[0]

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          
          {/* Language selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="ml-3 px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-white/80 focus:outline-none focus:border-blue-500/50"
            disabled={readOnly}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.id} value={lang.id}>
                {lang.icon} {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={readOnly || isRunning || !code.trim()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
                     bg-green-500/20 text-green-400 border border-green-500/30
                     hover:bg-green-500/30 transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Run
            </>
          )}
        </button>
      </div>

      {/* Editor area */}
      <div className="relative" style={{ height }}>
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-black/20 border-r border-white/10 overflow-hidden">
          <div className="p-3 text-right">
            {code.split('\n').map((_, i) => (
              <div key={i} className="text-xs text-white/30 leading-6 font-mono">
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Code textarea */}
        <textarea
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className="w-full h-full pl-14 pr-4 py-3 bg-transparent text-white/90 font-mono text-sm
                     leading-6 resize-none focus:outline-none placeholder-white/30"
          placeholder="// Write your code here..."
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-t border-white/10 text-xs text-white/40">
        <span>{currentLang.icon} {currentLang.name}</span>
        <span>{code.split('\n').length} lines | {code.length} chars</span>
      </div>
    </div>
  )
}

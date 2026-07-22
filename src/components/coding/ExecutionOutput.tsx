'use client'

import { useState, useCallback } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ExecutionOutputProps {
  output: string
  error?: string | null
  language?: string
  executionTime?: number
  exitCode?: number | null
  status?: 'success' | 'error' | 'running'
}

/* ------------------------------------------------------------------ */
/*  ExecutionOutput Component                                          */
/* ------------------------------------------------------------------ */

export default function ExecutionOutput({
  output,
  error,
  language,
  executionTime,
  exitCode,
  status = 'success',
}: ExecutionOutputProps) {
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const handleCopy = useCallback(async () => {
    const textToCopy = error || output
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [output, error])

  const hasError = error && error.trim().length > 0
  const displayText = hasError ? error : output
  const lines = displayText.split('\n')

  // Determine status color
  const statusColor = status === 'error' || hasError
    ? 'red'
    : status === 'running'
    ? 'yellow'
    : 'green'

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-${statusColor}-500`} />
            <span className="text-xs text-white/50">
              {status === 'error' ? 'Error' : status === 'running' ? 'Running...' : 'Success'}
            </span>
          </div>

          {/* Language badge */}
          {language && (
            <span className="px-2 py-0.5 text-xs bg-white/10 rounded text-white/50">
              {language}
            </span>
          )}

          {/* Execution time */}
          {executionTime !== undefined && (
            <span className="text-xs text-white/30">
              {executionTime < 1000 ? `${executionTime}ms` : `${(executionTime / 1000).toFixed(2)}s`}
            </span>
          )}

          {/* Exit code */}
          {exitCode !== null && exitCode !== undefined && (
            <span className={`text-xs ${exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
              Exit: {exitCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Raw toggle */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="px-2 py-1 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded transition-colors"
          >
            {showRaw ? 'Formatted' : 'Raw'}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output content */}
      <div className="overflow-auto max-h-96 p-4">
        {showRaw ? (
          <pre className="text-sm text-white/70 font-mono whitespace-pre-wrap break-words">
            {displayText}
          </pre>
        ) : (
          <div className="space-y-0.5">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 text-sm font-mono ${
                  hasError && line.trim()
                    ? 'text-red-400/80'
                    : 'text-white/70'
                }`}
              >
                {/* Line number */}
                <span className="text-white/20 select-none text-right w-6 flex-shrink-0">
                  {i + 1}
                </span>
                {/* Line content */}
                <span className="flex-1 whitespace-pre-wrap break-words">
                  {line || ' '}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-t border-white/10 text-xs text-white/40">
        <span>{lines.length} lines</span>
        <span>{displayText.length} chars</span>
      </div>
    </div>
  )
}

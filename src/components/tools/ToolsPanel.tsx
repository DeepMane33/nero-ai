'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type ToolTab = 'calculator' | 'code_runner' | 'web_search' | 'file_read'

interface ToolsPanelProps {
  isVisible: boolean
  onToggle: () => void
}

const toolTabs: { id: ToolTab; label: string; icon: string }[] = [
  { id: 'calculator', label: 'Calculator', icon: '🧮' },
  { id: 'code_runner', label: 'Code Runner', icon: '⚡' },
  { id: 'web_search', label: 'Web Search', icon: '🔍' },
  { id: 'file_read', label: 'File Reader', icon: '📄' },
]

export default function ToolsPanel({ isVisible, onToggle }: ToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>('calculator')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculator state
  const [calcExpression, setCalcExpression] = useState('')
  const [calcResult, setCalcResult] = useState('')

  // Code runner state
  const [codeInput, setCodeInput] = useState('')
  const [codeOutput, setCodeOutput] = useState('')

  // Web search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // File reader state
  const [filePath, setFilePath] = useState('')
  const [fileContent, setFileContent] = useState('')

  const outputRef = useRef<HTMLDivElement>(null)

  const callTool = useCallback(async (tool: string, params: Record<string, string>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      return data
    } catch (err: any) {
      setError(err.message || 'Tool execution failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCalculate = async () => {
    if (!calcExpression.trim()) return
    const data = await callTool('calculator', { expression: calcExpression })
    if (data) setCalcResult(data.result ?? String(data))
  }

  const handleRunCode = async () => {
    if (!codeInput.trim()) return
    setCodeOutput('')
    const data = await callTool('code_runner', { code: codeInput })
    if (data) setCodeOutput(data.output ?? data.result ?? JSON.stringify(data, null, 2))
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    const data = await callTool('web_search', { query: searchQuery })
    if (data) setSearchResults(data.results ?? (Array.isArray(data) ? data : []))
  }

  const handleReadFile = async () => {
    if (!filePath.trim()) return
    const data = await callTool('file_read', { path: filePath })
    if (data) setFileContent(data.content ?? data.result ?? JSON.stringify(data, null, 2))
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const handleClear = () => {
    setError(null)
    if (activeTab === 'calculator') { setCalcExpression(''); setCalcResult('') }
    if (activeTab === 'code_runner') { setCodeInput(''); setCodeOutput('') }
    if (activeTab === 'web_search') { setSearchQuery(''); setSearchResults([]) }
    if (activeTab === 'file_read') { setFilePath(''); setFileContent('') }
  }

  const getOutputContent = (): string => {
    if (activeTab === 'calculator') return calcResult
    if (activeTab === 'code_runner') return codeOutput
    if (activeTab === 'web_search') return searchResults.length ? JSON.stringify(searchResults, null, 2) : ''
    if (activeTab === 'file_read') return fileContent
    return ''
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: '#000000',
    border: '2px solid #333333',
    borderRadius: '0px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: '#000000',
    border: '2px solid #333333',
    borderRadius: '0px',
    color: '#38bdf8',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '420px',
            background: 'rgba(13, 17, 23, 0.95)',

            borderLeft: '2px solid #333333',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
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
                🛠️
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
                  Tools
                </h2>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  UTILITIES
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleClear} style={{ ...buttonStyle, padding: '6px 10px', fontSize: '11px' }}>
                Clear
              </button>
              <button onClick={onToggle} style={{
                width: '32px', height: '32px', borderRadius: '0px',
                background: '#0a0a0a',
                border: '2px solid #333333',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}>
                ✕
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            padding: '8px 12px',
            gap: '4px',
            borderBottom: '2px solid #333333',
            overflowX: 'auto',
          }}>
            {toolTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setError(null) }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '0px',
                  border: 'none',
                  background: activeTab === tab.id
                    ? 'rgba(56, 189, 248, 0.15)'
                    : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tool Content */}
          <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Calculator */}
            {activeTab === 'calculator' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  EXPRESSION
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={calcExpression}
                    onChange={(e) => setCalcExpression(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCalculate()}
                    placeholder="e.g. 2 + 2 * 3"
                    style={inputStyle}
                  />
                  <button onClick={handleCalculate} style={buttonStyle} disabled={loading}>
                    {loading ? '...' : '='}
                  </button>
                </div>
                {calcResult && (
                  <div style={{
                    padding: '14px',
                    background: '#000000',
                    borderRadius: '0px',
                    border: '2px solid #333333',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(56, 189, 248, 0.6)', fontFamily: "'JetBrains Mono', monospace" }}>
                        RESULT
                      </span>
                      <button onClick={() => handleCopy(calcResult)} style={{ ...buttonStyle, padding: '4px 8px', fontSize: '10px' }}>
                        Copy
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
                      {calcResult}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Code Runner */}
            {activeTab === 'code_runner' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  JAVASCRIPT CODE
                </label>
                <textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="console.log('Hello, Nero!')"
                  style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                />
                <button onClick={handleRunCode} style={buttonStyle} disabled={loading}>
                  {loading ? '⏳ Running...' : '▶ Run Code'}
                </button>
                {codeOutput && (
                  <div style={{
                    flex: 1,
                    padding: '14px',
                    background: '#000000',
                    borderRadius: '0px',
                    border: '2px solid #333333',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                        OUTPUT
                      </span>
                      <button onClick={() => handleCopy(codeOutput)} style={{ ...buttonStyle, padding: '4px 8px', fontSize: '10px' }}>
                        Copy
                      </button>
                    </div>
                    <pre style={{
                      margin: 0,
                      fontSize: '13px',
                      color: '#c0c0c0',
                      fontFamily: "'JetBrains Mono', monospace",
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {codeOutput}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}

            {/* Web Search */}
            {activeTab === 'web_search' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  SEARCH QUERY
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search the web..."
                    style={inputStyle}
                  />
                  <button onClick={handleSearch} style={buttonStyle} disabled={loading}>
                    {loading ? '...' : '🔍'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {searchResults.length} RESULTS
                      </span>
                      <button onClick={() => handleCopy(JSON.stringify(searchResults, null, 2))} style={{ ...buttonStyle, padding: '4px 8px', fontSize: '10px' }}>
                        Copy All
                      </button>
                    </div>
                    {searchResults.map((result, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                          padding: '12px',
                          background: '#000000',
                          borderRadius: '0px',
                          border: '2px solid #333333',
                        }}
                      >
                        <a href={result.url || '#'} target="_blank" rel="noreferrer" style={{
                          color: '#38bdf8', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                        }}>
                          {result.title || 'Untitled'}
                        </a>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.5 }}>
                          {result.snippet || result.description || ''}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* File Reader */}
            {activeTab === 'file_read' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  FILE PATH
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReadFile()}
                    placeholder="/path/to/file.txt"
                    style={inputStyle}
                  />
                  <button onClick={handleReadFile} style={buttonStyle} disabled={loading}>
                    {loading ? '...' : '📖'}
                  </button>
                </div>
                {fileContent && (
                  <div style={{
                    flex: 1,
                    padding: '14px',
                    background: '#000000',
                    borderRadius: '0px',
                    border: '2px solid #333333',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                        FILE CONTENT
                      </span>
                      <button onClick={() => handleCopy(fileContent)} style={{ ...buttonStyle, padding: '4px 8px', fontSize: '10px' }}>
                        Copy
                      </button>
                    </div>
                    <pre style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontFamily: "'JetBrains Mono', monospace",
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}>
                      {fileContent}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{
                    padding: '12px',
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '2px solid #333333',
                    borderRadius: '0px',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

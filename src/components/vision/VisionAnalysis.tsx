'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisResult {
  description: string
  objects?: string[]
  text?: string
  tags?: string[]
  confidence?: number
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export default function VisionAnalysis() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported format. Use PNG, JPG, GIF, or WebP.`)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum 20MB.')
      return
    }
    setError(null)
    setResult(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) handleFile(file)
        break
      }
    }
  }, [handleFile])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const handleLoadUrl = useCallback(async () => {
    if (!imageUrl.trim()) return
    setError(null)
    setResult(null)
    setImageFile(null)
    setImagePreview(imageUrl.trim())
  }, [imageUrl])

  const handleAnalyze = useCallback(async () => {
    if (!imageFile && !imagePreview) {
      setError('Please upload or provide an image first')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    if (progressInterval.current) clearInterval(progressInterval.current)
    progressInterval.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90))
    }, 500)

    try {
      const formData = new FormData()
      if (imageFile) {
        formData.append('image', imageFile)
      } else if (imageUrl.trim()) {
        formData.append('url', imageUrl.trim())
      }

      const headers: Record<string, string> = {};
      const storedKey = localStorage.getItem('nero-gemini-key');
      if (storedKey) headers['x-api-key'] = storedKey;

      const response = await fetch('/api/vision', {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setProgress(100)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [imageFile, imagePreview, imageUrl])

  const handleReset = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl('')
    setResult(null)
    setError(null)
    setProgress(0)
  }, [])

  const handleCopyResult = useCallback(() => {
    if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2)).catch(() => {})
  }, [result])

  const dropZoneStyle: React.CSSProperties = {
    padding: '40px 20px',
    borderRadius: '0px',
    border: `2px dashed ${isDragging ? '#38bdf8' : '#111111'}`,
    background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
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
            👁️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
              Vision Analysis
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
              IMAGE AI
            </p>
          </div>
        </div>
        <button onClick={handleReset} style={{
          padding: '6px 12px',
          borderRadius: '0px',
          background: '#0a0a0a',
          border: '2px solid #333333',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
          cursor: 'pointer',
        }}>
          Reset
        </button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Drop Zone */}
        {!imagePreview && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={dropZoneStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: isDragging ? 1 : 0.4 }}>
              {isDragging ? '📥' : '🖼️'}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
              {isDragging ? 'Drop image here' : 'Drag & drop an image'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)' }}>
              or click to browse • Paste from clipboard
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
              PNG, JPG, GIF, WebP • Max 20MB
            </p>
          </div>
        )}

        {/* URL Input */}
        {!imagePreview && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
              placeholder="Or paste image URL..."
              style={{
                flex: 1,
                padding: '10px 14px',
                background: '#000000',
                border: '2px solid #333333',
                borderRadius: '0px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
            <button onClick={handleLoadUrl} style={{
              padding: '8px 16px',
              background: '#000000',
              border: '2px solid #333333',
              borderRadius: '0px',
              color: '#38bdf8',
              fontSize: '13px',
              cursor: 'pointer',
            }}>
              Load
            </button>
          </div>
        )}

        {/* Image Preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ position: 'relative' }}
            >
              <div style={{
                borderRadius: '0px',
                overflow: 'hidden',
                border: '2px solid #333333',
                background: 'rgba(0, 0, 0, 0.3)',
              }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  onError={() => setError('Failed to load image')}
                />
              </div>
              <button onClick={handleReset} style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '28px',
                height: '28px',
                borderRadius: '0px',
                background: 'rgba(0, 0, 0, 0.7)',
                border: '2px solid #333333',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}>
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analyze Button */}
        {imagePreview && !result && (
          <motion.button
            onClick={handleAnalyze}
            disabled={loading}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '0px',
              background: loading
                ? 'rgba(56, 189, 248, 0.1)'
                : '#000000',
              border: '2px solid #333333',
              color: '#38bdf8',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            whileHover={!loading ? { boxShadow: '0 0 20px rgba(56, 189, 248, 0.2)' } : {}}
          >
            {loading ? 'Analyzing...' : '🔍 Analyze Image'}
          </motion.button>
        )}

        {/* Loading Progress */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{
                height: '4px',
                borderRadius: '0px',
                background: '#0a0a0a',
                overflow: 'hidden',
              }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  style={{
                    height: '100%',
                    borderRadius: '0px',
                    background: '#000000',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.4)',
                  }}
                />
              </div>
              <p style={{
                textAlign: 'center',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                margin: '8px 0 0',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Processing image...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '0px',
                border: '2px solid #333333',
                overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '2px solid #333333',
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#38bdf8',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}>
                  ANALYSIS RESULT
                </span>
                <button onClick={handleCopyResult} style={{
                  padding: '4px 10px',
                  borderRadius: '0px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '2px solid #333333',
                  color: '#38bdf8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Copy
                </button>
              </div>

              <div style={{ padding: '16px' }}>
                <p style={{
                  margin: '0 0 12px',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: 1.6,
                }}>
                  {result.description}
                </p>

                {result.confidence !== undefined && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                      CONFIDENCE: {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                )}

                {result.objects && result.objects.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                      DETECTED OBJECTS
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {result.objects.map((obj, i) => (
                        <span key={i} style={{
                          padding: '4px 10px',
                          borderRadius: '0px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '2px solid #333333',
                          color: '#38bdf8',
                          fontSize: '12px',
                        }}>
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.tags && result.tags.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                      TAGS
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {result.tags.map((tag, i) => (
                        <span key={i} style={{
                          padding: '4px 10px',
                          borderRadius: '0px',
                          background: 'rgba(168, 85, 247, 0.08)',
                          border: '2px solid #333333',
                          color: '#a855f7',
                          fontSize: '12px',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.text && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '0px',
                    border: '2px solid #333333',
                  }}>
                    <span style={{ fontSize: '11px', color: '#c0c0c0', fontFamily: "'JetBrains Mono', monospace" }}>
                      OCR EXTRACTED TEXT
                    </span>
                    <pre style={{
                      margin: '8px 0 0',
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontFamily: "'JetBrains Mono', monospace",
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {result.text}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                padding: '12px 16px',
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
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AICore from '@/components/ui/AICore'
import GlowButton from '@/components/ui/GlowButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedVideo {
  id: string
  url: string
  prompt: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GeneratedVideo[]>([])
  const [progress, setProgress] = useState(0)
  const [hfAvailable, setHfAvailable] = useState<boolean | null>(null)

  // Check if HF_TOKEN is configured
  useEffect(() => {
    fetch('/api/video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(async (r) => {
        if (r.status === 503) {
          const data = await r.json().catch(() => ({}))
          if (data.instructions) {
            setHfAvailable(false)
          }
        } else {
          setHfAvailable(true)
        }
      })
      .catch(() => setHfAvailable(true)) // Assume available on network error
  }, [])

  // Generate video ---------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setProgress(0)

    // Simulate progress (video takes a while)
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 4, 90))
    }, 1500)

    try {
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const newVideo: GeneratedVideo = {
        id: `vid-${Date.now()}`,
        url,
        prompt: trimmed,
        timestamp: Date.now(),
      }

      setGallery((prev) => [newVideo, ...prev].slice(0, 6))
      setProgress(100)
    } catch (err: any) {
      setError(err.message || 'Failed to generate video')
    } finally {
      clearInterval(progressInterval)
      setIsGenerating(false)
      setTimeout(() => setProgress(0), 1500)
    }
  }, [prompt, isGenerating])

  // Download helper --------------------------------------------------------
  const handleDownload = useCallback((vid: GeneratedVideo) => {
    const a = document.createElement('a')
    a.href = vid.url
    a.download = `nero-${vid.id}.mp4`
    a.click()
  }, [])

  // -----------------------------------------------------------------------
  // Render — No HF token
  // -----------------------------------------------------------------------

  if (hfAvailable === false) {
    return (
      <div className="flex flex-col h-full relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.04) 0%, transparent 60%)',
          }}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 relative z-10">
          <AICore state="idle" size={100} />
          <div
            className="max-w-md text-center rounded-xl p-6"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <h3
              className="text-base font-semibold tracking-wide mb-3"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              Video Generation Setup Required
            </h3>
            <p
              className="text-sm mb-4 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Video generation uses Hugging Face&apos;s free Inference API. You need a
              free Hugging Face token to use this feature.
            </p>
            <div
              className="text-left rounded-lg p-4 mb-4 font-mono text-xs space-y-2"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(56,189,248,0.1)',
                color: 'rgba(56,189,248,0.7)',
              }}
            >
              <p>
                <span style={{ color: '#ff7b72' }}>1.</span> Go to{' '}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  huggingface.co/settings/tokens
                </a>
              </p>
              <p>
                <span style={{ color: '#ff7b72' }}>2.</span> Create a free account
                and generate a token
              </p>
              <p>
                <span style={{ color: '#ff7b72' }}>3.</span> Add to{' '}
                <span style={{ color: '#a5d6ff' }}>.env.local</span>:
              </p>
              <p
                className="pl-4"
                style={{ color: '#34d399' }}
              >
                HF_TOKEN=hf_your_token_here
              </p>
              <p>
                <span style={{ color: '#ff7b72' }}>4.</span> Restart the dev server
              </p>
            </div>
            <GlowButton
              variant="primary"
              size="md"
              onClick={() => setHfAvailable(true)}
            >
              I&apos;ve added my token
            </GlowButton>
          </div>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Render — Main UI
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0 relative z-10"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(10,10,26,0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isGenerating ? '#38bdf8' : '#34d399',
              boxShadow: isGenerating
                ? '0 0 8px rgba(56,189,248,0.6)'
                : '0 0 8px rgba(52,211,153,0.6)',
              animation: isGenerating ? 'pulse 1s ease-in-out infinite' : undefined,
            }}
          />
          <h2
            className="text-sm font-medium tracking-wide"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          >
            VIDEO FORGE
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider"
            style={{
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.15)',
              color: 'rgba(168,85,247,0.7)',
            }}
          >
            Hugging Face
          </span>
        </div>

        {gallery.length > 0 && (
          <span
            className="text-[11px] font-mono tracking-wider"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            {gallery.length} / 6 generated
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Prompt area */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <label
              className="block text-[11px] font-mono uppercase tracking-[0.15em] mb-2"
              style={{ color: 'rgba(168,85,247,0.5)' }}
            >
              Describe your video
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              placeholder="A timelapse of clouds moving over a futuristic cityscape..."
              rows={3}
              disabled={isGenerating}
              className="w-full bg-transparent text-sm resize-none outline-none disabled:opacity-50"
              style={{
                color: 'rgba(255,255,255,0.9)',
                lineHeight: '1.6',
              }}
            />

            <div className="flex flex-wrap items-end gap-3 mt-4">
              {/* Generate button */}
              <GlowButton
                variant="primary"
                size="lg"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                icon={
                  isGenerating ? (
                    <div className="spinner-neon-sm" />
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )
                }
              >
                {isGenerating ? '' : 'Generate Video'}
              </GlowButton>

              {isGenerating && (
                <span
                  className="text-[11px] font-mono tracking-wider"
                  style={{ color: 'rgba(56,189,248,0.5)' }}
                >
                  This may take 1-2 minutes...
                </span>
              )}
            </div>

            {/* Progress bar */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 6, marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="rounded-full overflow-hidden"
                  style={{ background: 'rgba(168,85,247,0.08)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #a855f7, #38bdf8, #38bdf8)',
                      backgroundSize: '200% 100%',
                      animation: 'gradient-shift 2s linear infinite',
                    }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-3 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
                  style={{
                    background: 'rgba(248,113,113,0.1)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    color: '#f87171',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generating indicator */}
          <AnimatePresence>
            {isGenerating && gallery.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <AICore state="thinking" size={100} />
                <span
                  className="text-xs font-mono tracking-[0.15em] uppercase"
                  style={{ color: 'rgba(168,85,247,0.5)' }}
                >
                  Rendering video frames...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!isGenerating && gallery.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="flex flex-col items-center justify-center py-16 gap-5"
            >
              <AICore state="idle" size={90} />
              <div className="text-center">
                <p
                  className="text-sm font-medium tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Generate AI videos from text
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  Powered by Hugging Face Inference API
                </p>
              </div>
            </motion.div>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div>
              <h3
                className="text-[11px] font-mono uppercase tracking-[0.2em] mb-4"
                style={{ color: 'rgba(168,85,247,0.4)' }}
              >
                Generated Videos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <AnimatePresence>
                  {gallery.map((vid, i) => (
                    <motion.div
                      key={vid.id}
                      initial={{ opacity: 0, scale: 0.92, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.35, delay: i * 0.06 }}
                      className="group relative rounded-xl overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* Gradient border glow on hover */}
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                        style={{
                          boxShadow:
                            '0 0 20px rgba(168,85,247,0.15), inset 0 0 20px rgba(168,85,247,0.05)',
                        }}
                      />

                      <video
                        src={vid.url}
                        controls
                        loop
                        playsInline
                        className="w-full rounded-t-xl"
                        style={{ background: '#000' }}
                      />

                      {/* Info bar */}
                      <div
                        className="p-3 flex items-center justify-between gap-2"
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          borderTop: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <p
                          className="text-[11px] line-clamp-1 flex-1"
                          style={{ color: 'rgba(255,255,255,0.6)' }}
                        >
                          {vid.prompt}
                        </p>
                        <span
                          className="text-[9px] font-mono shrink-0"
                          style={{ color: 'rgba(255,255,255,0.25)' }}
                        >
                          {new Date(vid.timestamp).toLocaleTimeString()}
                        </span>
                        <button
                          onClick={() => handleDownload(vid)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 shrink-0"
                          style={{ color: 'rgba(255,255,255,0.5)' }}
                          title="Download"
                        >
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
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

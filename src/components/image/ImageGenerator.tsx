'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AICore from '@/components/ui/AICore'
import GlowButton from '@/components/ui/GlowButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImageModel = 'flux-schnell' | 'flux-dev' | 'sdxl'
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9'
type ImageQuality = 'draft' | 'standard' | 'high'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  model: ImageModel
  aspectRatio: AspectRatio
  quality: ImageQuality
  width: number
  height: number
  steps: number
  timestamp: number
  status: string
}

interface ModelInfo {
  id: string
  name: string
  description: string
  estimatedTime: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ASPECT_RATIOS: Record<AspectRatio, { label: string; w: number; h: number }> = {
  '1:1':  { label: 'Square',    w: 512, h: 512 },
  '16:9': { label: 'Landscape', w: 576, h: 320 },
  '9:16': { label: 'Portrait',  w: 320, h: 576 },
  '4:3':  { label: 'Photo',     w: 512, h: 384 },
  '3:4':  { label: 'Tall',      w: 384, h: 512 },
  '21:9': { label: 'Ultra Wide', w: 576, h: 256 },
}

const QUALITY_PRESETS: Record<ImageQuality, { label: string; steps: number; desc: string }> = {
  draft:    { label: 'Draft',    steps: 4,  desc: 'Fast preview' },
  standard: { label: 'Standard', steps: 20, desc: 'Good balance' },
  high:     { label: 'High',     steps: 30, desc: 'Best quality' },
}

const MODEL_OPTIONS: { id: ImageModel; name: string; desc: string }[] = [
  { id: 'flux-schnell', name: 'FLUX Schnell', desc: 'Fastest · Good quality' },
  { id: 'flux-dev',     name: 'FLUX Dev',     desc: 'Higher quality · Slower' },
  { id: 'sdxl',         name: 'SDXL',         desc: 'Reliable fallback' },
]

const STYLE_PRESETS = [
  { label: 'None',          prefix: '' },
  { label: 'Photorealistic', prefix: 'photorealistic, 8k, detailed, ' },
  { label: 'Digital Art',   prefix: 'digital art, vibrant colors, detailed illustration, ' },
  { label: 'Anime',         prefix: 'anime style, studio ghibli, manga, ' },
  { label: 'Cinematic',     prefix: 'cinematic lighting, movie still, dramatic, ' },
  { label: 'Fantasy',       prefix: 'fantasy art, magical, ethereal, ' },
  { label: '3D Render',     prefix: '3D render, octane render, volumetric lighting, ' },
  { label: 'Pixel Art',     prefix: 'pixel art, retro, 16-bit, ' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ImageModel>('flux-schnell')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [quality, setQuality] = useState<ImageQuality>('standard')
  const [styleIdx, setStyleIdx] = useState(0)
  const [negativePrompt, setNegativePrompt] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImage | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)

  // Load history on mount
  useEffect(() => {
    loadHistory()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/image/history?limit=50')
      if (!res.ok) return
      const data = await res.json()
      if (data.images) {
        const loaded: GeneratedImage[] = data.images
          .filter((img: any) => img.status === 'completed' && img.image_url)
          .map((img: any) => ({
            id: img.id,
            url: img.image_url,
            prompt: img.prompt,
            model: img.model,
            aspectRatio: '1:1',
            quality: img.quality,
            width: img.width,
            height: img.height,
            steps: img.steps,
            timestamp: new Date(img.created_at).getTime(),
            status: img.status,
          }))
        setGallery(loaded)
      }
    } catch {}
    setHistoryLoaded(true)
  }

  // Generate image
  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setProgress(0)
    setCurrentJobId(null)

    const stylePrefix = STYLE_PRESETS[styleIdx].prefix
    const fullPrompt = stylePrefix + trimmed
    const { w, h } = ASPECT_RATIOS[aspectRatio]
    const steps = QUALITY_PRESETS[quality].steps

    // Simulate progress
    progressRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 10, 92))
    }, 600)

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          negativePrompt: negativePrompt || undefined,
          config: {
            model,
            width: w,
            height: h,
            steps,
            quality,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setCurrentJobId(data.id)

      // Start polling for completion
      startPolling(data.id, trimmed, w, h, steps)
    } catch (err: any) {
      setError(err.message || 'Failed to generate')
      setIsGenerating(false)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [prompt, model, aspectRatio, quality, styleIdx, negativePrompt, isGenerating])

  const startPolling = useCallback((jobId: string, originalPrompt: string, w: number, h: number, steps: number) => {
    let attempts = 0
    const maxAttempts = 120 // 6 minutes max

    pollingRef.current = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (progressRef.current) clearInterval(progressRef.current)
        setError('Generation timed out — queue may be busy')
        setIsGenerating(false)
        return
      }

      try {
        const res = await fetch(`/api/image/status?id=${jobId}`)
        if (!res.ok) return
        const job = await res.json()

        setProgress(job.progress || 0)

        if (job.status === 'completed' && job.imageUrl) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          if (progressRef.current) clearInterval(progressRef.current)
          setProgress(100)

          const newImage: GeneratedImage = {
            id: jobId,
            url: job.imageUrl,
            prompt: originalPrompt,
            model,
            aspectRatio,
            quality,
            width: w,
            height: h,
            steps,
            timestamp: Date.now(),
            status: 'completed',
          }
          setGallery((prev) => [newImage, ...prev])
          setIsGenerating(false)
          setTimeout(() => setProgress(0), 1200)
        } else if (job.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current)
          if (progressRef.current) clearInterval(progressRef.current)
          setError(job.error || 'Generation failed')
          setIsGenerating(false)
        }
      } catch {}
    }, 3000)
  }, [model, aspectRatio, quality])

  // Download
  const handleDownload = useCallback((img: GeneratedImage) => {
    const a = document.createElement('a')
    a.href = img.url
    a.download = `nero-${img.id}.png`
    a.click()
  }, [])

  // Delete
  const handleDelete = useCallback(async (imgId: string) => {
    try {
      await fetch(`/api/image/history?id=${imgId}`, { method: 'DELETE' })
      setGallery((prev) => prev.filter((img) => img.id !== imgId))
    } catch {}
  }, [])

  // Regenerate
  const handleRegenerate = useCallback((img: GeneratedImage) => {
    setPrompt(img.prompt)
    setModel(img.model)
    setQuality(img.quality)
    setActiveTab('generate')
    setTimeout(() => handleGenerate(), 100)
  }, [handleGenerate])

  // Reuse prompt
  const handleReusePrompt = useCallback((img: GeneratedImage) => {
    setPrompt(img.prompt)
    setActiveTab('generate')
  }, [])

  // Filtered gallery
  const filteredGallery = searchQuery
    ? gallery.filter((img) => img.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    : gallery

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.04) 0%, transparent 60%)' }} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0 relative z-10"
        style={{ borderBottom: '2px solid #333333', background: 'rgba(10,10,26,0.8)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: isGenerating ? '#a855f7' : '#c0c0c0', boxShadow: isGenerating ? '0 0 8px rgba(168,85,247,0.6)' : '0 0 8px rgba(52,211,153,0.6)', animation: isGenerating ? 'pulse 1s ease-in-out infinite' : undefined }} />
          <h2 className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>IMAGE FORGE</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider" style={{ background: 'rgba(168,85,247,0.08)', border: '2px solid #333333', color: 'rgba(168,85,247,0.6)' }}>LOCAL</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Tab toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '2px solid #333333' }}>
            {(['generate', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-3 py-1 rounded-md text-[11px] font-mono tracking-wider transition-colors"
                style={{
                  background: activeTab === tab ? 'rgba(56,189,248,0.12)' : 'transparent',
                  color: activeTab === tab ? '#38bdf8' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                }}
              >
                {tab === 'generate' ? 'GENERATE' : `HISTORY (${gallery.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10">
        {activeTab === 'generate' ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Prompt area */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '2px solid #333333', backdropFilter: 'blur(8px)' }}>
              <label className="block text-[11px] font-mono uppercase tracking-[0.15em] mb-2" style={{ color: 'rgba(168,85,247,0.5)' }}>Describe your image</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                placeholder="A cyberpunk cityscape at sunset with neon reflections..."
                rows={3}
                disabled={isGenerating}
                className="w-full bg-transparent text-sm resize-none outline-none disabled:opacity-50"
                style={{ color: 'rgba(255,255,255,0.9)', lineHeight: '1.6' }}
              />

              {/* Negative prompt (collapsible) */}
              <details className="mt-3">
                <summary className="text-[10px] font-mono uppercase tracking-[0.15em] cursor-pointer" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Negative prompt (optional)
                </summary>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="blurry, low quality, distorted, watermark..."
                  disabled={isGenerating}
                  className="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-transparent outline-none disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '2px solid #333333', color: 'rgba(255,255,255,0.7)' }}
                />
              </details>

              {/* Settings grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {/* Model */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as ImageModel)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid #333333', color: 'rgba(255,255,255,0.8)' }}
                  >
                    {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id} style={{ background: '#0d1117' }}>{m.name}</option>)}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid #333333', color: 'rgba(255,255,255,0.8)' }}
                  >
                    {(Object.entries(ASPECT_RATIOS) as [AspectRatio, { label: string; w: number; h: number }][]).map(([key, val]) => (
                      <option key={key} value={key} style={{ background: '#0d1117' }}>{val.label} ({key})</option>
                    ))}
                  </select>
                </div>

                {/* Quality */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Quality</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as ImageQuality)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid #333333', color: 'rgba(255,255,255,0.8)' }}
                  >
                    {(Object.entries(QUALITY_PRESETS) as [ImageQuality, { label: string; steps: number; desc: string }][]).map(([key, val]) => (
                      <option key={key} value={key} style={{ background: '#0d1117' }}>{val.label} ({val.steps} steps)</option>
                    ))}
                  </select>
                </div>

                {/* Style */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Style</label>
                  <select
                    value={styleIdx}
                    onChange={(e) => setStyleIdx(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid #333333', color: 'rgba(255,255,255,0.8)' }}
                  >
                    {STYLE_PRESETS.map((s, i) => <option key={i} value={i} style={{ background: '#0d1117' }}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-3 mt-4">
                <GlowButton variant="primary" size="lg" onClick={handleGenerate} disabled={!prompt.trim() || isGenerating} icon={isGenerating ? <div className="spinner-neon-sm" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}>
                  {isGenerating ? '' : 'Generate'}
                </GlowButton>
                {isGenerating && (
                  <span className="text-xs font-mono" style={{ color: 'rgba(168,85,247,0.5)' }}>
                    {Math.round(progress)}% · {MODEL_OPTIONS.find(m => m.id === model)?.name}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <AnimatePresence>
                {isGenerating && (
                  <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 6, marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="rounded-full overflow-hidden" style={{ background: 'rgba(168,85,247,0.08)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: '#000000', backgroundSize: '200% 100%', animation: 'gradient-shift 2s linear infinite' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-3 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(248,113,113,0.1)', border: '2px solid #333333', color: '#ffffff' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Generating indicator */}
            <AnimatePresence>
              {isGenerating && gallery.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 gap-4">
                  <AICore state="thinking" size={100} />
                  <span className="text-xs font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(168,85,247,0.5)' }}>Synthesizing visual...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!isGenerating && gallery.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="flex flex-col items-center justify-center py-16 gap-5">
                <AICore state="idle" size={90} />
                <div className="text-center">
                  <p className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Create stunning images locally</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Powered by FLUX / SDXL via Stable Horde — completely free, no API key needed</p>
                </div>
              </motion.div>
            )}

            {/* Recent gallery preview */}
            {gallery.length > 0 && !isGenerating && (
              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] mb-4" style={{ color: 'rgba(168,85,247,0.4)' }}>Recent ({gallery.length})</h3>
                <ImageGrid images={gallery.slice(0, 6)} onSelect={setFullscreenImage} onDownload={handleDownload} onDelete={handleDelete} onRegenerate={handleRegenerate} onReusePrompt={handleReusePrompt} />
              </div>
            )}
          </div>
        ) : (
          /* History tab */
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search image history..."
                  className="w-full px-4 py-2.5 pl-10 rounded-lg text-sm bg-transparent outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '2px solid #333333', color: 'rgba(255,255,255,0.8)' }}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {filteredGallery.length} images
              </span>
            </div>

            {filteredGallery.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 opacity-50">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{searchQuery ? 'No images match your search' : 'No images generated yet'}</p>
              </div>
            ) : (
              <ImageGrid images={filteredGallery} onSelect={setFullscreenImage} onDownload={handleDownload} onDelete={handleDelete} onRegenerate={handleRegenerate} onReusePrompt={handleReusePrompt} />
            )}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}
            onClick={() => setFullscreenImage(null)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
              <img src={fullscreenImage.url} alt={fullscreenImage.prompt} className="max-w-full max-h-[80vh] rounded-xl" />
              <div className="absolute bottom-0 left-0 right-0 p-4 rounded-b-xl" style={{ background: '#000000' }}>
                <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>{fullscreenImage.prompt}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: 'rgba(168,85,247,0.7)' }}>{fullscreenImage.model}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.12)', color: 'rgba(56,189,248,0.6)' }}>{fullscreenImage.width}×{fullscreenImage.height}</span>
                  <div className="flex-1" />
                  <button onClick={() => handleDownload(fullscreenImage)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(56,189,248,0.15)', border: '2px solid #333333', color: '#38bdf8', cursor: 'pointer' }}>Download</button>
                  <button onClick={() => { setFullscreenImage(null); handleRegenerate(fullscreenImage) }} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(168,85,247,0.15)', border: '2px solid #333333', color: '#a855f7', cursor: 'pointer' }}>Regenerate</button>
                </div>
              </div>
              <button onClick={() => setFullscreenImage(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', border: '2px solid #333333', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>✕</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image Grid sub-component
// ---------------------------------------------------------------------------

function ImageGrid({
  images, onSelect, onDownload, onDelete, onRegenerate, onReusePrompt,
}: {
  images: GeneratedImage[]
  onSelect: (img: GeneratedImage) => void
  onDownload: (img: GeneratedImage) => void
  onDelete: (id: string) => void
  onRegenerate: (img: GeneratedImage) => void
  onReusePrompt: (img: GeneratedImage) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {images.map((img, i) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="group relative rounded-xl overflow-hidden cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.02)', border: '2px solid #333333' }}
            onClick={() => onSelect(img)}
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ boxShadow: '0 0 20px rgba(168,85,247,0.15), inset 0 0 20px rgba(168,85,247,0.05)' }} />
            <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" loading="lazy" />
            <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#000000' }}>
              <p className="text-[11px] line-clamp-2 mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{img.prompt}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: 'rgba(168,85,247,0.7)' }}>{img.model}</span>
                <div className="flex-1" />
                <button onClick={(e) => { e.stopPropagation(); onDownload(img) }} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} title="Download">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onReusePrompt(img) }} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} title="Reuse prompt">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRegenerate(img) }} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} title="Regenerate">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(img.id) }} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20" style={{ color: 'rgba(248,113,113,0.6)', cursor: 'pointer' }} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

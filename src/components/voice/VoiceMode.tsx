'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'wake_listening'

interface VoiceMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

interface VoiceSettings {
  language: string
  speed: number
  pitch: number
  voiceURI: string
  geminiVoice: string
  useGeminiTts: boolean
}

const stateColors: Record<VoiceState, { primary: string; glow: string; bg: string }> = {
  idle: { primary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.2)', bg: 'rgba(56, 189, 248, 0.02)' },
  wake_listening: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.3)', bg: 'rgba(168, 85, 247, 0.04)' },
  listening: { primary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', bg: 'rgba(56, 189, 248, 0.06)' },
  processing: { primary: '#00b4ff', glow: 'rgba(0, 180, 255, 0.3)', bg: 'rgba(0, 180, 255, 0.04)' },
  speaking: { primary: '#34d399', glow: 'rgba(52, 211, 153, 0.3)', bg: 'rgba(52, 211, 153, 0.04)' },
}

const stateLabels: Record<VoiceState, string> = {
  idle: 'Click mic to start talking',
  wake_listening: 'Listening for "Hey Nero"...',
  listening: 'Listening...',
  processing: 'Processing...',
  speaking: 'Speaking...',
}

const WAKE_PATTERNS = [
  'hey nero',
  'hey near',
  'hero nero',
  'hey nero',
  'a nero',
  'nero',
]

function matchesWakeWord(text: string): boolean {
  const lower = text.toLowerCase().trim()
  for (const pattern of WAKE_PATTERNS) {
    if (lower.includes(pattern)) return true
  }
  // Fuzzy: check if it starts with 'he' and contains 'ner' nearby
  if (/he\w*\s*n[ae]r/i.test(lower)) return true
  return false
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function VoiceMode() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [responseText, setResponseText] = useState('')
  const [conversation, setConversation] = useState<VoiceMessage[]>([])
  const [isHolding, setIsHolding] = useState(false)
  const [continuousMode, setContinuousMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [wakeWordDetected, setWakeWordDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(48).fill(0))
  const [settings, setSettings] = useState<VoiceSettings>({
    language: 'en-US',
    speed: 1.0,
    pitch: 1.0,
    voiceURI: '',
    geminiVoice: 'Kore',
    useGeminiTts: true,
  })

  const recognitionRef = useRef<any>(null)
  const continuousRecognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSpeakingRef = useRef(false)
  const processVoiceInputRef = useRef<((text: string) => Promise<void>) | null>(null)
  const processedByButtonRef = useRef(false)
  const voiceStateRef = useRef<VoiceState>('idle')
  const waveformBars = 48
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const wakeRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load browser TTS voices (for fallback when Gemini TTS fails)
  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) setAvailableVoices(voices)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio()
    audio.onended = () => {
      isSpeakingRef.current = false
      // Revoke any object URL to prevent memory leaks
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      setVoiceState(continuousMode ? 'wake_listening' : 'idle')
    }
    audio.onerror = () => {
      isSpeakingRef.current = false
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      setVoiceState('idle')
      setError('Audio playback failed')
    }
    audioRef.current = audio
    return () => {
      audio.pause()
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = ''
    }
  }, [continuousMode])

  // Initialize audio analysis for waveform (real mic visualization)
  useEffect(() => {
    let active = true

    async function initAudioAnalysis() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        micStreamRef.current = stream
        const ctx = new AudioContext()
        audioContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const updateLevels = () => {
          if (!active) return
          analyser.getByteFrequencyData(dataArray)
          const levels: number[] = []
          const step = Math.floor(dataArray.length / waveformBars)
          for (let i = 0; i < waveformBars; i++) {
            let sum = 0
            for (let j = 0; j < step; j++) {
              sum += dataArray[i * step + j] || 0
            }
            levels.push(sum / step / 255)
          }
          setAudioLevels(levels)
          animFrameRef.current = requestAnimationFrame(updateLevels)
        }
        updateLevels()
      } catch {
        // Fallback: simulated waveform
      }
    }

    initAudioAnalysis()

    return () => {
      active = false
      cancelAnimationFrame(animFrameRef.current)
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      audioContextRef.current?.close().catch(() => {})
    }
  }, [])

  // Keep voiceStateRef in sync
  useEffect(() => { voiceStateRef.current = voiceState }, [voiceState])

  // Initialize main recognition (push-to-talk)
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition not supported')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = settings.language
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const tr = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += tr
        } else {
          interim += tr
        }
      }
      setInterimText(interim)
      if (final) {
        setTranscript((prev) => prev + final)
        setInterimText('')
        // Store transcript on ref so onend can access it
        if (recognitionRef.current) {
          recognitionRef.current._lastTranscript = (recognitionRef.current._lastTranscript || '') + final
        }
        // Interrupt TTS if user starts speaking
        if (isSpeakingRef.current) {
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
          isSpeakingRef.current = false
          abortControllerRef.current?.abort()
        }
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') return
      if (event.error === 'network') return
      console.error('Speech error:', event.error)
      const currentState = voiceStateRef.current
      if (!continuousMode && currentState !== 'processing' && currentState !== 'speaking') {
        setError('Speech error: ' + event.error)
        setVoiceState('idle')
      }
    }

    recognition.onend = () => {
      // When recognition ends, process whatever transcript we have
      // But skip if handleHoldEnd/handleToggleTalk already processed it
      setTimeout(() => {
        if (processedByButtonRef.current) {
          processedByButtonRef.current = false
          return
        }
        const currentTranscript = recognitionRef.current?._lastTranscript || ''
        if (currentTranscript.trim() && processVoiceInputRef.current) {
          const text = currentTranscript.trim()
          recognitionRef.current._lastTranscript = ''
          processVoiceInputRef.current(text)
        }
      }, 100)
    }

    recognitionRef.current = recognition
    return () => { recognition.abort() }
  }, [settings.language, continuousMode])

  // Initialize wake word detection (continuous mode)
  useEffect(() => {
    if (!continuousMode) {
      continuousRecognitionRef.current?.abort()
      if (wakeRestartTimerRef.current) clearTimeout(wakeRestartTimerRef.current)
      if (voiceState === 'wake_listening') setVoiceState('idle')
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const wakeRecognition = new SR()
    wakeRecognition.continuous = true
    wakeRecognition.interimResults = true
    wakeRecognition.lang = settings.language

    let isRunning = false

    wakeRecognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript.toLowerCase()
        if (matchesWakeWord(transcriptText)) {
          setWakeWordDetected(true)
          setVoiceState('listening')
          setTranscript('')
          setInterimText('')
          setResponseText('')
          setTimeout(() => setWakeWordDetected(false), 2000)
          // Switch to main recognition
          wakeRecognition.abort()
          isRunning = false
          try {
            recognitionRef.current?.start()
          } catch {}
          break
        }
      }
    }

    wakeRecognition.onerror = (event: any) => {
      if (event.error === 'aborted') return
      // "network" and "no-speech" are expected — don't spam the console
      if (event.error === 'network' || event.error === 'no-speech') return
      console.error('Wake word error:', event.error)
    }

    wakeRecognition.onend = () => {
      isRunning = false
      // Restart if continuous mode still active and we're in wake_listening state
      const currentState = voiceStateRef.current
      if (continuousMode && currentState !== 'listening' && currentState !== 'processing' && currentState !== 'speaking') {
        wakeRestartTimerRef.current = setTimeout(() => {
          try {
            wakeRecognition.start()
            isRunning = true
          } catch {}
        }, 300)
      }
    }

    continuousRecognitionRef.current = wakeRecognition
    setVoiceState('wake_listening')
    try {
      wakeRecognition.start()
      isRunning = true
    } catch {}

    return () => {
      isRunning = false
      if (wakeRestartTimerRef.current) clearTimeout(wakeRestartTimerRef.current)
      wakeRecognition.abort()
    }
  }, [continuousMode, settings.language])

  const speakText = useCallback(async (text: string) => {
    setVoiceState('speaking')
    isSpeakingRef.current = true

    // Use Gemini TTS if enabled
    if (settings.useGeminiTts) {
      try {
        const controller = new AbortController()
        abortControllerRef.current = controller

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: settings.geminiVoice,
            speed: settings.speed,
            apiKey: localStorage.getItem('nero-gemini-key') || undefined,
            fallbackKey: localStorage.getItem('nero-gemini-key-fallback') || undefined,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`)
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        if (audioRef.current) {
          audioRef.current.src = audioUrl
          audioRef.current.playbackRate = settings.speed
          await audioRef.current.play()
          // audioRef.current.onended is already set to handle state transition
        }
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.warn('[VoiceMode] Gemini TTS failed, falling back to browser TTS:', err.message)
        // Fall through to browser TTS
      }
    }

    // Fallback: browser TTS with selected voice
    if (availableVoices.length > 0 && settings.voiceURI) {
      try {
        const naturalText = text
          .replace(/\.(\s)/g, '$1')
          .replace(/!(\s)/g, '$1')
          .replace(/\?(\s)/g, '$1')

        const utterance = new SpeechSynthesisUtterance(naturalText)
        const selectedVoice = availableVoices.find(v => v.voiceURI === settings.voiceURI)
        if (selectedVoice) utterance.voice = selectedVoice
        utterance.rate = Math.max(0.85, settings.speed * 0.92)
        utterance.pitch = settings.pitch * 0.95
        utterance.lang = settings.language

        utterance.onend = () => {
          isSpeakingRef.current = false
          setVoiceState(continuousMode ? 'wake_listening' : 'idle')
        }
        utterance.onerror = () => {
          isSpeakingRef.current = false
          setVoiceState(continuousMode ? 'wake_listening' : 'idle')
        }

        window.speechSynthesis.speak(utterance)
        return
      } catch {}
    }

    // No TTS available — show text only
    isSpeakingRef.current = false
    setVoiceState(continuousMode ? 'wake_listening' : 'idle')
  }, [settings, availableVoices, continuousMode])

  const processVoiceInput = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setVoiceState(continuousMode ? 'wake_listening' : 'idle')
      return
    }

    // Reset the processed flag for next round
    processedByButtonRef.current = false

    setVoiceState('processing')
    setConversation((prev) => [...prev, {
      id: 'u-' + Date.now(), role: 'user', text: trimmed, timestamp: Date.now(),
    }])

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          apiKey: localStorage.getItem('nero-gemini-key') || undefined,
          fallbackKey: localStorage.getItem('nero-gemini-key-fallback') || undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'HTTP ' + response.status)
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
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('data: ')) continue
          const data = trimmedLine.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              fullContent += parsed.content
              setResponseText(fullContent)
            }
          } catch {}
        }
      }

      if (fullContent) {
        setConversation((prev) => [...prev, {
          id: 'a-' + Date.now(), role: 'assistant', text: fullContent, timestamp: Date.now(),
        }])
        await speakText(fullContent)
      } else {
        setVoiceState(continuousMode ? 'wake_listening' : 'idle')
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('[VoiceMode] processVoiceInput error:', err)
      setError(err.message || 'Failed to get response')
      // Always recover to a usable state so voice doesn't get stuck
      setVoiceState(continuousMode ? 'wake_listening' : 'idle')
    } finally {
      abortControllerRef.current = null
      setTranscript('')
      setInterimText('')
    }
  }, [continuousMode, speakText])

  // Keep processVoiceInput ref current
  useEffect(() => {
    processVoiceInputRef.current = processVoiceInput
  }, [processVoiceInput])

  // Auto-scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const handleHoldStart = useCallback(() => {
    const currentState = voiceStateRef.current
    if (currentState === 'processing' || currentState === 'speaking') return
    setError(null)
    setTranscript('')
    setInterimText('')
    setResponseText('')
    setIsHolding(true)
    setVoiceState('listening')
    // Stop wake word recognition if running
    continuousRecognitionRef.current?.abort()
    try { recognitionRef.current?.start() } catch {}
  }, [])

  const handleHoldEnd = useCallback(() => {
    setIsHolding(false)
    try { recognitionRef.current?.stop() } catch {}
    // Mark that we'll process this transcript so onend doesn't double-process
    processedByButtonRef.current = true
    // Use ref to avoid stale closure on voiceState
    const currentState = voiceStateRef.current
    setTimeout(() => {
      const currentTranscript = transcript.trim()
      if (currentTranscript && currentState === 'listening') {
        processVoiceInput(currentTranscript)
      } else {
        setVoiceState(continuousMode ? 'wake_listening' : 'idle')
      }
    }, 200)
  }, [transcript, continuousMode, processVoiceInput])

  // Click-to-talk toggle: click once to start listening, click again to stop and process
  const handleToggleTalk = useCallback(() => {
    const currentState = voiceStateRef.current
    if (currentState === 'idle' || currentState === 'wake_listening') {
      // Start listening
      setError(null)
      setTranscript('')
      setInterimText('')
      setResponseText('')
      setVoiceState('listening')
      continuousRecognitionRef.current?.abort()
      try { recognitionRef.current?.start() } catch {}
    } else if (currentState === 'listening') {
      // Stop listening and process
      try { recognitionRef.current?.stop() } catch {}
      processedByButtonRef.current = true
      setTimeout(() => {
        const currentTranscript = transcript.trim()
        if (currentTranscript) {
          processVoiceInput(currentTranscript)
        } else {
          setVoiceState(continuousMode ? 'wake_listening' : 'idle')
        }
      }, 200)
    }
  }, [transcript, continuousMode, processVoiceInput])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    recognitionRef.current?.abort()
    continuousRecognitionRef.current?.abort()
    window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.src = ''
    }
    isSpeakingRef.current = false
    processedByButtonRef.current = false
    setVoiceState(continuousMode ? 'wake_listening' : 'idle')
    setTranscript('')
    setInterimText('')
    setResponseText('')
    setIsHolding(false)
  }, [continuousMode])

  const handleClearConversation = useCallback(() => {
    setConversation([])
    setResponseText('')
    setTranscript('')
    setInterimText('')
  }, [])

  const colors = stateColors[voiceState]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, ' + colors.bg + ' 0%, transparent 60%)',
        transition: 'background 0.6s ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03,
        backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.5) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Settings Toggle */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: showHistory ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid ' + (showHistory ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)'),
          color: showHistory ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        }}>
          {'\u{1F4AC}'}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: showSettings ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid ' + (showSettings ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)'),
          color: showSettings ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
        }}>
          {'\u2699\uFE0F'}
        </button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'absolute', top: '60px', right: '16px', zIndex: 10,
              width: '280px', padding: '16px',
              background: 'rgba(13, 17, 23, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Voice Settings
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Gemini TTS Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  GEMINI TTS
                </label>
                <button
                  onClick={() => setSettings(s => ({ ...s, useGeminiTts: !s.useGeminiTts }))}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: settings.useGeminiTts ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: settings.useGeminiTts ? '#34d399' : 'rgba(255, 255, 255, 0.3)',
                    position: 'absolute', top: '2px',
                    left: settings.useGeminiTts ? '18px' : '2px',
                    transition: 'left 0.2s, background 0.2s',
                  }} />
                </button>
              </div>

              {/* Gemini Voice Selection */}
              {settings.useGeminiTts && (
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                    GEMINI VOICE
                  </label>
                  <select
                    value={settings.geminiVoice}
                    onChange={(e) => setSettings(s => ({ ...s, geminiVoice: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px', marginTop: '4px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px', color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '13px', outline: 'none',
                    }}
                  >
                    <optgroup label="Female">
                      <option value="Kore">Kore — Warm, expressive</option>
                      <option value="Fenrir">Fenrir — Bright, energetic</option>
                      <option value="Aoede">Aoede — Deep, resonant</option>
                    </optgroup>
                    <optgroup label="Male">
                      <option value="Puck">Puck — Upbeat, lively</option>
                      <option value="Charon">Charon — Grounded, informative</option>
                      <option value="Orion">Orion — Versatile, storytelling</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="Zephyr">Zephyr — Gentle, calming</option>
                      <option value="Ledbes">Ledbes — Authoritative</option>
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Language */}
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  LANGUAGE
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value, voiceURI: '' }))}
                  style={{
                    width: '100%', padding: '8px', marginTop: '4px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px', color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '13px', outline: 'none',
                  }}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="zh-CN">Chinese</option>
                </select>
              </div>

              {/* Browser Voice Selection (fallback) */}
              {!settings.useGeminiTts && (
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                    BROWSER VOICE
                  </label>
                  <select
                    value={settings.voiceURI}
                    onChange={(e) => setSettings((s) => ({ ...s, voiceURI: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px', marginTop: '4px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px', color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '13px', outline: 'none',
                    }}
                  >
                    <option value="">Default</option>
                    {availableVoices.filter(v => v.lang.startsWith(settings.language.split('-')[0])).map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Speed */}
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  SPEED: {settings.speed.toFixed(1)}x
                </label>
                <input
                  type="range" min="0.5" max="2" step="0.1"
                  value={settings.speed}
                  onChange={(e) => setSettings((s) => ({ ...s, speed: parseFloat(e.target.value) }))}
                  style={{ width: '100%', marginTop: '4px', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Pitch */}
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
                  PITCH: {settings.pitch.toFixed(1)}
                </label>
                <input
                  type="range" min="0.5" max="2" step="0.1"
                  value={settings.pitch}
                  onChange={(e) => setSettings((s) => ({ ...s, pitch: parseFloat(e.target.value) }))}
                  style={{ width: '100%', marginTop: '4px', accentColor: '#38bdf8' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '20px', padding: '40px 20px', position: 'relative', zIndex: 1,
        overflowY: 'auto',
      }}>
        {/* AI Core */}
        <motion.div
          animate={{ scale: voiceState === 'idle' ? 1 : voiceState === 'listening' ? 1.05 : 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div style={{
            width: '160px', height: '160px', borderRadius: '50%', position: 'relative',
            background: 'radial-gradient(circle, ' + colors.primary + '15, transparent 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Outer ring */}
            <motion.div
              animate={{
                rotate: 360,
                scale: voiceState === 'listening' ? [1, 1.05, 1] : 1,
              }}
              transition={{
                rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                scale: { duration: 1.5, repeat: voiceState === 'listening' ? Infinity : 0 },
              }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid ' + colors.primary + '30',
                borderTopColor: colors.primary + '80',
              }}
            />
            {/* Second ring for wake listening */}
            {voiceState === 'wake_listening' && (
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: '-8px', borderRadius: '50%',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderBottomColor: 'rgba(168, 85, 247, 0.5)',
                }}
              />
            )}
            {/* Inner orb */}
            <motion.div
              animate={{
                boxShadow: voiceState === 'idle'
                  ? '0 0 30px ' + colors.glow + ', 0 0 60px ' + colors.glow
                  : '0 0 50px ' + colors.glow + ', 0 0 100px ' + colors.glow,
              }}
              transition={{ duration: 0.5 }}
              style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, ' + colors.primary + '40, ' + colors.primary + '10)',
                border: '1px solid ' + colors.primary + '50',
              }}
            />
            {/* Wake word flash */}
            <AnimatePresence>
              {wakeWordDetected && (
                <motion.div
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  style={{
                    position: 'absolute', width: '90px', height: '90px', borderRadius: '50%',
                    border: '2px solid ' + colors.primary,
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Waveform - Real Audio Analysis */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '2px', height: '48px', width: '100%', maxWidth: '400px',
        }}>
          {Array.from({ length: waveformBars }).map((_, i) => {
            const isAudioActive = voiceState === 'listening' || voiceState === 'speaking'
            const level = audioLevels[i] || 0
            const barHeight = isAudioActive
              ? Math.max(4, level * 44)
              : (voiceState === 'wake_listening'
                ? 3 + Math.sin(i * 0.2 + Date.now() * 0.002) * 2
                : 3)
            return (
              <motion.div
                key={i}
                animate={{
                  height: barHeight,
                  opacity: voiceState === 'idle' ? 0.15 : (isAudioActive ? 0.9 : 0.3),
                }}
                transition={{ duration: 0.08 }}
                style={{
                  width: '3px',
                  borderRadius: '2px',
                  background: voiceState === 'speaking'
                    ? '#34d399'
                    : (voiceState === 'wake_listening' ? '#a855f7' : colors.primary),
                  transition: 'background 0.3s ease',
                }}
              />
            )
          })}
        </div>

        {/* Status */}
        <motion.p
          animate={{ opacity: voiceState === 'idle' ? [0.4, 0.7, 0.4] : 1 }}
          transition={{ duration: 2, repeat: voiceState === 'idle' ? Infinity : 0 }}
          style={{
            fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: colors.primary, margin: 0,
          }}
        >
          {voiceState === 'speaking' && settings.useGeminiTts
            ? 'SPEAKING (Gemini)'
            : stateLabels[voiceState]}
        </motion.p>

        {/* Transcript */}
        <AnimatePresence mode="wait">
          {(transcript || interimText) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}
            >
              <p style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(56, 189, 248, 0.4)', margin: '0 0 6px', letterSpacing: '0.1em' }}>
                YOU SAID
              </p>
              <p style={{
                fontSize: '14px', lineHeight: 1.6, padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)',
                color: 'rgba(255, 255, 255, 0.85)', margin: 0,
              }}>
                {transcript || interimText}
                {interimText && <span style={{ display: 'inline-block', width: '2px', height: '16px', marginLeft: '2px', verticalAlign: 'middle', background: '#38bdf8', opacity: 0.6 }} />}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Response */}
        <AnimatePresence>
          {responseText && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}
            >
              <p style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(52, 211, 153, 0.4)', margin: '0 0 6px', letterSpacing: '0.1em' }}>
                NERO
              </p>
              <p style={{
                fontSize: '14px', lineHeight: 1.6, padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(52, 211, 153, 0.03)', border: '1px solid rgba(52, 211, 153, 0.08)',
                color: 'rgba(255, 255, 255, 0.8)', margin: 0,
              }}>
                {responseText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                padding: '10px 16px', borderRadius: '10px',
                background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)',
                color: '#f87171', fontSize: '13px', maxWidth: '400px',
                cursor: 'pointer',
              }}
              onClick={() => setError(null)}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conversation History */}
      <AnimatePresence>
        {showHistory && conversation.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              maxHeight: '200px', overflowY: 'auto',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '12px 20px',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '0.1em' }}>
                CHAT HISTORY ({conversation.length})
              </span>
              <button
                onClick={handleClearConversation}
                style={{
                  fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(255, 255, 255, 0.3)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 6px', borderRadius: '4px',
                }}
              >
                CLEAR
              </button>
            </div>
            {conversation.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex', gap: '8px', marginBottom: '8px',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: '10px',
                  background: msg.role === 'user' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(52, 211, 153, 0.05)',
                  border: '1px solid ' + (msg.role === 'user' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(52, 211, 153, 0.1)'),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '9px', fontFamily: "'JetBrains Mono', monospace",
                      color: msg.role === 'user' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(52, 211, 153, 0.5)',
                      letterSpacing: '0.1em',
                    }}>
                      {msg.role === 'user' ? 'YOU' : 'NERO'}
                    </span>
                    <span style={{
                      fontSize: '9px', fontFamily: "'JetBrains Mono', monospace",
                      color: 'rgba(255, 255, 255, 0.2)',
                    }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={conversationEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Continuous mode toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => {
              const next = !continuousMode
              setContinuousMode(next)
              if (!next) {
                setVoiceState('idle')
                continuousRecognitionRef.current?.abort()
              }
            }}
            style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: continuousMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid ' + (continuousMode ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.06)'),
              color: continuousMode ? '#a855f7' : 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer', fontSize: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {continuousMode ? '\u{1F399}\uFE0F' : '\u{1F3A4}'}
          </button>
          <span style={{ fontSize: '9px', color: continuousMode ? 'rgba(168, 85, 247, 0.7)' : 'rgba(255, 255, 255, 0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
            {continuousMode ? 'WAKE' : 'MANUAL'}
          </span>
        </div>

        {/* Push to talk / Stop */}
        {voiceState !== 'idle' && voiceState !== 'wake_listening' ? (
          <motion.button
            onClick={handleStop}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(248, 113, 113, 0.05))',
              border: '2px solid rgba(248, 113, 113, 0.4)',
              boxShadow: '0 0 20px rgba(248, 113, 113, 0.15)',
              color: '#f87171', cursor: 'pointer', fontSize: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            whileHover={{ boxShadow: '0 0 30px rgba(248, 113, 113, 0.3)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </motion.button>
        ) : (
          <motion.button
            style={{
              width: '72px', height: '72px', borderRadius: '50%', position: 'relative',
              background: voiceState === 'wake_listening'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05))'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.05))',
              border: '2px solid ' + (voiceState === 'wake_listening' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(56, 189, 248, 0.4)'),
              boxShadow: voiceState === 'wake_listening'
                ? '0 0 20px rgba(168, 85, 247, 0.15), 0 0 40px rgba(168, 85, 247, 0.05)'
                : '0 0 20px rgba(56, 189, 248, 0.15), 0 0 40px rgba(56, 189, 248, 0.05)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            whileHover={voiceState !== 'wake_listening' ? {
              boxShadow: '0 0 30px rgba(56, 189, 248, 0.3), 0 0 60px rgba(56, 189, 248, 0.1)',
              scale: 1.05,
            } : {}}
            whileTap={voiceState !== 'wake_listening' ? {
              scale: 0.95,
              boxShadow: '0 0 40px rgba(56, 189, 248, 0.5), 0 0 80px rgba(56, 189, 248, 0.2)',
            } : {}}
            onMouseDown={voiceState !== 'wake_listening' ? handleHoldStart : undefined}
            onMouseUp={voiceState !== 'wake_listening' ? handleHoldEnd : undefined}
            onMouseLeave={voiceState !== 'wake_listening' ? handleHoldEnd : undefined}
            onTouchStart={voiceState !== 'wake_listening' ? handleHoldStart : undefined}
            onTouchEnd={voiceState !== 'wake_listening' ? handleHoldEnd : undefined}
            onClick={handleToggleTalk}
          >
            {isHolding && (
              <motion.div
                style={{
                  position: 'absolute', inset: '-4px', borderRadius: '50%',
                  border: '2px solid rgba(56, 189, 248, 0.6)',
                }}
                animate={{ scale: [1, 1.3, 1.3], opacity: [0.6, 0, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            {voiceState === 'wake_listening' && (
              <motion.div
                style={{
                  position: 'absolute', inset: '-6px', borderRadius: '50%',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={voiceState === 'wake_listening' ? '#a855f7' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </motion.button>
        )}

        {/* Clear conversation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleClearConversation}
            style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {'\u{1F5D1}\uFE0F'}
          </button>
          <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
            CLEAR
          </span>
        </div>
      </div>
    </div>
  )
}

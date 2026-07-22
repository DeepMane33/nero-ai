'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from '@/components/chat/MessageBubble'
import GlowButton from '@/components/ui/GlowButton'
import { getAuthHeaders } from '@/lib/user-id'
import { getMemories, addMemory } from '@/lib/client-memory'

type PersonalityType = 'normal' | 'waifu'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  brainUsed?: string
  provider?: string
  model?: string
  personality?: PersonalityType
  timestamp: string
  isStreaming?: boolean
  confidence?: string | null
}

interface Toast {
  id: string
  message: string
  type: 'error' | 'success' | 'info'
}

const PERSONALITY_META: Record<PersonalityType, { name: string; label: string; color: string }> = {
  normal: { name: 'Nero', label: 'Nero Core', color: 'var(--accent)' },
  waifu:  { name: 'Nero~', label: 'Nero Waifu', color: '#c0a0b8' },
}

interface ChatInterfaceProps {
  activeConversationId?: string | null
  onConversationCreated?: (id: string) => void
  defaultBrain?: string | null
  onMoodChange?: () => void
}

// ── SLASH COMMANDS ──
interface SlashCommand {
  name: string
  description: string
  handler: () => string
}

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "There are only 10 types of people: those who understand binary and those who don't.",
  "A SQL query walks into a bar, sees two tables, and asks: 'Can I join you?'",
  "Why did the developer go broke? Because he used up all his cache.",
  "What's a programmer's favorite hangout place? Foo Bar.",
  "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "What did the router say to the doctor? 'It hurts when IP.'",
]

const QUOTES = [
  "The best way to predict the future is to invent it. — Alan Kay",
  "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
  "Talk is cheap. Show me the code. — Linus Torvalds",
  "Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke",
  "First, solve the problem. Then, write the code. — John Johnson",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Programs must be written for people to read. — Harold Abelson",
  "It's not a bug — it's an undocumented feature.",
]

const CHAT_STORAGE_KEY = 'nero-chat-history'
const MAX_STORED_MESSAGES = 50

export default function ChatInterface({ activeConversationId, onConversationCreated, defaultBrain, onMoodChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(activeConversationId ?? null)
  const [activeBrain, setActiveBrain] = useState<string | null>(defaultBrain ?? null)
  const [activePersonality, setActivePersonality] = useState<PersonalityType>('normal')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')

  // Voice states
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({})

  // ── Command definitions ──
  const commands: SlashCommand[] = [
    {
      name: '/help',
      description: 'Show available commands',
      handler: () => 'Here\'s what I can do:\n\n• `/help` — Show this list\n• `/time` — Current time\n• `/date` — Today\'s date\n• `/joke` — Tell me a joke\n• `/quote` — Random quote\n• `/calc 2+2` — Quick math\n• `/clear` — Clear chat\n\nYou can also just ask me anything!',
    },
    {
      name: '/time',
      description: 'Show current time',
      handler: () => `It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`,
    },
    {
      name: '/date',
      description: 'Show today\'s date',
      handler: () => `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    },
    {
      name: '/joke',
      description: 'Tell a random joke',
      handler: () => JOKES[Math.floor(Math.random() * JOKES.length)],
    },
    {
      name: '/quote',
      description: 'Random motivational quote',
      handler: () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    },
    {
      name: '/calc',
      description: 'Evaluate a math expression',
      handler: () => {
        const expr = input.replace('/calc', '').trim()
        if (!expr) return 'Usage: `/calc 2+2*3`'
        try {
          const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '')
          const result = Function('"use strict"; return (' + sanitized + ')')()
          return `\`${expr}\` = **${result}**`
        } catch {
          return 'Couldn\'t evaluate that expression. Check the syntax.'
        }
      },
    },
    {
      name: '/clear',
      description: 'Clear chat history',
      handler: () => {
        handleNewChat()
        return ''
      },
    },
  ]

  const filteredCommands = commandFilter
    ? commands.filter(c => c.name.startsWith(commandFilter.toLowerCase()))
    : commands

  const handleInputChange = (value: string) => {
    setInput(value)
    if (value.startsWith('/') && !value.includes(' ')) {
      setShowCommands(true)
      setCommandFilter(value)
    } else {
      setShowCommands(false)
    }
  }

  const executeCommand = (cmd: SlashCommand): boolean => {
    if (cmd.name === '/clear') {
      cmd.handler()
      setShowCommands(false)
      return true
    }
    const response = cmd.handler()
    if (!response) return false

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cmd.name,
      timestamp: new Date().toISOString(),
    }
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setShowCommands(false)
    return true
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<any>(null)
  const voiceInputRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Refs that mirror state
  const isLoadingRef = useRef(false)
  const conversationIdRef = useRef<string | null>(activeConversationId ?? null)
  const personalityRef = useRef<PersonalityType>('normal')
  const brainRef = useRef<string | null>(defaultBrain ?? null)

  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])
  useEffect(() => { conversationIdRef.current = conversationId }, [conversationId])
  useEffect(() => { personalityRef.current = activePersonality }, [activePersonality])
  useEffect(() => { brainRef.current = activeBrain }, [activeBrain])
  useEffect(() => {
    if (defaultBrain) setActiveBrain(defaultBrain)
  }, [defaultBrain])

  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  // ---- SPEECH RECOGNITION ----
  const toggleListening = useCallback(async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      addToast('Speech recognition not supported. Use Chrome or Edge.', 'error')
      return
    }

    // If currently listening, stop and send
    if (isListening) {
      setIsListening(false)
      if (recognitionRef.current) {
        recognitionRef.current._shouldAutoSend = true
        try { recognitionRef.current.stop() } catch {}
      }
      return
    }

    // Safety: if recognition exists but isListening is false, abort old one first
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        addToast('Microphone blocked. Allow access in browser settings.', 'error')
      } else if (err.name === 'NotFoundError') {
        addToast('No microphone found.', 'error')
      } else {
        addToast('Could not access microphone.', 'error')
      }
      return
    }

    if (stream) stream.getTracks().forEach(t => t.stop())

    try {
      const recognition = new SR()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.maxAlternatives = 1
      recognition._shouldAutoSend = false
      recognition._collectedText = ''

      recognition.onresult = (event: any) => {
        let interim = ''
        let finalText = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const tr = event.results[i][0].transcript
          if (event.results[i].isFinal) finalText += tr
          else interim += tr
        }
        if (finalText) {
          recognition._collectedText += finalText
          setInput(recognition._collectedText)
        }
        if (interim) {
          setInput(recognition._collectedText + (recognition._collectedText ? ' ' : '') + interim)
        }
      }

      recognition.onerror = (event: any) => {
        // Always reset listening state on any error
        setIsListening(false)
        if (event.error === 'aborted' || event.error === 'no-speech') return
        if (event.error === 'not-allowed') addToast('Microphone blocked by browser.', 'error')
        else addToast('Mic error: ' + event.error, 'error')
      }

      recognition.onend = () => {
        // Always reset listening state
        setIsListening(false)
        const finalText = (recognition._collectedText || '').trim()
        recognition._collectedText = ''
        if (finalText) {
          voiceInputRef.current = true
          setInput('')
          sendWithText(finalText)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
    } catch {
      addToast('Failed to start microphone', 'error')
    }
  }, [isListening, addToast])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    }
  }, [])

  // ---- TTS ----
  const speechIdRef = useRef(0)

  const speakWithEdgeTTS = useCallback(async (text: string) => {
    if (!text) return
    speechIdRef.current++
    const mySpeechId = speechIdRef.current
    window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsSpeaking(true)

    // Load voice preset from settings
    let voicePreset = 'sophia'
    try {
      const saved = localStorage.getItem('nero-settings')
      if (saved) {
        const s = JSON.parse(saved)
        if (s.voicePreset) voicePreset = s.voicePreset
      }
    } catch {}

    const cleanText = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/---+/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) { setIsSpeaking(false); return }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          preset: voicePreset,
          rate: '-5%',
          pitch: '+0Hz',
          apiKey: localStorage.getItem('nero-gemini-key') || undefined,
          fallbackKey: localStorage.getItem('nero-gemini-key-fallback') || undefined,
        }),
      })
      if (speechIdRef.current !== mySpeechId) return
      if (!response.ok) throw new Error('TTS failed')

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      if (speechIdRef.current !== mySpeechId) { URL.revokeObjectURL(audioUrl); return }

      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { if (speechIdRef.current === mySpeechId) setIsSpeaking(false); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { if (speechIdRef.current === mySpeechId) setIsSpeaking(false); URL.revokeObjectURL(audioUrl) }

      try { await audio.play() }
      catch { if (speechIdRef.current === mySpeechId) setIsSpeaking(false); URL.revokeObjectURL(audioUrl) }
    } catch {
      if (speechIdRef.current === mySpeechId) setIsSpeaking(false)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    speechIdRef.current++
    window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.currentTime = 0
    }
    setIsSpeaking(false)
  }, [])

  // ---- SEND MESSAGE ----
  const sendWithText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoadingRef.current) return

    const shouldSpeak = voiceInputRef.current
    voiceInputRef.current = false
    stopSpeaking()

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    isLoadingRef.current = true

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const assistantId = `assistant-${Date.now()}`
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, assistantPlaceholder])

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // Get client-side memories to send with request
      const clientMemories = getMemories()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationIdRef.current ?? undefined,
          personality: personalityRef.current,
          brainType: brainRef.current ?? undefined,
          apiKey: localStorage.getItem('nero-gemini-key') || undefined,
          fallbackKey: localStorage.getItem('nero-gemini-key-fallback') || undefined,
          clientMemories: clientMemories.map(m => `${m.category}: ${m.key} = ${m.value}`).join('\n'),
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) throw new Error('No response stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let metadata: { conversationId?: string; brainUsed?: string; provider?: string; model?: string; personality?: PersonalityType } = {}
      let confidenceData: string | null = null
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
            if (parsed.conversationId) {
              metadata = parsed
              conversationIdRef.current = parsed.conversationId
              setConversationId(parsed.conversationId)
              setActiveBrain(parsed.brainUsed)
              if (parsed.personality) personalityRef.current = parsed.personality
              onConversationCreated?.(parsed.conversationId)
              continue
            }
            if (parsed.confidence) {
              confidenceData = parsed.confidence.confidence || null
              continue
            }
            if (parsed.content) {
              fullContent += parsed.content
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullContent, brainUsed: metadata.brainUsed, provider: metadata.provider, model: metadata.model, personality: metadata.personality }
                    : m
                )
              )
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullContent, isStreaming: false, brainUsed: metadata.brainUsed, provider: metadata.provider, model: metadata.model, personality: metadata.personality, timestamp: new Date().toISOString(), confidence: confidenceData }
            : m
        )
      )

      // Handle memory-saving tool calls from Nero's response
      if (fullContent) {
        const toolCallRegex = /```json\s*\{"tool"\s*:\s*"save_memory"\s*,\s*"params"\s*:\s*\{[^}]*"category"\s*:\s*"([^"]+)"[^}]*"key"\s*:\s*"([^"]+)"[^}]*"value"\s*:\s*"([^"]+)"[^}]*\}\s*```\s*/g
        let match
        while ((match = toolCallRegex.exec(fullContent)) !== null) {
          const [, category, key, value] = match
          if (category && key && value) {
            addMemory(category, key, value)
          }
        }
        // Also handle inline tool calls
        const inlineRegex = /\{"tool"\s*:\s*"save_memory"\s*,\s*"params"\s*:\s*\{[^}]*"category"\s*:\s*"([^"]+)"[^}]*"key"\s*:\s*"([^"]+)"[^}]*"value"\s*:\s*"([^"]+)"[^}]*\}/g
        while ((match = inlineRegex.exec(fullContent)) !== null) {
          const [, category, key, value] = match
          if (category && key && value) {
            addMemory(category, key, value)
          }
        }
      }

      if (metadata.personality && metadata.personality !== personalityRef.current) {
        personalityRef.current = metadata.personality
        setActivePersonality(metadata.personality)
        const meta = PERSONALITY_META[metadata.personality]
        addToast(`Switched to ${meta.name} — ${meta.label} mode`, 'success')
      }

      if (fullContent && shouldSpeak) speakWithEdgeTTS(fullContent)

      if (fullContent) onMoodChange?.()
    } catch (err: any) {
      if (err.name === 'AbortError') return
      addToast(err.message || 'Failed to get response', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
      abortControllerRef.current = null
    }
  }, [addToast, onConversationCreated, speakWithEdgeTTS, stopSpeaking])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoadingRef.current) return

    if (trimmed.startsWith('/')) {
      const cmd = commands.find(c => c.name === trimmed.split(' ')[0].toLowerCase())
      if (cmd) {
        executeCommand(cmd)
        return
      }
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current._shouldAutoSend = false
      recognitionRef.current.stop()
      setIsListening(false)
    }
    voiceInputRef.current = false
    setInput('')
    setShowCommands(false)
    await sendWithText(trimmed)
  }, [input, isListening, sendWithText, commands])

  const handleFeedback = useCallback(async (messageId: string, type: string, content?: string) => {
    try {
      setFeedbackMap(prev => ({ ...prev, [messageId]: type }))
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ messageId, type, content }),
      })
    } catch {
      // silently fail
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape' && showCommands) {
        setShowCommands(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage, showCommands]
  )

  // Load conversation
  useEffect(() => {
    if (activeConversationId && activeConversationId !== conversationId) {
      loadConversation(activeConversationId)
    } else if (!activeConversationId && conversationId) {
      setMessages([])
      setConversationId(null)
      setActiveBrain(null)
    }
  }, [activeConversationId])

  const loadConversation = useCallback(async (convId: string) => {
    try {
      setConversationId(convId)
      const response = await fetch(`/api/messages?conversationId=${convId}`, { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to load messages')
      const data = await response.json()
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          brainUsed: m.brain_used,
          personality: m.personality || 'normal',
          timestamp: m.created_at,
        }))
        setMessages(loadedMessages)
        const lastBrain = [...loadedMessages].reverse().find(m => m.brainUsed)?.brainUsed
        if (lastBrain) setActiveBrain(lastBrain)
        const lastPersonality = [...loadedMessages].reverse().find(m => m.personality)?.personality
        if (lastPersonality) setActivePersonality(lastPersonality)
      } else {
        setMessages([])
      }
    } catch {
      addToast('Failed to load conversation', 'error')
    }
  }, [addToast])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length === 0) {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      return
    }
    const toStore = messages.slice(-MAX_STORED_MESSAGES)
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore))
    } catch { /* quota exceeded, ignore */ }
  }, [messages])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [input])

  const handleNewChat = useCallback(() => {
    if (isLoadingRef.current) abortControllerRef.current?.abort()
    stopSpeaking()
    setMessages([])
    setConversationId(null)
    setActiveBrain(null)
    setActivePersonality('normal')
    personalityRef.current = 'normal'
    isLoadingRef.current = false
    conversationIdRef.current = null
    setInput('')
    setIsLoading(false)
    onConversationCreated?.('')
  }, [onConversationCreated, stopSpeaking])

  const pMeta = PERSONALITY_META[activePersonality]

  return (
    <div className="flex flex-col h-full relative overflow-hidden">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                What can I help with?
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
                Ask me anything, or try one of these
              </p>
              <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
                {[
                  { text: 'What can you do?', icon: '?' },
                  { text: 'Write me a Python script', icon: '</>' },
                  { text: 'Help me brainstorm ideas', icon: '!' },
                  { text: 'Tell me a fun fact', icon: '*' },
                ].map((suggestion) => (
                  <motion.button
                    key={suggestion.text}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      cursor: 'pointer',
                    }}
                    whileHover={{
                      borderColor: 'var(--border-hover)',
                      background: 'var(--bg-tertiary)',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendWithText(suggestion.text)}
                  >
                    <span className="text-[10px] font-mono" style={{ color: 'var(--accent)', opacity: 0.6 }}>{suggestion.icon}</span>
                    <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{suggestion.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Personality & Brain info */}
            <div className="flex items-center gap-3 mt-4">
              <motion.button
                onClick={() => {
                  setActivePersonality(prev => prev === 'normal' ? 'waifu' : 'normal')
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
                whileHover={{ borderColor: 'var(--border-hover)' }}
                whileTap={{ scale: 0.97 }}
              >
                {pMeta.label}
              </motion.button>
              {activeBrain && (
                <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{
                  background: 'var(--accent-subtle)',
                  border: '1px solid rgba(0,217,255,0.1)',
                  color: 'var(--text-tertiary)',
                }}>
                  {activeBrain}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                  <MessageBubble
                    role={msg.role}
                    content={msg.content}
                    brainUsed={msg.brainUsed}
                    provider={msg.provider}
                    model={msg.model}
                    timestamp={msg.timestamp}
                    isNew={msg.isStreaming}
                    messageId={msg.id}
                    onFeedback={handleFeedback}
                    feedbackGiven={feedbackMap[msg.id] || null}
                    confidence={msg.confidence || null}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (messages[messages.length - 1]?.content === '' || (messages[messages.length - 1]?.content?.length ?? 0) < 20) && (
              <motion.div className="flex items-center gap-2 py-2 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <div className="typing-indicator">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
                <span className="typing-label">Thinking{activeBrain ? ` with ${activeBrain} brain` : ''}...</span>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area — glass panel */}
      <div className="shrink-0 px-6 py-4 relative z-10" style={{
        borderTop: '1px solid var(--glass-border)',
        background: 'rgba(14, 14, 20, 0.5)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div className="max-w-3xl mx-auto">
          {/* Command autocomplete */}
          <AnimatePresence>
            {showCommands && filteredCommands.length > 0 && (
              <motion.div
                className="command-autocomplete"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.12 }}
              >
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.name}
                    className="command-item"
                    onClick={() => executeCommand(cmd)}
                  >
                    <span className="command-name">{cmd.name}</span>
                    <span className="command-desc">{cmd.description}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex items-end gap-3 rounded-xl px-4 py-3" style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${isListening ? 'rgba(248,113,113,0.3)' : 'var(--border-default)'}`,
            transition: 'border-color 0.2s',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : 'Message Nero...'}
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm resize-none outline-none disabled:opacity-50"
              style={{ color: 'var(--text-primary)', maxHeight: '160px', lineHeight: '1.6' }}
              onFocus={(e) => {
                if (!isListening) {
                  const p = e.currentTarget.parentElement
                  if (p) { p.style.borderColor = 'rgba(148, 163, 184, 0.25)' }
                }
              }}
              onBlur={(e) => {
                if (!isListening) {
                  const p = e.currentTarget.parentElement
                  if (p) { p.style.borderColor = 'var(--border-default)' }
                }
              }}
            />

            {/* Mic button */}
            <motion.button
              onClick={toggleListening}
              disabled={isLoading}
              className="flex items-center justify-center shrink-0"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isListening ? 'rgba(248,113,113,0.12)' : 'transparent',
                border: `1.5px solid ${isListening ? 'rgba(248,113,113,0.25)' : 'var(--border-default)'}`,
                color: isListening ? 'var(--color-error)' : 'var(--text-tertiary)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
              whileHover={!isLoading ? { background: isListening ? 'rgba(248,113,113,0.18)' : 'var(--accent-subtle)' } : {}}
              whileTap={!isLoading ? { scale: 0.95 } : {}}
              title={isListening ? 'Stop listening' : 'Speak to Nero'}
            >
              {isListening ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </motion.div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="12" rx="3" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </motion.button>

            {/* Stop speaking */}
            {isSpeaking && (
              <motion.button
                onClick={stopSpeaking}
                className="flex items-center justify-center shrink-0"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(52,211,153,0.08)',
                  border: '1.5px solid rgba(52,211,153,0.2)',
                  color: 'var(--color-success)',
                  cursor: 'pointer',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Stop speaking"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </motion.button>
            )}

            {/* Send button */}
            <GlowButton
              variant="primary"
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              icon={
                isLoading ? (
                  <div className="spinner-sm" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )
              }
            >
              {isLoading ? '' : 'Send'}
            </GlowButton>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {activePersonality === 'waifu'
                ? 'Nero Waifu mode — say "be normal" to switch back'
                : 'Nero Core — say "act like a waifu" to switch personality'}
            </p>
            <div className="flex items-center gap-2">
              {isListening && <span className="text-[10px] font-mono" style={{ color: 'var(--color-error)' }}>REC</span>}
              {isSpeaking && <span className="text-[10px] font-mono" style={{ color: 'var(--color-success)' }}>Speaking</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 rounded-lg text-sm max-w-sm"
              style={{
                background: toast.type === 'error' ? 'rgba(248,113,113,0.08)' : toast.type === 'success' ? 'rgba(52,211,153,0.08)' : 'rgba(0,217,255,0.08)',
                border: `1px solid ${toast.type === 'error' ? 'rgba(248,113,113,0.15)' : toast.type === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(0,217,255,0.15)'}`,
                color: toast.type === 'error' ? 'var(--color-error)' : toast.type === 'success' ? 'var(--color-success)' : 'var(--accent)',
                backdropFilter: 'blur(16px)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'error' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
                {toast.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

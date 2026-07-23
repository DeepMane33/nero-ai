/**
 * Google Gemini API client — direct REST calls to generativelanguage.googleapis.com
 * Default model: gemini-2.0-flash (free tier, fast, supports streaming + vision)
 */

import { resolveGeminiApiKey } from '@/core/models'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'

/**
 * Build auth for Gemini API — supports both AIzaSy keys and AQ OAuth tokens.
 */
function buildGeminiAuth(apiKey: string): { urlParam: string; headers: Record<string, string> } {
  if (apiKey.startsWith('AQ.')) {
    return { urlParam: '', headers: { 'Authorization': `Bearer ${apiKey}` } }
  }
  return { urlParam: `?key=${apiKey}`, headers: {} }
}

export interface ChatMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  systemPrompt?: string
  model?: string
  stream?: boolean
  temperature?: number
  maxTokens?: number
}

/**
 * Brain-specific system prompts
 */
const BRAIN_PROMPTS: Record<string, string> = {
  reasoning:
    'You are the Reasoning Brain of Nero AI OS. Think step-by-step, analyze logically, and provide well-structured answers. Be precise and thorough.',
  coding:
    'You are the Coding Brain of Nero AI OS. Write clean, efficient, well-documented code. Follow best practices, use modern syntax, and explain your approach concisely.',
  research:
    'You are the Research Brain of Nero AI OS. Provide comprehensive, well-sourced information. Synthesize multiple perspectives and highlight key findings.',
  creative:
    'You are the Creative Brain of Nero AI OS. Think imaginatively, generate novel ideas, and express them with flair. Be bold and original.',
  memory:
    'You are the Memory Brain of Nero AI OS. Recall and organize information accurately. Help the user build and maintain a structured knowledge base.',
  learning:
    'You are the Learning Brain of Nero AI OS. Explain concepts clearly using analogies and examples. Adapt to the user\'s level and build understanding progressively.',
  automation:
    'You are the Automation Brain of Nero AI OS. Help design workflows, scripts, and automated processes. Focus on efficiency, reliability, and repeatability.',
}

export function getBrainPrompt(brain: string): string {
  return BRAIN_PROMPTS[brain] || BRAIN_PROMPTS.reasoning
}

/**
 * Convert standard OpenAI-style messages to Gemini format
 */
function toGeminiMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(m => m.role !== ('system' as any))
    .map(m => ({
      role: m.role === 'model' ? 'model' as const : 'user' as const,
      parts: m.parts,
    }))
}

/**
 * Send a chat completion request to Gemini.
 * When stream=true, returns the raw Response for the caller to consume as SSE.
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<any> {
  const apiKey = resolveGeminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured. Add one in Settings or .env.local.')
  }

  const {
    messages,
    systemPrompt,
    model = DEFAULT_MODEL,
    stream = false,
    temperature = 0.7,
    maxTokens = 4096,
  } = options

  // Build Gemini request format
  const contents = toGeminiMessages(messages)

  const body: any = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  // Add system instruction if provided
  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    }
  }

  const auth = buildGeminiAuth(apiKey)
  const keyParam = auth.urlParam

  const endpoint = stream
    ? `${GEMINI_API_URL}/${model}:streamGenerateContent?alt=sse${keyParam ? '&' + keyParam.slice(1) : ''}`
    : `${GEMINI_API_URL}/${model}:generateContent${keyParam}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...auth.headers,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  if (stream) {
    return response // caller handles the ReadableStream
  }

  const data = await response.json()
  return data
}

/**
 * Extract text from Gemini response
 */
export function extractText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/**
 * Stream a chat completion and yield text chunks.
 */
export async function* streamCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<string, void, unknown> {
  const response = (await chatCompletion({
    ...options,
    stream: true,
  })) as Response

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)

      try {
        const parsed = JSON.parse(data)
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {
        // skip malformed chunks
      }
    }
  }
}

/**
 * Convenience: send a single user message and get the text reply.
 */
export async function ask(
  userMessage: string,
  brain: string = 'reasoning',
  opts?: { model?: string; temperature?: number }
): Promise<string> {
  const data = await chatCompletion({
    messages: [{ role: 'user', parts: [{ text: userMessage }] }],
    systemPrompt: getBrainPrompt(brain),
    model: opts?.model,
    temperature: opts?.temperature,
  })
  return extractText(data)
}

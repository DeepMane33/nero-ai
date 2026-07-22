/**
 * Groq API client — direct REST calls to api.groq.com
 * Default model: llama-3.1-8b-instant (free tier)
 */

import { resolveApiKey } from '@/core/models'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.1-8b-instant'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  systemPrompt?: string
  model?: string
  stream?: boolean
  temperature?: number
  maxTokens?: number
}

export interface ChatCompletionResponse {
  id: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
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
 * Send a chat completion request to Groq.
 * When stream=true, returns the raw Response for the caller to consume as SSE.
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse | Response> {
  const apiKey = resolveApiKey('groq')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured. Add one in Settings or .env.local.')
  }

  const {
    messages,
    systemPrompt,
    model = DEFAULT_MODEL,
    stream = false,
    temperature = 0.7,
    maxTokens = 4096,
  } = options

  const fullMessages: ChatMessage[] = []

  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt })
  }

  fullMessages.push(...messages)

  const body = JSON.stringify({
    model,
    messages: fullMessages,
    stream,
    temperature,
    max_tokens: maxTokens,
  })

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Groq API error ${response.status}: ${errorText}`)
  }

  if (stream) {
    return response // caller handles the ReadableStream
  }

  return (await response.json()) as ChatCompletionResponse
}

/**
 * Convenience helper: send a single user message and get the text reply.
 */
export async function ask(
  userMessage: string,
  brain: string = 'reasoning',
  opts?: { model?: string; temperature?: number }
): Promise<string> {
  const res = (await chatCompletion({
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt: getBrainPrompt(brain),
    model: opts?.model,
    temperature: opts?.temperature,
  })) as ChatCompletionResponse

  return res.choices[0]?.message?.content ?? ''
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
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // skip malformed chunks
      }
    }
  }
}

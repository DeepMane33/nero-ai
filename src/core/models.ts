/**
 * Multi-Provider Model System for Nero AI
 * 
 * Supports multiple free/cheap LLM providers with smart routing:
 * - Google Gemini (free tier + fallback key)
 * - Groq (free tier)
 * - OpenRouter (free models)
 * - Cerebras (free tier)
 * - SambaNova (free tier)
 * 
 * Each brain type can use different models optimized for that task.
 * Auto-failover if a provider is down.
 * 
 * Custom API keys from users are stored securely server-side and never exposed to the client.
 */

export interface ModelProvider {
  name: string
  baseUrl: string
  apiKey: string | undefined
  format: 'openai' | 'gemini' | 'anthropic'
  models: ModelDefinition[]
}

export interface ModelDefinition {
  id: string
  name: string
  provider: string
  strengths: string[]
  contextWindow: number
  speed: 'fast' | 'medium' | 'slow'
  quality: 'high' | 'medium' | 'low'
  brainTypes: string[]  // Which brain types this model is best for
}

export interface ModelRoute {
  provider: ModelProvider
  model: ModelDefinition
  systemPrompt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom API keys storage (server-side only, never sent to client)
// ─────────────────────────────────────────────────────────────────────────────

interface CustomApiKeyEntry {
  providerId: string
  apiKey: string
  addedAt: number
}

// In-memory store of user-provided API keys (per-server session)
const customApiKeys = new Map<string, CustomApiKeyEntry>()

export function setCustomApiKey(providerId: string, apiKey: string): void {
  // Temporarily store key for this request only — not persisted
  customApiKeys.set(providerId, { providerId, apiKey, addedAt: Date.now() })
}

export function removeCustomApiKey(providerId: string): boolean {
  return customApiKeys.delete(providerId)
}

export function getCustomApiKey(providerId: string): string | undefined {
  return customApiKeys.get(providerId)?.apiKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom provider registration (user-provided API + model)
// ─────────────────────────────────────────────────────────────────────────────

interface CustomProviderEntry {
  providerId: string
  name: string
  baseUrl: string
  apiKey: string
  modelId: string
  modelName: string
  format: 'openai' | 'gemini'
  addedAt: number
}

const customProviders = new Map<string, CustomProviderEntry>()

export function registerCustomProvider(entry: CustomProviderEntry): void {
  // No-op — custom providers are not supported on Vercel serverless
}

export function removeCustomProvider(providerId: string): boolean {
  return false
}

export function getCustomProvider(providerId: string): CustomProviderEntry | undefined {
  return undefined
}

export function getAllCustomProviders(): CustomProviderEntry[] {
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Active provider tracking (which provider Nero is currently using)
// ─────────────────────────────────────────────────────────────────────────────

let activeProviderId: string | null = null

export function setActiveProvider(providerId: string | null): void {
  activeProviderId = providerId
}

export function getActiveProvider(): string | null {
  return activeProviderId
}

// ─────────────────────────────────────────────────────────────────────────────
// API Key validation
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyValidationResult {
  valid: boolean
  provider: string
  error?: string
  models?: string[]
}

/**
 * Validate a Gemini API key by making a lightweight request
 */
async function validateGeminiKey(apiKey: string): Promise<KeyValidationResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (response.ok) {
      const data = await response.json()
      const models = data.models?.map((m: any) => m.name) || []
      return { valid: true, provider: 'gemini', models }
    }
    return { valid: false, provider: 'gemini', error: `HTTP ${response.status}` }
  } catch (err: any) {
    return { valid: false, provider: 'gemini', error: err.message }
  }
}

/**
 * Validate an OpenAI-compatible API key (Groq, OpenRouter, Cerebras, SambaNova, custom)
 */
async function validateOpenAIKey(apiKey: string, baseUrl: string, providerName: string): Promise<KeyValidationResult> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    if (response.ok) {
      const data = await response.json()
      const models = data.data?.map((m: any) => m.id) || []
      return { valid: true, provider: providerName, models }
    }
    return { valid: false, provider: providerName, error: `HTTP ${response.status}` }
  } catch (err: any) {
    return { valid: false, provider: providerName, error: err.message }
  }
}

/**
 * Validate an Anthropic API key
 */
async function validateAnthropicKey(apiKey: string): Promise<KeyValidationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-3-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10000),
    })
    // 400 = valid key but bad request, 401 = bad key
    if (response.status === 400) {
      return { valid: true, provider: 'anthropic' }
    }
    if (response.status === 401) {
      return { valid: false, provider: 'anthropic', error: 'Invalid API key' }
    }
    return { valid: false, provider: 'anthropic', error: `HTTP ${response.status}` }
  } catch (err: any) {
    return { valid: false, provider: 'anthropic', error: err.message }
  }
}

export async function validateApiKey(providerId: string, apiKey: string): Promise<KeyValidationResult> {
  switch (providerId) {
    case 'gemini':
      return validateGeminiKey(apiKey)
    case 'groq':
      return validateOpenAIKey(apiKey, 'https://api.groq.com/openai/v1', 'groq')
    case 'openrouter':
      return validateOpenAIKey(apiKey, 'https://openrouter.ai/api/v1', 'openrouter')
    case 'cerebras':
      return validateOpenAIKey(apiKey, 'https://api.cerebras.ai/v1', 'cerebras')
    case 'sambanova':
      return validateOpenAIKey(apiKey, 'https://api.sambanova.ai/v1', 'sambanova')
    case 'anthropic':
      return validateAnthropicKey(apiKey)
    case 'custom':
      // For custom providers, we need a base URL too
      return { valid: false, provider: 'custom', error: 'Custom providers require a base URL' }
    default:
      // Check if it's a registered custom provider
      const cp = customProviders.get(providerId)
      if (cp) {
        if (cp.format === 'gemini') {
          return validateGeminiKey(apiKey)
        }
        return validateOpenAIKey(apiKey, cp.baseUrl, cp.name)
      }
      return { valid: false, provider: providerId, error: 'Unknown provider' }
  }
}

/**
 * Validate a custom OpenAI-compatible provider with base URL
 */
export async function validateCustomApiKey(apiKey: string, baseUrl: string): Promise<KeyValidationResult> {
  // Gemini uses different auth
  if (baseUrl.includes('googleapis.com')) {
    return validateGeminiKey(apiKey)
  }
  // Anthropic uses a different validation endpoint
  if (baseUrl.includes('anthropic.com')) {
    return validateAnthropicKey(apiKey)
  }
  return validateOpenAIKey(apiKey, baseUrl, 'custom')
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider configurations
// ─────────────────────────────────────────────────────────────────────────────

const providers: Record<string, ModelProvider> = {
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY,
    format: 'gemini',
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        strengths: ['natural conversation', 'reasoning', 'coding', 'creative writing', 'huge context'],
        contextWindow: 1000000,
        speed: 'fast',
        quality: 'high',
        brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation', 'research']
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        strengths: ['fast responses', 'general chat', 'simple tasks', 'low latency'],
        contextWindow: 1000000,
        speed: 'fast',
        quality: 'medium',
        brainTypes: ['memory', 'automation']
      }
    ]
  },

  gemini_fallback: {
    name: 'Google Gemini (Fallback)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY_FALLBACK,
    format: 'gemini',
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini_fallback',
        strengths: ['natural conversation', 'reasoning', 'coding', 'creative writing', 'huge context'],
        contextWindow: 1000000,
        speed: 'fast',
        quality: 'high',
        brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation', 'research']
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini_fallback',
        strengths: ['fast responses', 'general chat', 'simple tasks', 'low latency'],
        contextWindow: 1000000,
        speed: 'fast',
        quality: 'medium',
        brainTypes: ['memory', 'automation']
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain-to-model mapping (with fallback keys inserted)
// ─────────────────────────────────────────────────────────────────────────────

const brainModelPriority: Record<string, string[]> = {
  reasoning: [
    'gemini/gemini-2.5-flash',
    'gemini_fallback/gemini-2.5-flash',
  ],
  coding: [
    'gemini/gemini-2.5-flash',
    'gemini_fallback/gemini-2.5-flash',
  ],
  research: [
    'gemini/gemini-2.5-flash',
    'gemini_fallback/gemini-2.5-flash',
  ],
  creative: [
    'gemini/gemini-2.5-flash',
    'gemini_fallback/gemini-2.5-flash',
  ],
  memory: [
    'gemini/gemini-2.0-flash',
    'gemini_fallback/gemini-2.0-flash',
  ],
  learning: [
    'gemini/gemini-2.5-flash',
    'gemini_fallback/gemini-2.5-flash',
  ],
  automation: [
    'gemini/gemini-2.0-flash',
    'gemini_fallback/gemini-2.0-flash',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Model selection and routing
// ─────────────────────────────────────────────────────────────────────────────

function getEffectiveApiKey(provider: ModelProvider, providerId: string): string | undefined {
  // Check for custom user-provided key first
  const customKey = getCustomApiKey(providerId)
  console.log('[getEffectiveApiKey]', providerId, 'customKey:', customKey ? 'YES' : 'NO', 'envKey:', provider.apiKey ? 'YES' : 'NO')
  if (customKey) return customKey
  // Fall back to environment key
  return provider.apiKey
}

function findModel(modelPath: string): { provider: ModelProvider; model: ModelDefinition } | null {
  const [providerName, ...modelParts] = modelPath.split('/')
  const modelId = modelParts.join('/')

  const provider = providers[providerName]
  if (!provider) {
    // Check custom providers — match by providerId or by modelId
    const cp = customProviders.get(providerName)
    if (cp) {
      return {
        provider: {
          name: cp.name,
          baseUrl: cp.baseUrl,
          apiKey: cp.apiKey,
          format: cp.format,
          models: [{
            id: cp.modelId,
            name: cp.modelName,
            provider: cp.providerId,
            strengths: ['custom'],
            contextWindow: 128000,
            speed: 'medium',
            quality: 'high',
            brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation']
          }]
        },
        model: {
          id: cp.modelId,
          name: cp.modelName,
          provider: cp.providerId,
          strengths: ['custom'],
          contextWindow: 128000,
          speed: 'medium',
          quality: 'high',
          brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation']
        }
      }
    }
    return null
  }

  // Check if we have an API key (env or custom)
  const apiKey = getEffectiveApiKey(provider, providerName)
  console.log('[findModel]', modelPath, 'apiKey:', apiKey ? 'YES' : 'NO', 'provider:', providerName)
  if (!apiKey) return null
  
  const model = provider.models.find(m => m.id === modelId)
  if (!model) return null
  
  return { provider, model }
}

/**
 * Get the effective API key for a provider, checking custom keys first
 */
export function resolveApiKey(providerName: string, clientFallback?: string): string | undefined {
  const provider = providers[providerName]
  if (!provider) return undefined
  const envKey = getEffectiveApiKey(provider, providerName)
  if (envKey) return envKey
  if (clientFallback) return clientFallback
  return undefined
}

/**
 * Resolve Gemini API key — checks env var only.
 * Client-side keys are passed per-request and handled by the route.
 */
export function resolveGeminiApiKey(): string | undefined {
  return resolveApiKey('gemini')
}

/**
 * Resolve Gemini API key with a client-provided fallback.
 * The client key is used for THIS request only — never stored server-side.
 */
export function resolveGeminiKeyWithClientFallback(clientKey?: string): string | undefined {
  return resolveApiKey('gemini', clientKey)
}

export function selectModel(brainType: string): { provider: ModelProvider; model: ModelDefinition } | null {
  // First, check if there are custom providers — user's own API takes priority
  // Use the first available custom provider (they support all brain types)
  for (const cp of customProviders.values()) {
    return {
      provider: {
        name: cp.name,
        baseUrl: cp.baseUrl,
        apiKey: cp.apiKey,
        format: cp.format,
        models: [{
          id: cp.modelId,
          name: cp.modelName,
          provider: cp.providerId,
          strengths: ['custom'],
          contextWindow: 128000,
          speed: 'medium',
          quality: 'high',
          brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation']
        }]
      },
      model: {
        id: cp.modelId,
        name: cp.modelName,
        provider: cp.providerId,
        strengths: ['custom'],
        contextWindow: 128000,
        speed: 'medium',
        quality: 'high',
        brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation']
      }
    }
  }

  // Fall back to built-in providers
  const priorities = brainModelPriority[brainType] || brainModelPriority.reasoning
  
  for (const modelPath of priorities) {
    const result = findModel(modelPath)
    if (result) return result
  }
  
  // Fallback: first available provider with an API key
  for (const provider of Object.values(providers)) {
    const providerId = Object.keys(providers).find(k => providers[k] === provider)!
    const apiKey = getEffectiveApiKey(provider, providerId)
    if (apiKey && provider.models.length > 0) {
      return { provider, model: provider.models[0] }
    }
  }
  
  return null
}

export function getAvailableModels(): { provider: string; model: ModelDefinition; hasCustomKey: boolean; isCustom: boolean }[] {
  const available: { provider: string; model: ModelDefinition; hasCustomKey: boolean; isCustom: boolean }[] = []
  
  for (const [providerId, provider] of Object.entries(providers)) {
    const apiKey = getEffectiveApiKey(provider, providerId)
    if (apiKey) {
      for (const model of provider.models) {
        available.push({ 
          provider: provider.name, 
          model,
          hasCustomKey: !!getCustomApiKey(providerId),
          isCustom: false,
        })
      }
    }
  }

  // Add custom provider models
  for (const cp of customProviders.values()) {
    available.push({
      provider: cp.name,
      model: {
        id: cp.modelId,
        name: cp.modelName,
        provider: cp.providerId,
        strengths: ['custom', 'user-provided'],
        contextWindow: 128000,
        speed: 'medium',
        quality: 'high',
        brainTypes: ['reasoning', 'coding', 'creative', 'learning', 'memory', 'automation']
      },
      hasCustomKey: true,
      isCustom: true,
    })
  }
  
  return available
}

export function getProviderStatus(): { id: string; name: string; available: boolean; modelCount: number; hasCustomKey: boolean; isActive: boolean; isCustom: boolean }[] {
  const builtin = Object.entries(providers).map(([id, p]) => ({
    id,
    name: p.name,
    available: !!(p.apiKey || getCustomApiKey(id)),
    modelCount: p.models.length,
    hasCustomKey: !!getCustomApiKey(id),
    isActive: activeProviderId === id,
    isCustom: false,
  }))

  // Add custom providers
  const custom = Array.from(customProviders.values()).map(cp => ({
    id: cp.providerId,
    name: cp.name,
    available: true,
    modelCount: 1,
    hasCustomKey: true,
    isActive: activeProviderId === cp.providerId,
    isCustom: true,
  }))

  return [...builtin, ...custom]
}

// ─────────────────────────────────────────────────────────────────────────────
// API call functions
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullResponse: string) => void
  onError: (error: Error) => void
}

/**
 * Resolve the effective API key for a provider, preferring custom keys
 */
function getApiKeyForProvider(providerName: string, provider: ModelProvider): string {
  const key = resolveApiKey(providerName)
  console.log('[getApiKeyForProvider]', providerName, 'key:', key ? 'YES (len:' + key.length + ')' : 'NO')
  if (!key) {
    throw new Error(`No API key available for ${provider.name}. Add one in Settings or .env.local.`)
  }
  return key
}

export async function callModel(
  provider: ModelProvider,
  model: ModelDefinition,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  providerId?: string
): Promise<void> {
  // Resolve the effective API key
  const resolvedId = providerId || model.provider
  const apiKey = getApiKeyForProvider(resolvedId, provider)
  
  if (provider.format === 'gemini') {
    await callGeminiModel(provider, model, messages, callbacks, apiKey)
  } else {
    await callOpenAIModel(provider, model, messages, callbacks, apiKey)
  }
}

async function callGeminiModel(
  provider: ModelProvider,
  model: ModelDefinition,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  apiKey: string
): Promise<void> {
  const systemMessage = messages.find(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')
  
  const geminiMessages = userMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  
  const url = `${provider.baseUrl}/models/${model.id}:streamGenerateContent?alt=sse&key=${apiKey}`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
    })
    
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Gemini API error ${response.status}: ${errText}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')
    
    const decoder = new TextDecoder()
    let fullResponse = ''
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        
        try {
          const parsed = JSON.parse(data)
          const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
          if (content) {
            fullResponse += content
            callbacks.onToken(content)
          }
        } catch { /* skip malformed */ }
      }
    }
    
    callbacks.onComplete(fullResponse)
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)))
  }
}

async function callOpenAIModel(
  provider: ModelProvider,
  model: ModelDefinition,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  apiKey: string
): Promise<void> {
  const url = `${provider.baseUrl}/chat/completions`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider.name.includes('OpenRouter') ? {
          'HTTP-Referer': 'https://nero-ai.local',
          'X-Title': 'Nero AI'
        } : {})
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`${provider.name} API error ${response.status}: ${errorText}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')
    
    const decoder = new TextDecoder()
    let fullResponse = ''
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        if (data === '[DONE]') continue
        
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullResponse += content
            callbacks.onToken(content)
          }
        } catch { /* skip malformed */ }
      }
    }
    
    callbacks.onComplete(fullResponse)
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)))
  }
}

async function callAnthropicModel(
  provider: ModelProvider,
  model: ModelDefinition,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  apiKey: string
): Promise<void> {
  const url = `${provider.baseUrl}/messages`
  const systemMessage = messages.find(m => m.role === 'system')
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 4096,
        system: systemMessage?.content,
        messages: nonSystemMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')

    const decoder = new TextDecoder()
    let fullResponse = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()

        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullResponse += parsed.delta.text
            callbacks.onToken(parsed.delta.text)
          }
        } catch { /* skip malformed */ }
      }
    }

    callbacks.onComplete(fullResponse)
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Failover: try multiple models in order
// ─────────────────────────────────────────────────────────────────────────────

export async function callWithFailover(
  brainType: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<{ provider: string; model: string }> {
  const priorities = brainModelPriority[brainType] || brainModelPriority.reasoning

  // Build full list: built-in priorities + custom providers
  const customPaths = Array.from(customProviders.values()).map(
    cp => `${cp.providerId}/${cp.modelId}`
  )
  const allPaths = [...priorities, ...customPaths]

  let lastError: Error | null = null

  for (const modelPath of allPaths) {
    const result = findModel(modelPath)
    if (!result) {
      console.log('[failover] Skipping', modelPath, '- findModel returned null')
      continue
    }

    // Extract provider ID from modelPath
    const providerId = modelPath.split('/')[0]
    console.log('[failover] Trying', modelPath, 'providerId:', providerId, 'format:', result.provider.format)

    try {
      let success = false
      let rateLimited = false

      // Check if it's an Anthropic model
      const isAnthropic = result.provider.format === 'anthropic'

      if (isAnthropic) {
        const apiKey = getApiKeyForProvider(providerId, result.provider)
        await callAnthropicModel(result.provider, result.model, messages, {
          onToken: callbacks.onToken,
          onComplete: (response) => {
            success = true
            activeProviderId = providerId
            callbacks.onComplete(response)
          },
          onError: (error) => {
            console.warn(`[failover] Model ${result.model.name} failed:`, error.message)
            lastError = error
            if (error.message.includes('429') || error.message.includes('rate')) rateLimited = true
          }
        }, apiKey)
      } else {
        await callModel(result.provider, result.model, messages, {
          onToken: callbacks.onToken,
          onComplete: (response) => {
            success = true
            activeProviderId = providerId
            callbacks.onComplete(response)
          },
          onError: (error) => {
            console.warn(`[failover] Model ${result.model.name} failed:`, error.message)
            lastError = error
            if (error.message.includes('429') || error.message.includes('rate')) rateLimited = true
          }
        }, providerId)
      }

      // If rate limited and we have a fallback key, try it
      if (rateLimited && !success) {
        const fallbackKey = getCustomApiKey('gemini_fallback')
        if (fallbackKey && providerId === 'gemini') {
          console.log('[failover] Rate limited on primary key, trying fallback...')
          try {
            await callModel(result.provider, result.model, messages, {
              onToken: callbacks.onToken,
              onComplete: (response) => {
                success = true
                activeProviderId = 'gemini_fallback'
                callbacks.onComplete(response)
              },
              onError: (error) => {
                console.warn(`[failover] Fallback key also failed:`, error.message)
                lastError = error
              }
            }, 'gemini_fallback')
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
          }
        }
      }

      if (success) {
        return { provider: result.provider.name, model: result.model.name }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[failover] Model ${result.model.name} threw:`, lastError.message)
      continue
    }
  }

  throw new Error(lastError?.message || 'All models failed. Add an API key in Settings or .env.local.')
}

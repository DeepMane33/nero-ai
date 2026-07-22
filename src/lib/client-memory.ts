/**
 * Client-side Memory — stored in localStorage only.
 * Each browser has its own isolated memory.
 * Data NEVER crosses between users.
 * Data persists until the user clears browser data.
 */

export interface ClientMemory {
  id: string
  category: string
  key: string
  value: string
  confidence: number
  source: string
  created_at: string
  updated_at: string
}

const MEMORY_KEY = 'nero-memories'

function generateId(): string {
  return 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function loadMemories(): ClientMemory[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMemories(memories: ClientMemory[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memories))
}

export function addMemory(category: string, key: string, value: string, confidence: number = 0.9): ClientMemory {
  const memories = loadMemories()
  const existing = memories.find(m => m.category === category && m.key.toLowerCase() === key.toLowerCase())

  if (existing) {
    existing.value = value
    existing.confidence = confidence
    existing.updated_at = new Date().toISOString()
    saveMemories(memories)
    return existing
  }

  const memory: ClientMemory = {
    id: generateId(),
    category,
    key,
    value,
    confidence,
    source: 'conversation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  memories.push(memory)
  saveMemories(memories)
  return memory
}

export function getMemories(category?: string, query?: string): ClientMemory[] {
  let memories = loadMemories()

  if (category && category !== 'all') {
    memories = memories.filter(m => m.category === category)
  }

  if (query) {
    const lower = query.toLowerCase()
    memories = memories.filter(m =>
      m.key.toLowerCase().includes(lower) ||
      m.value.toLowerCase().includes(lower) ||
      m.category.toLowerCase().includes(lower)
    )
  }

  return memories.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export function deleteMemory(id: string): boolean {
  const memories = loadMemories()
  const idx = memories.findIndex(m => m.id === id)
  if (idx === -1) return false
  memories.splice(idx, 1)
  saveMemories(memories)
  return true
}

export function clearAllMemories(): void {
  saveMemories([])
}

export function searchMemories(query: string): ClientMemory[] {
  return getMemories(undefined, query)
}

export function getMemoryStats(): { total: number; byCategory: Record<string, number> } {
  const memories = loadMemories()
  const byCategory: Record<string, number> = {}
  for (const m of memories) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1
  }
  return { total: memories.length, byCategory }
}

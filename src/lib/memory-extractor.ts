/**
 * Memory Extractor — automatically extracts and stores facts from conversations.
 * Uses lightweight keyword patterns (no extra LLM calls) to detect user facts.
 * All operations are scoped to a userId for per-user isolation.
 */

import { createMemory, searchMemories, getMemoriesByCategory, updateMemory } from './db'

/* ------------------------------------------------------------------ */
/*  Fact extraction patterns                                           */
/* ------------------------------------------------------------------ */

interface ExtractionPattern {
  category: string
  pattern: RegExp
  keyGroup: number
  valueGroup: number
}

const patterns: ExtractionPattern[] = [
  // "my name is X" / "I'm called X"
  { category: 'identity', pattern: /(?:my name is|i'?m called|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i, keyGroup: 0, valueGroup: 1 },
  // "I live in X" / "I'm from X"
  { category: 'location', pattern: /(?:i live in|i'?m from|i'?m in|located in|based in)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "I work as X" / "I'm a X" / "my job is X"
  { category: 'work', pattern: /(?:i work as|i'?m a|my job is|i work at|employed at)\s+(.+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "I like X" / "I love X" / "my favorite X is Y"
  { category: 'preferences', pattern: /(?:i (?:like|love|enjoy|prefer)|my favorite .+? is)\s+(.+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "I'm working on X" / "my project is X"
  { category: 'projects', pattern: /(?:i'?m (?:working on|building|developing|creating)|my project(?:s? (?:is|are))?)\s+(.+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "remember that X" / "note that X"
  { category: 'notes', pattern: /(?:remember that|note that|don'?t forget)\s+(.+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "I use X" / "I'm using X"
  { category: 'tools', pattern: /(?:i (?:use|am using|work with))\s+(.+?)(?:\.|,|!|\?|$)/i, keyGroup: 0, valueGroup: 1 },
  // "my X is Y" (general — only short values to avoid over-matching)
  { category: 'general', pattern: /my\s+(\w+)\s+(?:is|are)\s+(.{2,40}?)(?:\s+(?:and|but|because|so|while|when|, which)|\.|,|!|\?|$)/i, keyGroup: 1, valueGroup: 2 },
]

/* ------------------------------------------------------------------ */
/*  Extraction logic                                                   */
/* ------------------------------------------------------------------ */

interface ExtractedFact {
  category: string
  key: string
  value: string
}

/**
 * Extract facts from a user message.
 * Returns an array of facts found (may be empty).
 */
export function extractFacts(message: string): ExtractedFact[] {
  const facts: ExtractedFact[] = []
  const lower = message.toLowerCase()

  // Skip very short messages or questions (questions aren't facts)
  if (message.length < 10 || message.trim().endsWith('?')) return facts

  for (const { category, pattern, keyGroup, valueGroup } of patterns) {
    const match = message.match(pattern)
    if (match && match[valueGroup]) {
      const key = keyGroup === 0
        ? category
        : match[keyGroup].trim().toLowerCase().replace(/\s+/g, '_')
      const value = match[valueGroup].trim()

      // Skip if value is too short or looks like garbage
      if (value.length < 2 || value.length > 200) continue

      facts.push({ category, key, value })
    }
  }

  return facts
}

/**
 * Store extracted facts in the database.
 * Deduplicates by checking if the same key+value already exists.
 * Returns the number of new facts stored.
 */
export function storeFacts(facts: ExtractedFact[], userId?: string): number {
  let stored = 0

  for (const { category, key, value } of facts) {
    // Check for existing same key-value pair
    const existing = searchMemories(value, 5, userId)
    const duplicate = existing.find(
      m => m.category === category && m.key === key && m.value.toLowerCase() === value.toLowerCase()
    )

    if (duplicate) {
      // Update confidence if seen again
      updateMemory(duplicate.id, { confidence: Math.min(duplicate.confidence + 0.1, 1.0) }, userId)
    } else {
      createMemory(category, key, value, userId)
      stored++
    }
  }

  return stored
}

/**
 * Get relevant memories for a user message using weighted scoring.
 * Combines: semantic relevance (keyword match) + recency decay + confidence importance.
 * Returns the top N most relevant memories as context strings.
 */
export function getRelevantMemories(message: string, limit: number = 5, userId?: string): string[] {
  // Extract key words from message for search
  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'have', 'been', 'your', 'tell', 'about', 'does', 'just', 'like', 'want', 'need', 'make', 'give', 'show', 'help', 'please', 'could', 'would', 'should', 'know', 'think'].includes(w))

  // Collect candidate memories with scores
  const scored: Map<string, { text: string; score: number }> = new Map()

  // ── 1. Semantic relevance: keyword matching with TF-like scoring ──
  const searchTerms = words.slice(0, 5)
  for (const word of searchTerms) {
    const memories = searchMemories(word, 8, userId)
    for (const m of memories) {
      const key = m.id
      const existing = scored.get(key)
      // Count how many search terms appear in the memory
      const matchCount = searchTerms.filter(t =>
        m.key.toLowerCase().includes(t) || m.value.toLowerCase().includes(t)
      ).length
      const semanticScore = matchCount / searchTerms.length

      if (existing) {
        existing.score += semanticScore * 0.5 // bonus for multiple keyword hits
      } else {
        scored.set(key, {
          text: `[${m.category}] ${m.key}: ${m.value}`,
          score: semanticScore,
          // We'll compute recency and confidence below
        } as any)
      }
    }
  }

  // ── 2. Add high-confidence memories from key categories ──
  for (const cat of ['identity', 'preferences', 'projects', 'work', 'location']) {
    const memories = getMemoriesByCategory(cat, userId)
    for (const m of memories.slice(0, 3)) {
      const key = m.id
      if (!scored.has(key)) {
        scored.set(key, {
          text: `[${m.category}] ${m.key}: ${m.value}`,
          score: 0.2, // base score for category importance
        } as any)
      }
    }
  }

  // ── 3. Apply recency decay and confidence weighting ──
  const now = Date.now()
  const HOUR = 3600000
  const DAY = 86400000

  // Re-score with all factors
  const allMemories = searchMemories('', 200, userId) // get all memories
  const memoryMap = new Map(allMemories.map(m => [m.id, m]))

  const finalScored: { text: string; score: number }[] = []

  for (const [id, entry] of scored) {
    const memory = memoryMap.get(id)
    if (!memory) {
      finalScored.push({ text: (entry as any).text, score: entry.score })
      continue
    }

    // Recency decay: newer memories score higher
    const created = new Date(memory.created_at + 'Z').getTime()
    const ageHours = (now - created) / HOUR
    const recencyScore = Math.exp(-ageHours / 168) // half-life of 7 days

    // Confidence weight: higher confidence = more important
    const confidenceScore = memory.confidence

    // Category boost: identity/preferences are more important
    const categoryBoost = ['identity', 'preferences'].includes(memory.category) ? 1.3
      : ['projects', 'work'].includes(memory.category) ? 1.1
      : 1.0

    // Final weighted score
    const finalScore = (
      entry.score * 0.5 +           // semantic relevance (50%)
      recencyScore * 0.25 +          // recency (25%)
      confidenceScore * 0.25         // confidence (25%)
    ) * categoryBoost

    finalScored.push({ text: (entry as any).text, score: finalScore })
  }

  // Sort by score descending and return top N
  return finalScored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => e.text)
}

/**
 * Format memories as a context block for the system prompt.
 */
export function formatMemoryContext(memories: string[]): string {
  if (memories.length === 0) return ''
  return [
    '\n\n## What I Remember About You',
    ...memories.map(m => `- ${m}`),
  ].join('\n')
}

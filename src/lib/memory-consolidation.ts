/**
 * Memory Consolidation — compresses and summarizes old memories
 * to keep the memory system efficient and relevant.
 */

import {
  getAllMemories,
  getMemoriesByCategory,
  deleteMemoriesByIds,
  updateMemory,
  createMemorySummary,
  getMemorySummaries,
  getMemoryCount,
  type Memory,
} from './db'

/* ------------------------------------------------------------------ */
/*  Stale memory detection                                             */
/* ------------------------------------------------------------------ */

const STALE_DAYS = 7
const HOUR = 3600000
const DAY = 86400000

/**
 * Find memories older than STALE_DAYS with low confidence.
 */
export function getStaleMemories(limit: number = 50): Memory[] {
  const allMemories = getAllMemories()
  const cutoff = Date.now() - STALE_DAYS * DAY

  return allMemories
    .filter(m => {
      const created = new Date(m.created_at + 'Z').getTime()
      return created < cutoff && m.confidence < 0.8
    })
    .slice(0, limit)
}

/**
 * Find memories that are duplicates or near-duplicates.
 */
export function findDuplicateMemories(): Memory[][] {
  const allMemories = getAllMemories()
  const groups: Map<string, Memory[]> = new Map()

  for (const memory of allMemories) {
    // Normalize key for grouping
    const normalizedKey = memory.key
      .toLowerCase()
      .replace(/[_\-\d]/g, '')
      .slice(0, 20)

    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, [])
    }
    groups.get(normalizedKey)!.push(memory)
  }

  // Return groups with 2+ members
  return Array.from(groups.values()).filter(g => g.length >= 2)
}

/* ------------------------------------------------------------------ */
/*  Memory grouping by category                                        */
/* ------------------------------------------------------------------ */

/**
 * Group memories by category for consolidation.
 */
export function groupMemoriesByCategory(): Map<string, Memory[]> {
  const categories = ['identity', 'location', 'work', 'preferences', 'projects', 'notes', 'tools', 'general']
  const groups = new Map<string, Memory[]>()

  for (const cat of categories) {
    const memories = getMemoriesByCategory(cat)
    if (memories.length > 0) {
      groups.set(cat, memories)
    }
  }

  return groups
}

/* ------------------------------------------------------------------ */
/*  Summarization                                                      */
/* ------------------------------------------------------------------ */

interface ConsolidationResult {
  category: string
  summary: string
  originalCount: number
  memoryIds: string[]
}

/**
 * Generate a summary from a group of related memories.
 * Uses simple heuristics (no LLM call needed for basic consolidation).
 */
function summarizeMemories(memories: Memory[]): string {
  if (memories.length === 0) return ''
  if (memories.length === 1) return `${memories[0].key}: ${memories[0].value}`

  // Group by key similarity
  const byKey = new Map<string, Memory[]>()
  for (const m of memories) {
    const key = m.key.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(m)
  }

  const parts: string[] = []
  for (const [key, group] of byKey) {
    if (group.length === 1) {
      parts.push(`${group[0].key}: ${group[0].value}`)
    } else {
      // Multiple values for same key — take the highest confidence one
      const best = group.sort((a, b) => b.confidence - a.confidence)[0]
      parts.push(`${best.key}: ${best.value} (confirmed ${group.length} times)`)
    }
  }

  return parts.join('; ')
}

/* ------------------------------------------------------------------ */
/*  Consolidation pipeline                                             */
/* ------------------------------------------------------------------ */

/**
 * Run memory consolidation.
 * Groups related memories, summarizes them, stores summaries, and cleans up.
 */
export function consolidateMemories(): {
  groupsConsolidated: number
  memoriesRemoved: number
  summariesCreated: number
  totalMemoriesBefore: number
  totalMemoriesAfter: number
} {
  const totalBefore = getMemoryCount()
  let memoriesRemoved = 0
  let summariesCreated = 0
  let groupsConsolidated = 0

  // 1. Handle duplicates — keep highest confidence, delete rest
  const duplicateGroups = findDuplicateMemories()
  for (const group of duplicateGroups) {
    const sorted = group.sort((a, b) => b.confidence - a.confidence)
    const keep = sorted[0]
    const toDelete = sorted.slice(1).map(m => m.id)

    if (toDelete.length > 0) {
      deleteMemoriesByIds(toDelete)
      memoriesRemoved += toDelete.length

      // Boost confidence of kept memory
      const newConfidence = Math.min(keep.confidence + 0.1 * toDelete.length, 1.0)
      updateMemory(keep.id, { confidence: newConfidence })
    }
  }

  // 2. Consolidate by category
  const categoryGroups = groupMemoriesByCategory()
  for (const [category, memories] of categoryGroups) {
    if (memories.length < 3) continue // Only consolidate groups with 3+ memories

    // Find old memories in this category
    const cutoff = Date.now() - STALE_DAYS * DAY
    const oldMemories = memories.filter(m => {
      const created = new Date(m.created_at + 'Z').getTime()
      return created < cutoff
    })

    if (oldMemories.length < 2) continue

    // Generate summary
    const summary = summarizeMemories(oldMemories)
    const memoryIds = oldMemories.map(m => m.id)

    // Store summary
    createMemorySummary(category, summary, memoryIds, oldMemories.length)
    summariesCreated++

    // Delete consolidated memories
    deleteMemoriesByIds(memoryIds)
    memoriesRemoved += memoryIds.length
    groupsConsolidated++
  }

  const totalAfter = getMemoryCount()

  return {
    groupsConsolidated,
    memoriesRemoved,
    summariesCreated,
    totalMemoriesBefore: totalBefore,
    totalMemoriesAfter: totalAfter,
  }
}

/**
 * Get consolidation status — should we consolidate now?
 */
export function shouldConsolidate(): { needed: boolean; reason: string; memoryCount: number } {
  const count = getMemoryCount()

  if (count > 500) {
    return { needed: true, reason: `Memory count (${count}) exceeds 500 threshold`, memoryCount: count }
  }

  const stale = getStaleMemories()
  if (stale.length > 20) {
    return { needed: true, reason: `${stale.length} stale memories found`, memoryCount: count }
  }

  const duplicates = findDuplicateMemories()
  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.length - 1, 0)
  if (totalDuplicates > 10) {
    return { needed: true, reason: `${totalDuplicates} duplicate memories found`, memoryCount: count }
  }

  return { needed: false, reason: 'Memory system is healthy', memoryCount: count }
}

/**
 * Get consolidation stats for the dashboard.
 */
export function getConsolidationStats(): {
  totalMemories: number
  staleCount: number
  duplicateGroups: number
  summariesCount: number
  lastConsolidation: string | null
} {
  const totalMemories = getMemoryCount()
  const staleCount = getStaleMemories().length
  const duplicateGroups = findDuplicateMemories().length
  const summaries = getMemorySummaries()
  const lastConsolidation = summaries.length > 0 ? summaries[0].created_at : null

  return {
    totalMemories,
    staleCount,
    duplicateGroups,
    summariesCount: summaries.length,
    lastConsolidation,
  }
}

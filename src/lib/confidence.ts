/**
 * Confidence Analyzer — assesses how confident Nero is in its responses.
 * Uses hedging language detection, web search usage, and memory context relevance.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConfidenceAssessment {
  level: ConfidenceLevel
  score: number // 0-1
  reasons: string[]
}

// Hedging phrases that indicate uncertainty
const HEDGING_PHRASES = [
  /\b(?:i think|i believe|i guess|i suppose|i assume|i reckon)\b/i,
  /\b(?:probably|perhaps|maybe|possibly|might be|could be|may be)\b/i,
  /\b(?:i'?m not (?:sure|certain|confident)|not entirely sure|hard to say)\b/i,
  /\b(?:it(?:'s| is) (?:likely|unlikely|possible|probable|uncertain))\b/i,
  /\b(?:generally|typically|usually|often|sometimes|in general)\b/i,
  /\b(?:i(?:'d| would) (?:guess|say|think|assume))\b/i,
  /\b(?:don'?t (?:really )?(?:know|have|recall)|no idea|unclear)\b/i,
  /\b(?:somewhat|sort of|kind of|in a way|to some extent)\b/i,
]

// Confidence-boosting phrases
const CONFIDENT_PHRASES = [
  /\b(?:definitely|certainly|absolutely|undoubtedly|clearly|obviously)\b/i,
  /\b(?:the (?:answer|correct|right) (?:is|is that|should))\b/i,
  /\b(?:according to|research (?:shows|indicates|suggests)|studies (?:show|indicate))\b/i,
  /\b(?:the (?:data|evidence|facts) (?:show|indicate|suggest|confirm))\b/i,
  /\b(?:this is (?:a fact|well-known|established|proven|documented))\b/i,
]

// Low-confidence topics (things that are inherently uncertain)
const UNCERTAIN_TOPICS = [
  /\b(?:future|prediction|forecast|will happen|going to happen)\b/i,
  /\b(?:opinion|feel(?:ing)?|thoughts?|perspective|viewpoint|stance)\b/i,
  /\b(?:best (?:way|approach|method|practice)|should (?:i|we|you))\b/i,
  /\b(?:meaning of life|purpose|philosophy|ethics|moral)\b/i,
]

/**
 * Analyze confidence of a response.
 */
export function analyzeConfidence(
  response: string,
  options: {
    usedWebSearch?: boolean
    usedMemory?: boolean
    memoryRelevance?: number // 0-1
    hasToolResults?: boolean
  } = {}
): ConfidenceAssessment {
  const reasons: string[] = []
  let score = 0.5 // baseline

  // 1. Check hedging language
  let hedgeCount = 0
  for (const pattern of HEDGING_PHRASES) {
    const matches = response.match(new RegExp(pattern.source, 'gi'))
    if (matches) hedgeCount += matches.length
  }

  if (hedgeCount === 0) {
    score += 0.1
    reasons.push('No hedging language detected')
  } else if (hedgeCount <= 2) {
    score -= 0.05
    reasons.push(`${hedgeCount} hedging phrases found`)
  } else {
    score -= 0.15
    reasons.push(`${hedgeCount} hedging phrases indicate uncertainty`)
  }

  // 2. Check confident language
  let confidentCount = 0
  for (const pattern of CONFIDENT_PHRASES) {
    const matches = response.match(new RegExp(pattern.source, 'gi'))
    if (matches) confidentCount += matches.length
  }

  if (confidentCount > 0) {
    score += Math.min(confidentCount * 0.05, 0.15)
    reasons.push(`${confidentCount} confident assertions found`)
  }

  // 3. Web search boost
  if (options.usedWebSearch) {
    score += 0.15
    reasons.push('Used real-time web search')
  }

  // 4. Tool results boost
  if (options.hasToolResults) {
    score += 0.1
    reasons.push('Used tool results for verification')
  }

  // 5. Memory context boost
  if (options.usedMemory && options.memoryRelevance && options.memoryRelevance > 0.5) {
    score += 0.1
    reasons.push('Relevant memory context available')
  }

  // 6. Check for uncertain topics
  for (const pattern of UNCERTAIN_TOPICS) {
    if (pattern.test(response)) {
      score -= 0.05
      reasons.push('Response touches on inherently uncertain topics')
      break
    }
  }

  // 7. Response length heuristic (very short responses might be less confident)
  if (response.length < 50) {
    score -= 0.05
    reasons.push('Very short response')
  } else if (response.length > 200) {
    score += 0.05
    reasons.push('Detailed response')
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score))

  // Determine level
  let level: ConfidenceLevel
  if (score >= 0.7) {
    level = 'high'
  } else if (score >= 0.4) {
    level = 'medium'
  } else {
    level = 'low'
  }

  return { level, score, reasons }
}

/**
 * Get confidence color for UI display.
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return '#22c55e'
    case 'medium': return '#f59e0b'
    case 'low': return '#ef4444'
  }
}

/**
 * Get confidence label for UI display.
 */
export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return 'High confidence'
    case 'medium': return 'Medium confidence'
    case 'low': return 'Low confidence — verify independently'
  }
}

/**
 * Format confidence as metadata for message storage.
 */
export function formatConfidenceMetadata(assessment: ConfidenceAssessment): Record<string, unknown> {
  return {
    confidence: assessment.level,
    confidenceScore: assessment.score,
    confidenceReasons: assessment.reasons,
  }
}

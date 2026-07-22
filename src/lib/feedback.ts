/**
 * Feedback processor — learns from user corrections and preferences.
 * Stores lessons as high-confidence memories and injects them into context.
 */

import { createMemory, searchMemories } from './db'

/* ------------------------------------------------------------------ */
/*  Feedback processing                                                */
/* ------------------------------------------------------------------ */

interface FeedbackLesson {
  category: string
  key: string
  value: string
  confidence: number
}

/**
 * Process user feedback into storable lessons.
 * Extracts actionable learning from corrections and preferences.
 */
export function processFeedback(
  feedbackType: string,
  feedbackContent: string,
  originalMessage: string
): FeedbackLesson[] {
  const lessons: FeedbackLesson[] = []

  if (feedbackType === 'correction' && feedbackContent) {
    // User corrected something — store the correction as a rule
    lessons.push({
      category: 'corrections',
      key: `correction_${Date.now()}`,
      value: `When asked about "${originalMessage.slice(0, 80)}", the correct answer is: ${feedbackContent.slice(0, 200)}`,
      confidence: 0.9,
    })
  }

  if (feedbackType === 'preference' && feedbackContent) {
    // User expressed a preference
    lessons.push({
      category: 'preferences',
      key: `pref_${Date.now()}`,
      value: feedbackContent.slice(0, 200),
      confidence: 0.8,
    })
  }

  if (feedbackType === 'complaint' && feedbackContent) {
    // User complained — store as a "don't do this" rule
    lessons.push({
      category: 'anti_patterns',
      key: `avoid_${Date.now()}`,
      value: `Avoid: ${feedbackContent.slice(0, 200)}`,
      confidence: 0.85,
    })
  }

  if (feedbackType === 'praise') {
    // Positive reinforcement — note what worked
    lessons.push({
      category: 'positive_patterns',
      key: `good_${Date.now()}`,
      value: `User appreciated response to: "${originalMessage.slice(0, 100)}"`,
      confidence: 0.7,
    })
  }

  return lessons
}

/**
 * Store feedback lessons as memories with high confidence.
 */
export function storeFeedbackLessons(lessons: FeedbackLesson[]): number {
  let stored = 0
  for (const lesson of lessons) {
    // Check for duplicate
    const existing = searchMemories(lesson.value.slice(0, 50), 5)
    const isDuplicate = existing.some(
      m => m.category === lesson.category && m.value.toLowerCase() === lesson.value.toLowerCase()
    )
    if (!isDuplicate) {
      createMemory(lesson.category, lesson.key, lesson.value)
      stored++
    }
  }
  return stored
}

/**
 * Get relevant corrections for a user message.
 * Returns corrections that match the current topic.
 */
export function getRelevantCorrections(message: string, limit: number = 3): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)

  const corrections: string[] = []

  // Search for matching corrections
  for (const word of words.slice(0, 5)) {
    const memories = searchMemories(word, 5)
    for (const m of memories) {
      if (m.category === 'corrections' && !corrections.includes(m.value)) {
        corrections.push(m.value)
      }
      if (m.category === 'anti_patterns' && !corrections.includes(m.value)) {
        corrections.push(m.value)
      }
    }
  }

  return corrections.slice(0, limit)
}

/**
 * Format corrections as context for the system prompt.
 */
export function formatCorrectionContext(corrections: string[]): string {
  if (corrections.length === 0) return ''
  return [
    '\n\n## Lessons from Past Feedback',
    'The user has previously corrected you on these points:',
    ...corrections.map(c => `- ${c}`),
    'Use this to avoid repeating past mistakes.',
  ].join('\n')
}

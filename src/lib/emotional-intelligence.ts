/**
 * Emotional Intelligence Engine — analyzes emotional patterns over time,
 * detects mood shifts, and generates proactive suggestions.
 */

import { getEmotionalHistory, getMoodStats, type EmotionalState } from './db'

/* ------------------------------------------------------------------ */
/*  Emotional trend analysis                                           */
/* ------------------------------------------------------------------ */

export interface EmotionalTrend {
  period: string // 'day' | 'week' | 'month'
  dominantMood: string
  avgSentiment: number
  moodDistribution: Record<string, number>
  totalEntries: number
  sentimentTrend: 'improving' | 'stable' | 'declining'
}

/**
 * Analyze emotional trends over a time period.
 */
export function getEmotionalTrends(days: number = 7): EmotionalTrend {
  const history = getEmotionalHistory(500)
  const cutoff = Date.now() - days * 86400000

  const recentEntries = history.filter(e => {
    const created = new Date(e.created_at + 'Z').getTime()
    return created > cutoff
  })

  if (recentEntries.length === 0) {
    return {
      period: days <= 1 ? 'day' : days <= 7 ? 'week' : 'month',
      dominantMood: 'neutral',
      avgSentiment: 0,
      moodDistribution: {},
      totalEntries: 0,
      sentimentTrend: 'stable',
    }
  }

  // Calculate mood distribution
  const moodCounts: Record<string, number> = {}
  let totalSentiment = 0

  for (const entry of recentEntries) {
    moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1
    totalSentiment += entry.sentiment
  }

  // Find dominant mood
  const dominantMood = Object.entries(moodCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'

  const avgSentiment = totalSentiment / recentEntries.length

  // Calculate sentiment trend (compare first half vs second half)
  const midpoint = Math.floor(recentEntries.length / 2)
  const firstHalf = recentEntries.slice(0, midpoint)
  const secondHalf = recentEntries.slice(midpoint)

  const firstAvg = firstHalf.reduce((sum, e) => sum + e.sentiment, 0) / Math.max(firstHalf.length, 1)
  const secondAvg = secondHalf.reduce((sum, e) => sum + e.sentiment, 0) / Math.max(secondHalf.length, 1)

  const diff = secondAvg - firstAvg
  const sentimentTrend: EmotionalTrend['sentimentTrend'] =
    diff > 0.1 ? 'improving' : diff < -0.1 ? 'declining' : 'stable'

  return {
    period: days <= 1 ? 'day' : days <= 7 ? 'week' : 'month',
    dominantMood,
    avgSentiment: Math.round(avgSentiment * 100) / 100,
    moodDistribution: moodCounts,
    totalEntries: recentEntries.length,
    sentimentTrend,
  }
}

/* ------------------------------------------------------------------ */
/*  Mood shift detection                                               */
/* ------------------------------------------------------------------ */

export interface MoodShift {
  detected: boolean
  from?: string
  to?: string
  severity?: 'mild' | 'moderate' | 'strong'
  message?: string
}

/**
 * Detect sudden mood shifts from the user's baseline.
 */
export function detectMoodShift(): MoodShift {
  const history = getEmotionalHistory(20)

  if (history.length < 5) {
    return { detected: false }
  }

  // Calculate baseline (older entries)
  const baseline = history.slice(5)
  const recent = history.slice(0, 5)

  const baselineMood = getMostCommonMood(baseline)
  const recentMood = getMostCommonMood(recent)

  if (baselineMood === recentMood) {
    return { detected: false }
  }

  // Calculate severity based on sentiment difference
  const baselineSentiment = baseline.reduce((sum, e) => sum + e.sentiment, 0) / baseline.length
  const recentSentiment = recent.reduce((sum, e) => sum + e.sentiment, 0) / recent.length
  const sentimentDiff = Math.abs(recentSentiment - baselineSentiment)

  let severity: MoodShift['severity']
  if (sentimentDiff > 0.5) {
    severity = 'strong'
  } else if (sentimentDiff > 0.3) {
    severity = 'moderate'
  } else {
    severity = 'mild'
  }

  const shiftMessages: Record<string, string> = {
    'happy->sad': 'You seem to be feeling down compared to earlier. Would you like to talk about it?',
    'sad->happy': 'Your mood seems to have improved! That\'s great to see.',
    'calm->frustrated': 'I sense some frustration. Want me to help with whatever\'s bothering you?',
    'frustrated->calm': 'You seem more relaxed now. Glad things are looking better.',
    'focused->anxious': 'You seem a bit anxious. Take a deep breath — we\'ll work through this.',
    'excited->sad': 'Your energy seems lower than before. Everything okay?',
  }

  const shiftKey = `${baselineMood}->${recentMood}`
  const message = shiftMessages[shiftKey] || `I notice your mood shifted from ${baselineMood} to ${recentMood}.`

  return {
    detected: true,
    from: baselineMood,
    to: recentMood,
    severity,
    message,
  }
}

function getMostCommonMood(states: EmotionalState[]): string {
  const counts: Record<string, number> = {}
  for (const s of states) {
    counts[s.mood] = (counts[s.mood] || 0) + 1
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'
}

/* ------------------------------------------------------------------ */
/*  Emotional insights                                                 */
/* ------------------------------------------------------------------ */

export interface EmotionalInsight {
  type: 'pattern' | 'trend' | 'suggestion'
  message: string
  data?: Record<string, unknown>
}

/**
 * Generate emotional insights from history.
 */
export function getEmotionalInsights(): EmotionalInsight[] {
  const insights: EmotionalInsight[] = []
  const weekTrend = getEmotionalTrends(7)
  const monthTrend = getEmotionalTrends(30)

  // Pattern: dominant mood
  if (weekTrend.totalEntries > 5) {
    insights.push({
      type: 'pattern',
      message: `Your dominant mood this week has been ${weekTrend.dominantMood}.`,
      data: { mood: weekTrend.dominantMood, count: weekTrend.moodDistribution[weekTrend.dominantMood] },
    })
  }

  // Trend: sentiment direction
  if (weekTrend.sentimentTrend === 'improving') {
    insights.push({
      type: 'trend',
      message: 'Your overall mood has been improving this week. Keep it up!',
    })
  } else if (weekTrend.sentimentTrend === 'declining') {
    insights.push({
      type: 'trend',
      message: 'Your mood seems to be declining. Consider taking a break or doing something you enjoy.',
    })
  }

  // Pattern: mood variability
  const uniqueMoods = Object.keys(weekTrend.moodDistribution).length
  if (uniqueMoods >= 4) {
    insights.push({
      type: 'pattern',
      message: 'Your emotions have been quite varied this week. This is normal — emotions naturally fluctuate.',
    })
  }

  // Suggestion based on dominant mood
  if (weekTrend.dominantMood === 'anxious' || weekTrend.dominantMood === 'frustrated') {
    insights.push({
      type: 'suggestion',
      message: 'You\'ve been feeling stressed lately. Consider: taking short breaks, deep breathing, or a quick walk.',
    })
  } else if (weekTrend.dominantMood === 'sad') {
    insights.push({
      type: 'suggestion',
      message: 'It seems like you\'ve been feeling down. Remember: it\'s okay to not feel okay. Would you like to chat about it?',
    })
  } else if (weekTrend.dominantMood === 'happy' || weekTrend.dominantMood === 'excited') {
    insights.push({
      type: 'suggestion',
      message: 'You\'ve been in great spirits! This is a good time to tackle challenging tasks.',
    })
  }

  return insights
}

/* ------------------------------------------------------------------ */
/*  Mood-based suggestions                                             */
/* ------------------------------------------------------------------ */

export interface MoodSuggestion {
  mood: string
  suggestions: string[]
}

const MOOD_SUGGESTIONS: MoodSuggestion[] = [
  {
    mood: 'frustrated',
    suggestions: [
      'Take a step back and look at the problem from a different angle',
      'Break the problem into smaller, manageable pieces',
      'Take a short walk to clear your head',
      'Sometimes the best solution is to sleep on it',
    ],
  },
  {
    mood: 'anxious',
    suggestions: [
      'Ground yourself: name 5 things you can see, 4 you can touch, 3 you hear',
      'Write down your worries — they often look smaller on paper',
      'Do a quick body scan meditation',
      'Talk to someone you trust',
    ],
  },
  {
    mood: 'sad',
    suggestions: [
      'It\'s okay to feel this way. Be gentle with yourself',
      'Do something small that usually brings you joy',
      'Reach out to a friend or loved one',
      'Watch something that makes you laugh',
    ],
  },
  {
    mood: 'happy',
    suggestions: [
      'Great energy! Perfect time for creative work',
      'Share your good mood with someone',
      'Tackle that challenging task you\'ve been putting off',
      'Capture this feeling — write down what made you happy',
    ],
  },
  {
    mood: 'excited',
    suggestions: [
      'Channel this energy into something productive!',
      'Write down your ideas before they slip away',
      'This is a great time to brainstorm or plan',
      'Share your excitement with others',
    ],
  },
]

/**
 * Get suggestions based on current mood.
 */
export function getMoodSuggestions(mood: string): string[] {
  const moodSuggestion = MOOD_SUGGESTIONS.find(ms => ms.mood === mood)
  return moodSuggestion?.suggestions || []
}

/**
 * Get emotional context for the system prompt.
 */
export function getEmotionalContext(): string {
  const shift = detectMoodShift()
  const insights = getEmotionalInsights()
  const parts: string[] = []

  if (shift.detected && shift.message) {
    parts.push(`Mood shift detected: ${shift.message}`)
  }

  const recentInsights = insights.filter(i => i.type === 'pattern').slice(0, 2)
  for (const insight of recentInsights) {
    parts.push(insight.message)
  }

  if (parts.length === 0) return ''

  return `\n\n## Emotional Context\n${parts.map(p => `- ${p}`).join('\n')}\n\nBe aware of the user's emotional state and respond accordingly.`
}

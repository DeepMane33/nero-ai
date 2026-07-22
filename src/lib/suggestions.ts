/**
 * Proactive Suggestions Engine — anticipates user needs and generates
 * helpful suggestions based on time, mood, patterns, and context.
 */

import { getConversations, getLatestEmotionalState, getMoodStats, getAllMemories } from './db'
import { getEmotionalTrends, detectMoodShift } from './emotional-intelligence'

/* ------------------------------------------------------------------ */
/*  Suggestion types                                                   */
/* ------------------------------------------------------------------ */

export interface Suggestion {
  id: string
  type: 'mood' | 'time' | 'project' | 'learning' | 'memory' | 'general'
  title: string
  description: string
  action?: string // suggested action/command
  priority: number // 1-5, higher = more important
  icon: string
}

/* ------------------------------------------------------------------ */
/*  Suggestion generation                                              */
/* ------------------------------------------------------------------ */

/**
 * Generate proactive suggestions based on current context.
 */
export function generateSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = []
  const now = new Date()
  const hour = now.getHours()

  // Time-based suggestions
  suggestions.push(...getTimeBasedSuggestions(hour))

  // Mood-based suggestions
  suggestions.push(...getMoodBasedSuggestions())

  // Project-based suggestions
  suggestions.push(...getProjectSuggestions())

  // Memory-based suggestions
  suggestions.push(...getMemorySuggestions())

  // Sort by priority and return top suggestions
  return suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
}

/* ------------------------------------------------------------------ */
/*  Time-based suggestions                                             */
/* ------------------------------------------------------------------ */

function getTimeBasedSuggestions(hour: number): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (hour >= 6 && hour < 9) {
    suggestions.push({
      id: 'morning-briefing',
      type: 'time',
      title: 'Good Morning!',
      description: 'Start your day with a quick briefing. I can show you today\'s news, weather, and your tasks.',
      action: '/briefing',
      priority: 3,
      icon: '🌅',
    })
  }

  if (hour >= 12 && hour < 14) {
    suggestions.push({
      id: 'lunch-break',
      type: 'time',
      title: 'Lunch Break',
      description: 'Taking a break? I can suggest something fun or help you plan your afternoon.',
      priority: 2,
      icon: '🍽️',
    })
  }

  if (hour >= 17 && hour < 19) {
    suggestions.push({
      id: 'eod-review',
      type: 'time',
      title: 'End of Day',
      description: 'Wrap up your day. Want me to summarize what you accomplished?',
      priority: 2,
      icon: '📋',
    })
  }

  if (hour >= 22 || hour < 6) {
    suggestions.push({
      id: 'late-night',
      type: 'time',
      title: 'Late Night',
      description: 'Working late? Remember to take breaks and stay hydrated.',
      priority: 1,
      icon: '🌙',
    })
  }

  return suggestions
}

/* ------------------------------------------------------------------ */
/*  Mood-based suggestions                                             */
/* ------------------------------------------------------------------ */

function getMoodBasedSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = []

  try {
    const shift = detectMoodShift()
    if (shift.detected && shift.severity !== 'mild') {
      suggestions.push({
        id: 'mood-shift',
        type: 'mood',
        title: 'Mood Check',
        description: shift.message || `I noticed your mood shifted from ${shift.from} to ${shift.to}.`,
        priority: 4,
        icon: '💙',
      })
    }

    const latest = getLatestEmotionalState()
    if (latest) {
      const moodSuggestions: Record<string, Partial<Suggestion>> = {
        stressed: {
          title: 'Feeling Stressed?',
          description: 'Try a quick breathing exercise or take a short break.',
          action: 'Tell me to guide you through a breathing exercise',
          icon: '🧘',
        },
        anxious: {
          title: 'Anxiety Support',
          description: 'Let\'s ground ourselves. Want to try a quick grounding exercise?',
          icon: '🌿',
        },
        sad: {
          title: 'Feeling Down',
          description: 'It\'s okay to feel this way. Want to talk about it or try something uplifting?',
          icon: '💜',
        },
        frustrated: {
          title: 'Frustrated?',
          description: 'Sometimes stepping back helps. Want to take a break or talk through the problem?',
          icon: '🔄',
        },
        happy: {
          title: 'Great Mood!',
          description: 'You\'re in a great state of mind. Perfect time for creative work or tackling challenges!',
          icon: '✨',
          priority: 2,
        },
        excited: {
          title: 'Excited Energy!',
          description: 'Channel this energy! Want to brainstorm ideas or start something new?',
          icon: '🚀',
          priority: 2,
        },
      }

      const suggestion = moodSuggestions[latest.mood]
      if (suggestion) {
        suggestions.push({
          id: `mood-${latest.mood}`,
          type: 'mood',
          priority: 3,
          icon: '😊',
          title: suggestion.title || '',
          description: suggestion.description || '',
          action: suggestion.action,
        })
      }
    }
  } catch {
    // Silently fail if emotional data unavailable
  }

  return suggestions
}

/* ------------------------------------------------------------------ */
/*  Project-based suggestions                                          */
/* ------------------------------------------------------------------ */

function getProjectSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = []

  try {
    const conversations = getConversations().slice(0, 10)

    // Suggest continuing recent conversations
    if (conversations.length > 0) {
      const recent = conversations[0]
      const hoursSinceUpdate = (Date.now() - new Date(recent.updated_at + 'Z').getTime()) / 3600000

      if (hoursSinceUpdate > 24 && hoursSinceUpdate < 168) {
        suggestions.push({
          id: 'continue-chat',
          type: 'project',
          title: 'Continue Conversation',
          description: `You haven't continued "${recent.title}" in a while. Want to pick up where you left off?`,
          priority: 2,
          icon: '💬',
        })
      }
    }
  } catch {
    // Silently fail
  }

  return suggestions
}

/* ------------------------------------------------------------------ */
/*  Memory-based suggestions                                           */
/* ------------------------------------------------------------------ */

function getMemorySuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = []

  try {
    const memories = getAllMemories().slice(0, 50)

    // Suggest reviewing old memories
    const oldMemories = memories.filter(m => {
      const created = new Date(m.created_at + 'Z').getTime()
      return Date.now() - created > 7 * 86400000
    })

    if (oldMemories.length > 10) {
      suggestions.push({
        id: 'review-memories',
        type: 'memory',
        title: 'Memory Cleanup',
        description: `You have ${oldMemories.length} old memories. Want me to consolidate and organize them?`,
        action: 'Consolidate my memories',
        priority: 1,
        icon: '🧠',
      })
    }

    // Suggest adding missing info
    const hasIdentity = memories.some(m => m.category === 'identity')
    const hasLocation = memories.some(m => m.category === 'location')

    if (!hasIdentity) {
      suggestions.push({
        id: 'add-identity',
        type: 'memory',
        title: 'Tell Me About Yourself',
        description: 'I\'d love to know more about you. What should I call you?',
        action: 'My name is...',
        priority: 2,
        icon: '👋',
      })
    }

    if (!hasLocation) {
      suggestions.push({
        id: 'add-location',
        type: 'memory',
        title: 'Where Are You?',
        description: 'Knowing your location helps me provide weather and local information.',
        action: 'I live in...',
        priority: 1,
        icon: '📍',
      })
    }
  } catch {
    // Silently fail
  }

  return suggestions
}

/* ------------------------------------------------------------------ */
/*  Suggestion formatting                                              */
/* ------------------------------------------------------------------ */

/**
 * Format suggestions for display in the notification center.
 */
export function formatSuggestionsForDisplay(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) return ''

  return suggestions
    .map(s => `${s.icon} **${s.title}**: ${s.description}`)
    .join('\n\n')
}

/**
 * Get greeting-based suggestions for the dashboard.
 */
export function getDashboardSuggestions(): Suggestion[] {
  const now = new Date()
  const hour = now.getHours()

  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  return [
    {
      id: 'start-chat',
      type: 'general' as const,
      title: `${greeting}!`,
      description: 'What would you like to explore today?',
      priority: 5,
      icon: '💬',
    },
    ...getTimeBasedSuggestions(hour).slice(0, 2),
  ]
}

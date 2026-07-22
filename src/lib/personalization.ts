/**
 * Personalization Engine — learns communication style and preferences
 * to adapt Nero's responses to each user.
 */

import { getAllMemories, setPreference, getPreference, getAllPreferences, type UserPreference } from './db'

/* ------------------------------------------------------------------ */
/*  Communication style analysis                                       */
/* ------------------------------------------------------------------ */

export interface CommunicationStyle {
  preferredLength: 'concise' | 'balanced' | 'detailed'
  formality: 'casual' | 'balanced' | 'formal'
  technicalLevel: 'beginner' | 'intermediate' | 'advanced'
  topics: string[]
}

/**
 * Analyze a user's communication style from their messages.
 */
export function analyzeCommunicationStyle(messages: string[]): CommunicationStyle {
  if (messages.length === 0) {
    return {
      preferredLength: 'balanced',
      formality: 'balanced',
      technicalLevel: 'intermediate',
      topics: [],
    }
  }

  const allText = messages.join(' ').toLowerCase()
  const avgLength = messages.reduce((sum, m) => sum + m.length, 0) / messages.length

  // Length preference
  let preferredLength: CommunicationStyle['preferredLength']
  if (avgLength < 30) {
    preferredLength = 'concise'
  } else if (avgLength > 100) {
    preferredLength = 'detailed'
  } else {
    preferredLength = 'balanced'
  }

  // Formality
  const casualMarkers = /\b(gonna|wanna|hey|yo|lol|haha|omg|btw|imo|tbh|ngl|fr|slang)\b/i
  const formalMarkers = /\b(therefore|furthermore|additionally|consequently|regarding|pursuant|kindly)\b/i
  const casualCount = (allText.match(casualMarkers) || []).length
  const formalCount = (allText.match(formalMarkers) || []).length

  let formality: CommunicationStyle['formality']
  if (casualCount > formalCount * 2) {
    formality = 'casual'
  } else if (formalCount > casualCount * 2) {
    formality = 'formal'
  } else {
    formality = 'balanced'
  }

  // Technical level
  const technicalTerms = /\b(api|regex|sql|database|algorithm|function|variable|compiler|kernel|debugging|refactoring|deployment|microservice)\b/i
  const beginnerTerms = /\b(how do i|what is|explain|eli5|beginner|start|learn|basic|simple)\b/i
  const technicalCount = (allText.match(technicalTerms) || []).length
  const beginnerCount = (allText.match(beginnerTerms) || []).length

  let technicalLevel: CommunicationStyle['technicalLevel']
  if (beginnerCount > technicalCount) {
    technicalLevel = 'beginner'
  } else if (technicalCount > 3) {
    technicalLevel = 'advanced'
  } else {
    technicalLevel = 'intermediate'
  }

  // Extract topics of interest
  const topics = extractTopics(allText)

  return { preferredLength, formality, technicalLevel, topics }
}

/**
 * Extract topics of interest from text.
 */
function extractTopics(text: string): string[] {
  const topicPatterns: [RegExp, string][] = [
    [/\b(python|javascript|typescript|rust|go|java|c\+\+)\b/i, 'programming'],
    [/\b(react|vue|angular|next\.?js|svelte)\b/i, 'frontend'],
    [/\b(node|deno|bun|express|django|flask|fastapi)\b/i, 'backend'],
    [/\b(docker|kubernetes|aws|azure|gcp)\b/i, 'devops'],
    [/\b(machine learning|deep learning|ai|neural network)\b/i, 'ai'],
    [/\b(security|encryption|oauth|jwt)\b/i, 'security'],
    [/\b(design|ui|ux|figma|css|tailwind)\b/i, 'design'],
    [/\b(data|analytics|visualization|chart|graph)\b/i, 'data'],
    [/\b(music|song|playlist|album)\b/i, 'music'],
    [/\b(game|gaming|play|steam|xbox|playstation)\b/i, 'gaming'],
    [/\b(movie|film|series|netflix|anime)\b/i, 'entertainment'],
    [/\b(cook|recipe|food|meal|restaurant)\b/i, 'food'],
    [/\b(exercise|workout|gym|fitness|health)\b/i, 'fitness'],
    [/\b(read|book|novel|story|write)\b/i, 'reading'],
    [/\b(travel|trip|vacation|flight|hotel)\b/i, 'travel'],
    [/\b(finance|invest|stock|crypto|money)\b/i, 'finance'],
  ]

  const foundTopics: string[] = []
  for (const [pattern, topic] of topicPatterns) {
    if (pattern.test(text) && !foundTopics.includes(topic)) {
      foundTopics.push(topic)
    }
  }

  return foundTopics.slice(0, 5)
}

/* ------------------------------------------------------------------ */
/*  Preference management                                              */
/* ------------------------------------------------------------------ */

/**
 * Auto-detect and store preferences from conversation.
 */
export function autoDetectPreferences(messages: string[]): number {
  let stored = 0
  const style = analyzeCommunicationStyle(messages)

  // Store style preferences
  const stylePrefs = [
    { key: 'response_length', value: style.preferredLength, confidence: 0.6 },
    { key: 'formality', value: style.formality, confidence: 0.6 },
    { key: 'technical_level', value: style.technicalLevel, confidence: 0.6 },
  ]

  for (const pref of stylePrefs) {
    const existing = getPreference(pref.key)
    if (!existing || existing.confidence < pref.confidence) {
      setPreference(pref.key, pref.value, pref.confidence, 'auto_detected')
      stored++
    }
  }

  // Store topic preferences
  if (style.topics.length > 0) {
    setPreference('topics_of_interest', JSON.stringify(style.topics), 0.5, 'auto_detected')
    stored++
  }

  return stored
}

/**
 * Get personalization context for the system prompt.
 */
export function getPersonalizationContext(): string {
  const prefs = getAllPreferences()
  if (prefs.length === 0) return ''

  const parts: string[] = []

  for (const pref of prefs) {
    switch (pref.key) {
      case 'response_length':
        parts.push(`User prefers ${pref.value} responses`)
        break
      case 'formality':
        parts.push(`Communication style: ${pref.value}`)
        break
      case 'technical_level':
        parts.push(`Technical level: ${pref.value}`)
        break
      case 'topics_of_interest':
        try {
          const topics = JSON.parse(pref.value)
          if (topics.length > 0) {
            parts.push(`Interests: ${topics.join(', ')}`)
          }
        } catch {}
        break
    }
  }

  if (parts.length === 0) return ''

  return `\n\n## User Profile\n${parts.map(p => `- ${p}`).join('\n')}\n\nAdapt your responses to match this user's style and preferences.`
}

/**
 * Get all learned preferences for display.
 */
export function getLearnedPreferences(): UserPreference[] {
  return getAllPreferences()
}

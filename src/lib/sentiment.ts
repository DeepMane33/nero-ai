/**
 * Nero AI — Sentiment & Emotion Analysis Engine
 * Analyzes text to detect mood, sentiment, valence, and arousal.
 * Maps to emotional states for the mood-aware AI core.
 */

export type Mood = 'happy' | 'excited' | 'calm' | 'focused' | 'neutral' | 'anxious' | 'frustrated' | 'sad'

export interface EmotionalAnalysis {
  mood: Mood
  sentiment: number      // -1 (negative) to +1 (positive)
  valence: number        // -1 (unpleasant) to +1 (pleasant)
  arousal: number        // 0 (low energy) to 1 (high energy)
  dominantEmotion: string
  emoji: string
}

// ── Word banks for sentiment analysis ──

const POSITIVE_WORDS = new Set([
  'happy', 'glad', 'great', 'awesome', 'excellent', 'amazing', 'wonderful', 'fantastic',
  'love', 'like', 'enjoy', 'fun', 'beautiful', 'perfect', 'brilliant', 'nice', 'good',
  'thank', 'thanks', 'appreciate', 'grateful', 'excited', 'thrilled', 'delighted',
  'cool', 'sweet', 'epic', 'incredible', 'outstanding', 'superb', 'fabulous',
  'yay', 'yes', 'absolutely', 'definitely', 'sure', 'certainly', 'of course',
  'please', 'kind', 'helpful', 'useful', 'impressive', 'remarkable', 'proud',
  'celebrate', 'celebrating', 'win', 'won', 'success', 'succeed', 'achieve',
  'progress', 'improve', 'better', 'best', 'solve', 'solved', 'fixed', 'works',
  'ready', 'let\'s', 'go', 'start', 'begin', 'yes', 'yeah', 'yep'
])

const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'annoyed',
  'frustrated', 'disappointed', 'upset', 'worried', 'anxious', 'nervous', 'scared',
  'afraid', 'confused', 'lost', 'stuck', 'broken', 'error', 'fail', 'failed',
  'wrong', 'problem', 'issue', 'bug', 'crash', 'slow', 'difficult', 'hard',
  'impossible', 'can\'t', 'cannot', 'won\'t', 'don\'t', 'doesn\'t', 'never',
  'nothing', 'nobody', 'nowhere', 'unfortunately', 'sadly', 'sorry', 'apologize',
  'regret', 'miss', 'missing', 'lost', 'lose', 'losing', 'dead', 'die', 'kill',
  'hurt', 'pain', 'suffer', 'struggle', 'mess', 'disaster', 'catastrophe',
  'ugh', 'sigh', 'damn', 'hell', 'crap', 'shit', 'fuck', 'wtf', 'omg'
])

const EXCITED_WORDS = new Set([
  'wow', 'amazing', 'incredible', 'unbelievable', 'insane', 'epic', 'awesome',
  'exciting', 'thrilled', 'pumped', 'hyped', 'stoked', 'fire', 'lit', 'goat',
  'let\'s go', 'hell yes', 'absolutely', 'definitely', 'can\'t wait', 'so cool'
])

const ANXIOUS_WORDS = new Set([
  'worried', 'anxious', 'nervous', 'scared', 'afraid', 'panic', 'stress',
  'stressed', 'overwhelmed', 'deadline', 'urgent', 'asap', 'hurry', 'rushing',
  'concerned', 'uneasy', 'tense', 'pressure', 'struggling', 'difficult'
])

const FOCUSED_WORDS = new Set([
  'focus', 'analyze', 'think', 'consider', 'implement', 'build', 'create',
  'develop', 'design', 'plan', 'organize', 'structure', 'optimize', 'improve',
  'refactor', 'debug', 'investigate', 'research', 'study', 'learn', 'understand'
])

// ── Emoji mapping ──

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊',
  excited: '🤩',
  calm: '😌',
  focused: '🧠',
  neutral: '😐',
  anxious: '😰',
  frustrated: '😤',
  sad: '😢',
}

// ── Analysis function ──

export function analyzeSentiment(text: string): EmotionalAnalysis {
  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)

  let positiveScore = 0
  let negativeScore = 0
  let excitedScore = 0
  let anxiousScore = 0
  let focusedScore = 0

  for (const word of words) {
    const clean = word.replace(/[^a-z']/g, '')
    if (POSITIVE_WORDS.has(clean)) positiveScore++
    if (NEGATIVE_WORDS.has(clean)) negativeScore++
    if (EXCITED_WORDS.has(clean)) excitedScore++
    if (ANXIOUS_WORDS.has(clean)) anxiousScore++
    if (FOCUSED_WORDS.has(clean)) focusedScore++
  }

  // Check for exclamation marks (excitement)
  const exclamationCount = (text.match(/!/g) || []).length
  if (exclamationCount >= 2) excitedScore += exclamationCount * 0.3

  // Check for question marks (engagement/uncertainty)
  const questionCount = (text.match(/\?/g) || []).length
  if (questionCount >= 2) anxiousScore += questionCount * 0.2

  // Check for caps (intensity)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1)
  if (capsRatio > 0.3) excitedScore += capsRatio * 2

  // Check for ellipsis (hesitation/sadness)
  if (text.includes('...')) negativeScore += 0.3

  // Calculate composite scores
  const totalWords = Math.max(words.length, 1)
  const sentiment = ((positiveScore - negativeScore) / totalWords) * 3
  const clampedSentiment = Math.max(-1, Math.min(1, sentiment))

  // Valence (pleasantness): positive vs negative
  const valence = clampedSentiment

  // Arousal (energy): excited vs calm
  const arousalRaw = (excitedScore + anxiousScore - focusedScore * 0.3) / totalWords
  const arousal = Math.max(0, Math.min(1, arousalRaw * 4 + 0.3))

  // Determine dominant mood
  let mood: Mood = 'neutral'
  let dominantEmotion = 'neutral'

  if (excitedScore > 1 && clampedSentiment > 0) {
    mood = 'excited'
    dominantEmotion = 'excitement'
  } else if (positiveScore > negativeScore && clampedSentiment > 0.15) {
    mood = 'happy'
    dominantEmotion = 'joy'
  } else if (anxiousScore > 1) {
    mood = 'anxious'
    dominantEmotion = 'anxiety'
  } else if (negativeScore > positiveScore && clampedSentiment < -0.15) {
    if (frustrationIndicators(lower)) {
      mood = 'frustrated'
      dominantEmotion = 'frustration'
    } else {
      mood = 'sad'
      dominantEmotion = 'sadness'
    }
  } else if (focusedScore > 1) {
    mood = 'focused'
    dominantEmotion = 'concentration'
  } else if (arousal < 0.3 && Math.abs(clampedSentiment) < 0.15) {
    mood = 'calm'
    dominantEmotion = 'calmness'
  }

  return {
    mood,
    sentiment: Math.round(clampedSentiment * 100) / 100,
    valence: Math.round(valence * 100) / 100,
    arousal: Math.round(arousal * 100) / 100,
    dominantEmotion,
    emoji: MOOD_EMOJI[mood],
  }
}

function frustrationIndicators(text: string): boolean {
  const patterns = [
    /\bwhy\b.*\bnot\b/,
    /\bdoesn'?t\b.*\bwork/,
    /\bkeeps?\b.*\bfail/,
    /\bcan'?t\b.*\bget/,
    /\btried\b.*\beverything/,
    /\bnothing\b.*\bworks/,
    /\bsame\b.*\berror/,
    /\bagain\b/,
    /\bstill\b.*\bnot\b/,
  ]
  return patterns.some(p => p.test(text))
}

// ── Mood to color mapping for UI ──

export const MOOD_COLORS: Record<Mood, { primary: string; glow: string; bg: string }> = {
  happy:     { primary: '#8898b8', glow: 'rgba(136, 152, 184, 0.3)', bg: 'rgba(136, 152, 184, 0.04)' },
  excited:   { primary: '#a0b8d0', glow: 'rgba(160, 184, 208, 0.4)', bg: 'rgba(160, 184, 208, 0.05)' },
  calm:      { primary: '#7eddd6', glow: 'rgba(126, 221, 214, 0.2)', bg: 'rgba(126, 221, 214, 0.03)' },
  focused:   { primary: '#b0b8c4', glow: 'rgba(176, 184, 196, 0.3)', bg: 'rgba(176, 184, 196, 0.04)' },
  neutral:   { primary: '#8892a0', glow: 'rgba(136, 146, 160, 0.15)', bg: 'rgba(136, 146, 160, 0.02)' },
  anxious:   { primary: '#8898b8', glow: 'rgba(136, 152, 184, 0.3)', bg: 'rgba(136, 152, 184, 0.04)' },
  frustrated:{ primary: '#d06070', glow: 'rgba(208, 96, 112, 0.35)', bg: 'rgba(208, 96, 112, 0.05)' },
  sad:       { primary: '#8a7ea0', glow: 'rgba(138, 126, 160, 0.3)', bg: 'rgba(138, 126, 160, 0.04)' },
}

export const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Happy',
  excited: 'Excited',
  calm: 'Calm',
  focused: 'Focused',
  neutral: 'Neutral',
  anxious: 'Anxious',
  frustrated: 'Frustrated',
  sad: 'Sad',
}

// ── Blend two moods for smooth transitions ──

export function blendMoods(current: Mood, target: Mood, factor: number = 0.3): Mood {
  if (current === target) return current
  // Simple: if factor > 0.5, switch to target, else keep current
  return factor > 0.5 ? target : current
}

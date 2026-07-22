/**
 * /api/mood — Emotional state tracking API
 * GET: Retrieve current mood and history
 * POST: Store new emotional state
 */

import { NextRequest } from 'next/server'
import {
  createEmotionalState,
  getLatestEmotionalState,
  getEmotionalHistory,
  getMoodStats,
} from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId') || undefined
    const historyLimit = parseInt(searchParams.get('limit') || '30')

    const current = getLatestEmotionalState(conversationId)
    const history = getEmotionalHistory(historyLimit, conversationId)
    const stats = getMoodStats(conversationId)

    return Response.json({ current, history, stats })
  } catch (err: any) {
    console.error('[mood] GET error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mood, sentiment, valence, arousal, dominantEmotion, emoji, context, conversationId, messageId } = body

    if (!mood || sentiment === undefined) {
      return Response.json({ error: 'mood and sentiment are required' }, { status: 400 })
    }

    const state = createEmotionalState(
      mood,
      sentiment,
      valence ?? 0,
      arousal ?? 0.5,
      dominantEmotion ?? mood,
      emoji ?? '😐',
      context ?? '',
      conversationId,
      messageId
    )

    return Response.json({ state })
  } catch (err: any) {
    console.error('[mood] POST error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

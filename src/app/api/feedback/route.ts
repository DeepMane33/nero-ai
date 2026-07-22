import { createFeedback, getRecentFeedback, getFeedbackStats, getMessage } from '@/lib/db'
import { processFeedback, storeFeedbackLessons } from '@/lib/feedback'

export async function POST(request: Request) {
  try {
    const { messageId, type, content } = await request.json()

    if (!messageId || !type) {
      return Response.json({ error: 'messageId and type are required' }, { status: 400 })
    }

    if (!['correction', 'preference', 'praise', 'complaint'].includes(type)) {
      return Response.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    // Store the feedback
    const feedback = createFeedback(messageId, type, content || '')

    // Get the original message for context
    const message = getMessage(messageId)
    const originalMessage = message?.content || ''

    // Process feedback into learnable lessons
    const lessons = processFeedback(type, content || '', originalMessage)
    const stored = storeFeedbackLessons(lessons)

    return Response.json({
      feedback,
      lessonsExtracted: lessons.length,
      lessonsStored: stored,
    })
  } catch (err: any) {
    console.error('Feedback error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const statsOnly = url.searchParams.get('stats') === 'true'

    if (statsOnly) {
      const stats = getFeedbackStats()
      return Response.json(stats)
    }

    const feedback = getRecentFeedback(50)
    return Response.json({ feedback })
  } catch (err: any) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

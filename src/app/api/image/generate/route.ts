/**
 * POST /api/image/generate — Submit a new image generation job.
 * Returns immediately with a job ID. Poll /api/image/status?id=<jobId> for progress.
 */

import { getImageEngine } from '@/lib/image-gen'
import { logActivity } from '@/lib/db'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, negativePrompt, config, conversationId, messageId } = body

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const engine = getImageEngine()
    const job = await engine.submit({
      prompt: prompt.trim(),
      negativePrompt,
      config,
      conversationId,
      messageId,
    })

    logActivity('image_gen', `Image: ${prompt.trim().slice(0, 60)}`, prompt.slice(0, 100), 'image', job.id)

    return Response.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      prompt: job.prompt,
      config: job.config,
    })
  } catch (err: any) {
    console.error('[image/generate] Error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

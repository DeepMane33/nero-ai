/**
 * POST /api/image — Legacy endpoint. Redirects to the new image generation engine.
 * Use /api/image/generate for new implementations.
 */

import { getImageEngine } from '@/lib/image-gen'
import { logActivity } from '@/lib/db'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, width, height, seed, style } = body

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const fullPrompt = (style || '') + prompt.trim()

    const engine = getImageEngine()
    const job = await engine.submit({
      prompt: fullPrompt,
      config: {
        width: width || 1024,
        height: height || 1024,
        seed,
      },
    })

    logActivity('image_gen', `Image: ${fullPrompt.slice(0, 60)}`, fullPrompt.slice(0, 100), 'image', job.id)

    // Return job info — client should poll /api/image/status
    return Response.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
    })
  } catch (err: any) {
    console.error('Image generation error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

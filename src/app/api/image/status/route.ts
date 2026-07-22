/**
 * GET /api/image/status?id=<jobId> — Check status of an image generation job.
 */

import { getImageEngine } from '@/lib/image-gen'

export const maxDuration = 15

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const jobId = url.searchParams.get('id')

    if (!jobId) {
      return Response.json({ error: 'Missing job id parameter' }, { status: 400 })
    }

    const engine = getImageEngine()
    const job = await engine.getStatus(jobId)

    return Response.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      prompt: job.prompt,
      config: job.config,
      imageUrl: job.imageUrl,
      imagePath: job.imagePath,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  } catch (err: any) {
    console.error('[image/status] Error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

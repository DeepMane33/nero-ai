/**
 * GET /api/image/models — List available models and storage stats.
 */

import { MODEL_INFO, ASPECT_RATIOS, QUALITY_PRESETS } from '@/lib/image-gen/config'
import { getImageEngine } from '@/lib/image-gen'

export async function GET() {
  try {
    const engine = getImageEngine()
    const stats = engine.getStorageStats()

    return Response.json({
      models: MODEL_INFO,
      aspectRatios: ASPECT_RATIOS,
      qualityPresets: QUALITY_PRESETS,
      storage: stats,
    })
  } catch (err: any) {
    console.error('[image/models] Error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

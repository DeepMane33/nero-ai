/**
 * Stable Horde Backend Adapter
 * Free, community-powered image generation. No API key needed (anonymous).
 * Slower than local GPU but works on any machine without hardware requirements.
 *
 * Supports: SDXL, Stable Diffusion models. FLUX models available when workers have them.
 */

import type { ImageBackendAdapter, ImageGenConfig, ImageModel, ImageStatus } from './types'

const HORDE_URL = 'https://stablehorde.net/api/v2'
const HORDE_KEY = '0000000000' // Anonymous — free, slower queue

// Map our model names to Horde model names
const MODEL_MAP: Record<ImageModel, string[]> = {
  'flux-schnell': ['FLUX.1 [schnell]', 'stable_diffusion'],
  'flux-dev': ['FLUX.1 [dev]', 'stable_diffusion'],
  'sdxl': ['stable_diffusion_xl', 'stable_diffusion'],
}

export class StableHordeBackend implements ImageBackendAdapter {
  readonly name = 'stable-horde'
  readonly supportedModels: ImageModel[] = ['flux-schnell', 'flux-dev', 'sdxl']

  async submit(prompt: string, config: ImageGenConfig): Promise<string> {
    const hordeModels = MODEL_MAP[config.model] || MODEL_MAP['sdxl']

    const response = await fetch(`${HORDE_URL}/generate/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.HORDE_API_KEY || HORDE_KEY,
      },
      body: JSON.stringify({
        prompt: prompt,
        params: {
          width: Math.min(config.width, 576),
          height: Math.min(config.height, 576),
          steps: Math.min(config.steps, 50),
          sampler_name: 'k_euler',
          cfg_scale: config.guidance,
          seed: config.seed?.toString() || '',
          karras: true,
          post_processing: [],
        },
        nsfw: false,
        models: hordeModels,
        r2: true,
        shared: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Stable Horde submit failed (${response.status}): ${errText}`)
    }

    const data = await response.json()
    if (!data.id) throw new Error('No job ID returned from Stable Horde')
    return data.id
  }

  async checkStatus(backendJobId: string): Promise<{
    status: ImageStatus
    progress: number
    imageUrl?: string
    error?: string
  }> {
    // Check if done first
    const checkRes = await fetch(`${HORDE_URL}/generate/check/${backendJobId}`)
    if (!checkRes.ok) {
      return { status: 'failed', progress: 0, error: `Status check failed (${checkRes.status})` }
    }

    const checkData = await checkRes.json()

    if (checkData.done) {
      // Fetch the result
      const resultRes = await fetch(`${HORDE_URL}/generate/status/${backendJobId}`)
      if (!resultRes.ok) {
        return { status: 'failed', progress: 100, error: 'Failed to fetch result' }
      }

      const resultData = await resultRes.json()
      const gens = resultData.generations

      if (!gens || gens.length === 0) {
        return { status: 'failed', progress: 100, error: 'No images generated' }
      }

      const imgData = gens[0]
      // Could be a URL or base64
      const imageUrl = imgData.img || null

      return {
        status: 'completed',
        progress: 100,
        imageUrl: imageUrl || undefined,
      }
    }

    // Still processing
    const queuePos = checkData.queue_position ?? 0
    const waitTime = checkData.wait_time ?? 0
    const processing = checkData.processing ?? 0

    // Estimate progress based on queue position and wait time
    let progress = 0
    if (processing > 0) {
      progress = 50 + Math.random() * 40 // Actively processing = 50-90%
    } else if (waitTime > 0) {
      progress = Math.max(5, Math.min(45, 45 - (waitTime / 10)))
    } else {
      progress = 5 + Math.random() * 15
    }

    return {
      status: 'generating',
      progress: Math.round(progress),
    }
  }

  async downloadImage(imageUrl: string): Promise<Buffer> {
    // Handle base64 data URI
    if (imageUrl.startsWith('data:')) {
      const base64 = imageUrl.split(',')[1]
      return Buffer.from(base64, 'base64')
    }

    // Handle raw base64 (no prefix)
    if (!imageUrl.startsWith('http')) {
      return Buffer.from(imageUrl, 'base64')
    }

    // Handle URL
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}

/**
 * ComfyUI Backend Adapter (stub — for future local GPU inference)
 * ComfyUI runs locally and supports FLUX, SDXL, and more.
 * Enable by setting COMFYUI_URL=http://127.0.0.1:8188 in .env.local
 */

import type { ImageBackendAdapter, ImageGenConfig, ImageModel, ImageStatus } from './types'

export class ComfyUIBackend implements ImageBackendAdapter {
  readonly name = 'comfyui'
  readonly supportedModels: ImageModel[] = ['flux-schnell', 'flux-dev', 'sdxl']
  private baseUrl: string

  constructor(baseUrl: string = 'http://127.0.0.1:8188') {
    this.baseUrl = baseUrl
  }

  async submit(prompt: string, config: ImageGenConfig): Promise<string> {
    // ComfyUI workflow submission
    const workflow = this.buildWorkflow(prompt, config)
    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    })

    if (!response.ok) {
      throw new Error(`ComfyUI submit failed: ${response.status}`)
    }

    const data = await response.json()
    return data.prompt_id
  }

  async checkStatus(backendJobId: string): Promise<{
    status: ImageStatus; progress: number; imageUrl?: string; error?: string
  }> {
    const response = await fetch(`${this.baseUrl}/history/${backendJobId}`)
    if (!response.ok) return { status: 'generating', progress: 50 }

    const data = await response.json()
    const history = data[backendJobId]

    if (!history) return { status: 'generating', progress: 50 }

    if (history.status?.completed) {
      const outputs = history.outputs
      // Find the first image output
      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId]
        if (nodeOutput.images?.length > 0) {
          const img = nodeOutput.images[0]
          return {
            status: 'completed',
            progress: 100,
            imageUrl: `${this.baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`,
          }
        }
      }
    }

    return { status: 'generating', progress: 70 }
  }

  async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  private buildWorkflow(prompt: string, config: ImageGenConfig): Record<string, any> {
    // Minimal ComfyUI workflow — adapt based on model
    return {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: config.seed ?? Math.floor(Math.random() * 2 ** 32),
          steps: config.steps,
          cfg: config.guidance,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: this.getCheckpointName(config.model) },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: { width: config.width, height: config.height, batch_size: 1 },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: prompt, clip: ['4', 1] },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'blurry, low quality, distorted', clip: ['4', 1] },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['4', 2] },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'nero', images: ['8', 0] },
      },
    }
  }

  private getCheckpointName(model: ImageModel): string {
    switch (model) {
      case 'flux-schnell': return 'flux1-schnell.safetensors'
      case 'flux-dev': return 'flux1-dev.safetensors'
      case 'sdxl': return 'sd_xl_base_1.0.safetensors'
      default: return 'sd_xl_base_1.0.safetensors'
    }
  }
}

/**
 * Image Generation Engine — Type Definitions
 * Modular architecture supporting multiple backends and future expansion.
 */

// ---------------------------------------------------------------------------
// Enums & Literals
// ---------------------------------------------------------------------------

export type ImageModel = 'flux-schnell' | 'flux-dev' | 'sdxl'
export type ImageBackend = 'stable-horde' | 'comfyui' | 'invokeai' | 'onnx'
export type ImageStatus = 'queued' | 'generating' | 'completed' | 'failed'
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9'
export type ImageQuality = 'draft' | 'standard' | 'high'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ImageGenConfig {
  backend: ImageBackend
  model: ImageModel
  width: number
  height: number
  steps: number
  guidance: number
  quality: ImageQuality
  seed?: number
}

export interface AspectRatioOption {
  label: string
  ratio: AspectRatio
  width: number
  height: number
}

export interface QualityOption {
  label: string
  value: ImageQuality
  steps: number
  description: string
}

// ---------------------------------------------------------------------------
// Generation Request / Result
// ---------------------------------------------------------------------------

export interface ImageGenRequest {
  prompt: string
  negativePrompt?: string
  config?: Partial<ImageGenConfig>
  conversationId?: string
  messageId?: string
}

export interface ImageGenJob {
  id: string
  backendJobId?: string
  status: ImageStatus
  prompt: string
  negativePrompt?: string
  config: ImageGenConfig
  progress: number
  imageUrl?: string
  imagePath?: string
  error?: string
  createdAt: string
  completedAt?: string
}

export interface ImageGenResult {
  success: boolean
  job: ImageGenJob
  imageUrl?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Backend Interface (Strategy pattern — swap implementations freely)
// ---------------------------------------------------------------------------

export interface ImageBackendAdapter {
  readonly name: string
  readonly supportedModels: ImageModel[]

  /** Submit a generation job. Returns a backend-specific job ID. */
  submit(prompt: string, config: ImageGenConfig): Promise<string>

  /** Poll job status. Returns progress (0-100) and optional image URL. */
  checkStatus(backendJobId: string): Promise<{
    status: ImageStatus
    progress: number
    imageUrl?: string
    error?: string
  }>

  /** Download the generated image as a buffer. */
  downloadImage(imageUrl: string): Promise<Buffer>
}

// ---------------------------------------------------------------------------
// Model Info
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: ImageModel
  name: string
  description: string
  backend: ImageBackend
  available: boolean
  estimatedTime: string
  maxResolution: number
}

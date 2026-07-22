/**
 * Image Generation — Default configuration and option maps.
 */

import type { AspectRatio, AspectRatioOption, ImageModel, ImageGenConfig, QualityOption, ImageQuality, ModelInfo, ImageBackend } from './types'

// ---------------------------------------------------------------------------
// Default config per model
// ---------------------------------------------------------------------------

export const MODEL_DEFAULTS: Record<ImageModel, Partial<ImageGenConfig>> = {
  'flux-schnell': { steps: 4, guidance: 0, width: 512, height: 512 },
  'flux-dev':     { steps: 20, guidance: 3.5, width: 512, height: 512 },
  'sdxl':         { steps: 25, guidance: 7, width: 512, height: 512 },
}

// ---------------------------------------------------------------------------
// Model descriptions
// ---------------------------------------------------------------------------

export const MODEL_INFO: ModelInfo[] = [
  {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Fastest generation, good quality. Best for quick iterations.',
    backend: 'stable-horde',
    available: true,
    estimatedTime: '15-60s',
    maxResolution: 1024,
  },
  {
    id: 'flux-dev',
    name: 'FLUX Dev',
    description: 'Higher quality, slower. Best for final outputs.',
    backend: 'stable-horde',
    available: true,
    estimatedTime: '30-120s',
    maxResolution: 1024,
  },
  {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    description: 'Reliable fallback. Wide style support.',
    backend: 'stable-horde',
    available: true,
    estimatedTime: '20-90s',
    maxResolution: 1024,
  },
]

// ---------------------------------------------------------------------------
// Aspect Ratios
// ---------------------------------------------------------------------------

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: 'Square',    ratio: '1:1',   width: 512, height: 512 },
  { label: 'Landscape', ratio: '16:9',  width: 576, height: 320 },
  { label: 'Portrait',  ratio: '9:16',  width: 320, height: 576 },
  { label: 'Photo',     ratio: '4:3',   width: 512, height: 384 },
  { label: 'Tall',      ratio: '3:4',   width: 384, height: 512 },
  { label: 'Ultra Wide', ratio: '21:9', width: 576, height: 256 },
]

// ---------------------------------------------------------------------------
// Quality Presets
// ---------------------------------------------------------------------------

export const QUALITY_PRESETS: QualityOption[] = [
  { label: 'Draft',    value: 'draft',    steps: 4,  description: 'Fast preview' },
  { label: 'Standard', value: 'standard', steps: 20, description: 'Good balance' },
  { label: 'High',     value: 'high',     steps: 40, description: 'Best quality' },
]

// ---------------------------------------------------------------------------
// Default config factory
// ---------------------------------------------------------------------------

export function buildConfig(overrides?: Partial<ImageGenConfig>): ImageGenConfig {
  const model: ImageModel = overrides?.model || 'flux-schnell'
  const defaults = MODEL_DEFAULTS[model]

  return {
    backend: overrides?.backend || 'stable-horde',
    model,
    width: overrides?.width ?? defaults.width ?? 1024,
    height: overrides?.height ?? defaults.height ?? 1024,
    steps: overrides?.steps ?? defaults.steps ?? 20,
    guidance: overrides?.guidance ?? defaults.guidance ?? 3.5,
    quality: overrides?.quality || 'standard',
    seed: overrides?.seed,
  }
}

// ---------------------------------------------------------------------------
// Resolve aspect ratio to dimensions
// ---------------------------------------------------------------------------

export function resolveAspectRatio(ratio: AspectRatio, model: ImageModel = 'flux-schnell'): { width: number; height: number } {
  const maxRes = MODEL_INFO.find(m => m.id === model)?.maxResolution ?? 1024
  const option = ASPECT_RATIOS.find(r => r.ratio === ratio)
  if (!option) return { width: maxRes, height: maxRes }

  // Scale down if exceeds max resolution for the model
  const scale = Math.min(1, maxRes / Math.max(option.width, option.height))
  return {
    width: Math.round(option.width * scale / 64) * 64,
    height: Math.round(option.height * scale / 64) * 64,
  }
}

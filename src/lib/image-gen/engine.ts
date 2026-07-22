/**
 * Image Generation Engine
 * Orchestrates backend selection, job management, and image storage.
 * This is the main entry point for all image generation operations.
 */

import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { getDb } from '../db'
import { StableHordeBackend } from './backend-stable-horde'
import { ComfyUIBackend } from './backend-comfyui'
import { buildConfig } from './config'
import type {
  ImageBackendAdapter,
  ImageBackend,
  ImageGenConfig,
  ImageGenJob,
  ImageGenRequest,
  ImageGenResult,
  ImageModel,
  ImageStatus,
} from './types'

// ---------------------------------------------------------------------------
// Backend Registry (add new backends here)
// ---------------------------------------------------------------------------

const backends = new Map<ImageBackend, () => ImageBackendAdapter>([
  ['stable-horde', () => new StableHordeBackend()],
  ['comfyui', () => new ComfyUIBackend(process.env.COMFYUI_URL || 'http://127.0.0.1:8188')],
] as [ImageBackend, () => ImageBackendAdapter][])

function getBackend(name: ImageBackend): ImageBackendAdapter {
  const factory = backends.get(name)
  if (!factory) throw new Error(`Unknown backend: ${name}`)
  return factory()
}

// ---------------------------------------------------------------------------
// Image Storage
// ---------------------------------------------------------------------------

function getStorageDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  const dir = path.join(home, '.nero-os', 'generated-images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function saveImageToDisk(buffer: Buffer, jobId: string): Promise<string> {
  const dir = getStorageDir()
  const filename = `${jobId}.png`
  const filePath = path.join(dir, filename)
  const { writeFile } = await import('fs/promises')
  await writeFile(filePath, buffer)
  return filePath
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function createImageRecord(job: ImageGenJob): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO image_generations
    (id, backend_job_id, conversation_id, message_id, prompt, negative_prompt, model, backend,
     width, height, steps, guidance, quality, seed, status, progress,
     image_path, image_url, error, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id, job.backendJobId || null, null, null,
    job.prompt, job.negativePrompt || null,
    job.config.model, job.config.backend,
    job.config.width, job.config.height,
    job.config.steps, job.config.guidance,
    job.config.quality, job.config.seed ?? null,
    job.status, job.progress,
    job.imagePath || null, job.imageUrl || null,
    job.error || null, job.createdAt, job.completedAt || null
  )
}

function updateImageRecord(job: ImageGenJob): void {
  const db = getDb()
  db.prepare(`
    UPDATE image_generations SET
      status = ?, progress = ?, image_path = ?, image_url = ?, error = ?, completed_at = ?
    WHERE id = ?
  `).run(job.status, job.progress, job.imagePath || null, job.imageUrl || null, job.error || null, job.completedAt || null, job.id)
}

function getImageRecord(id: string): any {
  return getDb().prepare('SELECT * FROM image_generations WHERE id = ?').get(id)
}

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

export class ImageGenEngine {
  // In-memory job tracking for active jobs
  private activeJobs: Map<string, ImageGenJob> = new Map()

  /**
   * Submit a new image generation request.
   * Returns immediately with a job ID — poll getStatus() for progress.
   */
  async submit(request: ImageGenRequest): Promise<ImageGenJob> {
    const config = buildConfig(request.config)
    const jobId = `img-${uuid()}`

    // Build the enhanced prompt
    const enhancedPrompt = request.prompt.trim()

    const job: ImageGenJob = {
      id: jobId,
      status: 'queued',
      prompt: enhancedPrompt,
      negativePrompt: request.negativePrompt || 'blurry, low quality, distorted, watermark, text',
      config,
      progress: 0,
      createdAt: new Date().toISOString(),
    }

    // Save to DB
    this.activeJobs.set(jobId, job)

    try {
      const backend = getBackend(config.backend)
      const backendJobId = await backend.submit(enhancedPrompt, config)

      job.backendJobId = backendJobId
      job.status = 'generating'
      job.progress = 5
      createImageRecord({ ...job }) // Save after backendJobId is set
    } catch (err: any) {
      job.status = 'failed'
      job.error = err.message
      createImageRecord({ ...job }) // Save failed state
      throw err
    }

    return job
  }

  /**
   * Check the status of a running job.
   * If completed, downloads and saves the image locally.
   */
  async getStatus(jobId: string): Promise<ImageGenJob> {
    let job = this.activeJobs.get(jobId)
    if (!job) {
      // Try to load from DB
      const record = getImageRecord(jobId)
      if (!record) throw new Error(`Job not found: ${jobId}`)

      job = {
        id: record.id,
        backendJobId: record.backend_job_id || undefined,
        status: record.status,
        prompt: record.prompt,
        negativePrompt: record.negative_prompt,
        config: {
          backend: record.backend,
          model: record.model,
          width: record.width,
          height: record.height,
          steps: record.steps,
          guidance: record.guidance,
          quality: record.quality,
          seed: record.seed,
        },
        progress: record.progress,
        imageUrl: record.image_url,
        imagePath: record.image_path,
        error: record.error,
        createdAt: record.created_at,
        completedAt: record.completed_at,
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job
      }
    }

    // If job is still active, check backend status
    if (job.status === 'queued' || job.status === 'generating') {
      if (!job.backendJobId) {
        return job
      }

      try {
        const backend = getBackend(job.config.backend)
        const status = await backend.checkStatus(job.backendJobId)

        job.status = status.status
        job.progress = status.progress

        if (status.status === 'completed' && status.imageUrl) {
          // Download and save image locally
          try {
            const buffer = await backend.downloadImage(status.imageUrl)
            const filePath = await saveImageToDisk(buffer, job.id)
            job.imagePath = filePath
            job.imageUrl = `/api/image/history?id=${job.id}&format=image`
          } catch (downloadErr: any) {
            console.error('[image-gen] Failed to download image:', downloadErr.message)
            // Still mark as completed with the URL
            job.imageUrl = status.imageUrl
          }
          job.completedAt = new Date().toISOString()
          this.activeJobs.delete(job.id)
        }

        if (status.status === 'failed') {
          job.error = status.error || 'Generation failed'
          job.completedAt = new Date().toISOString()
          this.activeJobs.delete(job.id)
        }

        updateImageRecord(job)
      } catch (err: any) {
        console.error('[image-gen] Status check error:', err.message)
      }
    }

    return job
  }

  /**
   * Get image generation history.
   */
  getHistory(options: {
    conversationId?: string
    limit?: number
    offset?: number
    search?: string
  } = {}): any[] {
    const db = getDb()
    const { conversationId, limit = 50, offset = 0, search } = options

    let query = 'SELECT * FROM image_generations WHERE 1=1'
    const params: unknown[] = []

    if (conversationId) {
      query += ' AND conversation_id = ?'
      params.push(conversationId)
    }
    if (search) {
      query += ' AND prompt LIKE ?'
      // Escape SQL LIKE special characters to prevent wildcard injection
      const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
      params.push(`%${escaped}%`)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return db.prepare(query).all(...params)
  }

  /**
   * Delete an image generation record and its file.
   */
  deleteImage(jobId: string): boolean {
    const record = getImageRecord(jobId)
    if (!record) return false

    // Delete file if it exists
    if (record.image_path && fs.existsSync(record.image_path)) {
      try { fs.unlinkSync(record.image_path) } catch {}
    }

    const result = getDb().prepare('DELETE FROM image_generations WHERE id = ?').run(jobId)
    this.activeJobs.delete(jobId)
    return result.changes > 0
  }

  /**
   * Get storage usage stats.
   */
  getStorageStats(): { totalImages: number; totalSizeMB: number } {
    const db = getDb()
    const totalImages = (db.prepare('SELECT COUNT(*) as count FROM image_generations').get() as any).count

    const dir = getStorageDir()
    let totalSize = 0
    try {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const stat = fs.statSync(path.join(dir, file))
        totalSize += stat.size
      }
    } catch {}

    return { totalImages, totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100 }
  }
}

// Singleton instance
let _engine: ImageGenEngine | null = null

export function getImageEngine(): ImageGenEngine {
  if (!_engine) _engine = new ImageGenEngine()
  return _engine
}

/**
 * GET /api/image/history — List image generation history.
 * GET /api/image/history?id=<id>&format=image — Serve generated image file.
 * DELETE /api/image/history?id=<id> — Delete an image.
 */

import { getImageEngine } from '@/lib/image-gen'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export const maxDuration = 15

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const format = url.searchParams.get('format')

    // Serve image file
    if (id && format === 'image') {
      const record = getDb().prepare('SELECT image_path FROM image_generations WHERE id = ?').get(id) as any
      if (!record?.image_path || !fs.existsSync(record.image_path)) {
        return Response.json({ error: 'Image not found' }, { status: 404 })
      }
      const buffer = fs.readFileSync(record.image_path)
      return new Response(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // List history
    const conversationId = url.searchParams.get('conversationId')
    const search = url.searchParams.get('search')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const engine = getImageEngine()
    const images = engine.getHistory({
      conversationId: conversationId ?? undefined,
      search: search ?? undefined,
      limit,
      offset,
    })

    return Response.json({ images, total: images.length })
  } catch (err: any) {
    console.error('[image/history] Error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return Response.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    const engine = getImageEngine()
    const deleted = engine.deleteImage(id)

    if (!deleted) {
      return Response.json({ error: 'Image not found' }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (err: any) {
    console.error('[image/history] Delete error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

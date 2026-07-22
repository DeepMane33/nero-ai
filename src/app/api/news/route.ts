import { NextRequest } from 'next/server'
import {
  fetchDailyNews,
  getNewsContextForLLM,
  needsNewsRefresh,
} from '@/lib/news-fetcher'
import { getDailyNews, getNewsDates, getNewsCount } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const date = searchParams.get('date') || undefined
    const category = searchParams.get('category') || undefined

    switch (action) {
      case 'status': {
        const today = new Date().toISOString().split('T')[0]
        const todayCount = getNewsCount(today)
        const dates = getNewsDates()
        const needsRefresh = needsNewsRefresh()

        return Response.json({
          today,
          todayCount,
          needsRefresh,
          dates,
          lastFetch: dates[0]?.date || null,
        })
      }

      case 'list': {
        const articles = getDailyNews(date, category, 50)
        return Response.json({ articles, count: articles.length })
      }

      case 'context': {
        const context = getNewsContextForLLM()
        return Response.json({ context })
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[news] GET error:', err)
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const force = body.force === true

    console.log(`[news] Manual refresh requested (force: ${force})`)
    const result = await fetchDailyNews(force)

    return Response.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[news] POST error:', err)
    return Response.json({ error: err.message || 'Fetch failed' }, { status: 500 })
  }
}

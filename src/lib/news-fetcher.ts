/**
 * Automatic Daily News Fetcher for Nero AI
 *
 * Fetches trending topics and daily news from multiple sources,
 * caches them in SQLite, and injects them into conversations.
 *
 * Runs automatically:
 * - On server startup (if no news exists for today)
 * - When /api/news is called with POST
 * - On first chat of the day
 */

import { searchWeb } from './web-search'
import {
  insertDailyNews,
  getDailyNews,
  getNewsCount,
  clearOldNews,
  logActivity,
} from './db'

/* ------------------------------------------------------------------ */
/*  Topic categories to fetch daily                                    */
/* ------------------------------------------------------------------ */

const DAILY_TOPICS = [
  { category: 'top_news', queries: ['top news today', 'breaking news today'] },
  { category: 'tech', queries: ['latest technology news', 'AI news today'] },
  { category: 'world', queries: ['world news today', 'international headlines'] },
  { category: 'sports', queries: ['FIFA World Cup 2026 matches today live scores', 'World Cup 2026 fixtures results today'] },
  { category: 'science', queries: ['science discoveries today'] },
]

/* ------------------------------------------------------------------ */
/*  Fetch news for a single category                                  */
/* ------------------------------------------------------------------ */

async function fetchCategoryNews(
  category: string,
  queries: string[]
): Promise<{ title: string; snippet: string; url: string; source: string }[]> {
  const allResults: { title: string; snippet: string; url: string; source: string }[] = []

  for (const query of queries) {
    try {
      const results = await searchWeb(query)
      for (const r of results) {
        if (r.title && r.url) {
          allResults.push({
            title: r.title,
            snippet: r.snippet || '',
            url: r.url,
            source: r.source || 'Web',
          })
        }
      }
    } catch (err) {
      console.warn(`[news-fetcher] Failed to fetch "${query}":`, err)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = allResults.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  return unique.slice(0, 10) // max 10 per category
}

/* ------------------------------------------------------------------ */
/*  Main fetch function                                                */
/* ------------------------------------------------------------------ */

export interface FetchResult {
  date: string
  totalArticles: number
  categories: Record<string, number>
  duration: number
}

export async function fetchDailyNews(force: boolean = false): Promise<FetchResult> {
  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  // Check if we already have news for today (unless forced)
  if (!force) {
    const existingCount = getNewsCount(today)
    if (existingCount >= 10) {
      console.log(`[news-fetcher] Already have ${existingCount} articles for today, skipping`)
      return {
        date: today,
        totalArticles: existingCount,
        categories: {},
        duration: 0,
      }
    }
  }

  console.log(`[news-fetcher] Fetching daily news for ${today}...`)

  const categories: Record<string, number> = {}
  let totalArticles = 0

  // Fetch all categories in parallel
  const fetchPromises = DAILY_TOPICS.map(async (topic) => {
    const results = await fetchCategoryNews(topic.category, topic.queries)

    for (const result of results) {
      insertDailyNews(
        topic.category,
        result.title,
        result.snippet,
        result.url,
        result.source,
        topic.queries[0],
        today
      )
      totalArticles++
    }

    categories[topic.category] = results.length
    console.log(`[news-fetcher] ${topic.category}: ${results.length} articles`)
  })

  await Promise.allSettled(fetchPromises)

  // Clean up old news (keep 7 days)
  const cleaned = clearOldNews(7)
  if (cleaned > 0) {
    console.log(`[news-fetcher] Cleaned ${cleaned} old articles`)
  }

  const duration = Date.now() - startTime
  console.log(`[news-fetcher] Done: ${totalArticles} articles in ${duration}ms`)

  // Log activity
  logActivity(
    'system',
    'Daily news fetched',
    `${totalArticles} articles across ${Object.keys(categories).length} categories`,
    'news',
    today
  )

  return { date: today, totalArticles, categories, duration }
}

/* ------------------------------------------------------------------ */
/*  Get formatted news context for LLM                                 */
/* ------------------------------------------------------------------ */

export function getNewsContextForLLM(): string {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const articles = getDailyNews(today, undefined, 40)

  if (articles.length === 0) {
    return `\n\n## Today's News\nNo news has been fetched yet today. You can answer based on your training data but acknowledge you may not have the very latest info.\n`
  }

  // Group by category
  const grouped: Record<string, typeof articles> = {}
  for (const article of articles) {
    if (!grouped[article.category]) grouped[article.category] = []
    grouped[article.category].push(article)
  }

  const categoryLabels: Record<string, string> = {
    top_news: 'Top News',
    tech: 'Technology',
    world: 'World News',
    sports: 'Sports & FIFA World Cup',
    science: 'Science',
  }

  let context = `\n\n⚠️ TODAY'S CACHED NEWS (as of ${now}):\n`
  context += `The following are real news headlines from today. Use them to answer questions about current events.\n\n`

  for (const [category, items] of Object.entries(grouped)) {
    const label = categoryLabels[category] || category
    context += `### ${label}\n`
    for (const item of items.slice(0, 8)) {
      context += `- ${item.title}`
      if (item.snippet) {
        context += `: ${item.snippet}`
      }
      context += `\n`
    }
    context += `\n`
  }

  context += `⬆️ The above are TODAY'S ACTUAL NEWS. If the user asks about current events, sports scores, news, or what's happening — extract info from above and answer directly. NEVER say "I don't have information" when news is provided above this line.`

  return context
}

/* ------------------------------------------------------------------ */
/*  Check if news needs refresh                                        */
/* ------------------------------------------------------------------ */

export function needsNewsRefresh(): boolean {
  const today = new Date().toISOString().split('T')[0]
  const count = getNewsCount(today)
  return count < 5 // refresh if fewer than 5 articles
}

/* ------------------------------------------------------------------ */
/*  Auto-fetch on import (runs once per server start)                  */
/* ------------------------------------------------------------------ */

let _fetchedToday = false

export async function ensureDailyNews(): Promise<void> {
  if (_fetchedToday) return
  if (!needsNewsRefresh()) {
    _fetchedToday = true
    console.log('[news-fetcher] News already up to date for today')
    return
  }

  _fetchedToday = true
  try {
    await fetchDailyNews(false)
  } catch (err) {
    console.error('[news-fetcher] Auto-fetch failed:', err)
  }
}

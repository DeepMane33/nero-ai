/**
 * Web Search for Nero AI — v3 (aggressive, fact-focused search)
 *
 * Strategy: search broadly, fetch real page content, and give the LLM
 * enough data to answer confidently. The LLM should NEVER hedge when
 * search results contain the answer.
 *
 * Sources (in order of reliability):
 * 1. DuckDuckGo HTML (actual web results, scraped)
 * 2. Wikipedia API (detailed encyclopedic info)
 * 3. DuckDuckGo API (instant answers — supplementary only)
 * 4. Google News RSS (for current events)
 *
 * Additionally fetches actual page content for the top results.
 */

interface WebResult {
  title: string
  snippet: string
  url: string
  source: string
  date?: string
  content?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo HTML — actual web search results (most reliable)
// ─────────────────────────────────────────────────────────────────────────────

async function searchDuckDuckGoHTML(query: string): Promise<WebResult[]> {
  try {
    const encoded = encodeURIComponent(query)
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return [] // DuckDuckGo may block from cloud IPs

    const html = await response.text()
    if (html.includes('anomaly.js') || html.includes('cc=botnet') || html.includes('captcha')) return []

    const results: WebResult[] = []
    const blockRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    let match
    while ((match = blockRegex.exec(html)) !== null && results.length < 10) {
      let rawUrl = match[1].trim()
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      const snippet = match[3].replace(/<[^>]*>/g, '').trim()
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/)
      if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1])
      if (title && rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('duckduckgo.com')) {
        results.push({ title, snippet, url: rawUrl, source: 'DuckDuckGo' })
      }
    }

    if (results.length === 0) {
      const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
      while ((match = linkRegex.exec(html)) !== null && results.length < 10) {
        let rawUrl = match[1]
        const title = match[2].trim()
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/)
        if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1])
        else if (rawUrl.startsWith('//')) rawUrl = `https:${rawUrl}`
        if (title && rawUrl.startsWith('http') && !rawUrl.includes('duckduckgo.com')) {
          results.push({ title, snippet: '', url: rawUrl, source: 'DuckDuckGo' })
        }
      }
    }

    if (results.length > 0 && results.some(r => !r.snippet)) {
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi
      let snippetIdx = 0
      while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
        const snippet = match[1].replace(/<[^>]*>/g, '').trim()
        if (snippet && !results[snippetIdx].snippet) {
          results[snippetIdx].snippet = snippet
        }
        snippetIdx++
      }
    }

    return results
  } catch (error) {
    console.error('DuckDuckGo HTML failed:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wikipedia API
// ─────────────────────────────────────────────────────────────────────────────

async function searchWikipedia(query: string): Promise<WebResult[]> {
  try {
    const encoded = encodeURIComponent(query)
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=5`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!response.ok) return []
    const data = await response.json()
    const results: WebResult[] = []
    if (data.query?.search) {
      for (const item of data.query.search) {
        results.push({
          title: item.title,
          snippet: item.snippet?.replace(/<[^>]*>/g, '') || '',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
          source: 'Wikipedia',
          date: item.timestamp
        })
      }
    }
    return results
  } catch (error) {
    console.error('Wikipedia search failed:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wikipedia direct page fetch — gets the FULL article summary
// This is the most reliable source for factual answers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWikipediaPage(title: string): Promise<WebResult[]> {
  try {
    const encoded = encodeURIComponent(title)
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!response.ok) return []
    const data = await response.json()
    if (!data.extract) return []
    return [{
      title: data.title || title,
      snippet: data.extract,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
      source: 'Wikipedia',
    }]
  } catch (error) {
    console.error('Wikipedia page fetch failed:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo API (instant answers — supplementary only)
// ─────────────────────────────────────────────────────────────────────────────

async function searchDuckDuckGoAPI(query: string): Promise<WebResult[]> {
  try {
    const encoded = encodeURIComponent(query)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!response.ok) return []
    const data = await response.json()
    const results: WebResult[] = []

    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText,
        url: data.AbstractURL,
        source: 'DuckDuckGo'
      })
    }
    if (data.Answer) {
      results.push({
        title: `Answer: ${query}`,
        snippet: data.Answer,
        url: data.AbstractURL || '',
        source: 'DuckDuckGo'
      })
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 100),
            snippet: topic.Text,
            url: topic.FirstURL,
            source: 'DuckDuckGo'
          })
        }
      }
    }
    return results
  } catch (error) {
    console.error('DuckDuckGo API failed:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch actual page content for richer answers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPageContent(url: string, maxChars: number = 3000): Promise<string> {
  try {
    // Validate URL to prevent SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return '';
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return '';
    const hostname = parsedUrl.hostname;
    const isPrivate = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(hostname) ||
      hostname === '::1' || hostname === '[::1]';
    if (isPrivate) return '';

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return ''
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return ''

    const html = await res.text()
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/cookie|privacy policy|terms of service|subscribe|newsletter|sign up|log in|advertisement/gi, '')
    return text.slice(0, maxChars)
  } catch {
    return ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart query extraction — figure out what the user is really asking
// ─────────────────────────────────────────────────────────────────────────────

function extractSearchQuery(message: string): string {
  const lower = message.toLowerCase()
  const today = new Date()
  const year = today.getFullYear()
  const dateWords = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Sports — extract the specific question
  if (/\b(fifa|world cup|soccer|football|ipl|cricket|nba|nfl|match|score|tournament|game|champion|winner|final)\b/i.test(lower)) {
    // Extract the actual topic (e.g., "who won the 2022 world cup")
    const whoWonMatch = lower.match(/who\s+(won|won the|won the 2022|won the 2023|won the 2024|won the 2025|won the 2026)/i)
    if (whoWonMatch) {
      // Reconstruct a clean search query
      const topic = message.replace(/who\s+(won|won the)\s*/i, '').replace(/\?/g, '').trim()
      return `FIFA World Cup ${topic} winner champion result`
    }
    if (/\b(today|tonight|now|live|yesterday|recent)\b/i.test(lower)) {
      return `${message} live scores results ${dateWords}`
    }
    return `${message} winner champion results ${year}`
  }

  // News / current events
  if (/\b(news|headlines?|what'?s happening|current events|breaking)\b/i.test(lower)) {
    return `${message} ${dateWords}`
  }

  // Weather
  if (/\b(weather|temperature|forecast)\b/i.test(lower)) {
    return `weather forecast ${dateWords}`
  }

  // Time-sensitive
  if (/\b(today|tonight|this week|currently|right now|latest|recent|breaking|just|new)\b/i.test(lower)) {
    return `${message} ${dateWords}`
  }

  // Who/what/when/where questions — be specific
  if (/\b(who is|who was|who won|who invented|who created|who founded|who discovered)\b/i.test(lower)) {
    return `${message} ${year}`
  }

  if (/\b(what is|what are|what was|what did)\b/i.test(lower)) {
    return `${message} ${year}`
  }

  return message
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect specific Wikipedia pages to fetch directly
// This bypasses search and gets the exact answer
// ─────────────────────────────────────────────────────────────────────────────

function detectDirectWikipediaPage(message: string): string | null {
  const lower = message.toLowerCase()

  // World Cup winners
  const wcMatch = lower.match(/(?:who\s+)?(?:won|won the|winner of)\s+(?:the\s+)?(\d{4})\s+(?:fifa\s+)?world\s+cup/i)
  if (wcMatch) {
    return `${wcMatch[1]} FIFA World Cup`
  }

  // Super Bowl
  const sbMatch = lower.match(/(?:who\s+)?(?:won|won the|winner of)\s+(?:the\s+)?super\s+bowl\s+(\w+)/i)
  if (sbMatch) {
    return `Super Bowl ${sbMatch[1]}`
  }

  // Olympics
  const olympMatch = lower.match(/(?:who\s+)?(?:won|won the|winner of)\s+(?:the\s+)?(\d{4})\s+olympics/i)
  if (olympMatch) {
    return `${olympMatch[1]} Summer Olympics`
  }

  // Elections
  const electionMatch = lower.match(/(?:who\s+)?(?:won|won the|winner of)\s+(?:the\s+)?(\d{4})\s+(?:us\s+)?(?:presidential\s+)?election/i)
  if (electionMatch) {
    return `${electionMatch[1]} United States presidential election`
  }

  // Nobel Prize
  const nobelMatch = lower.match(/(?:who\s+)?(?:won|won the|winner of)\s+(?:the\s+)?(\d{4})\s+nobel\s+(prize|peace prize|physics|chemistry|medicine|literature|economics)/i)
  if (nobelMatch) {
    return `${nobelMatch[1]} Nobel Prize in ${nobelMatch[2]}`
  }

  // General "who is X" questions
  const whoMatch = lower.match(/who\s+(is|was)\s+(?:the\s+)?(.+?)(?:\?|$)/i)
  if (whoMatch && whoMatch[2].length > 2) {
    const name = whoMatch[2].trim()
    // Skip if it's too generic
    if (!/^(the|a|an|this|that|it|he|she|they|we|i|you)$/i.test(name)) {
      return name
    }
  }

  // "What is X" questions
  const whatMatch = lower.match(/what\s+(is|are|was)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\?|$)/i)
  if (whatMatch && whatMatch[2].length > 3) {
    const topic = whatMatch[2].trim()
    if (!/^(the|a|an|this|that|it|he|she|they|we|i|you|your|my)$/i.test(topic)) {
      return topic
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch page content for top results (in parallel, with timeout)
// ─────────────────────────────────────────────────────────────────────────────

async function enrichResultsWithContent(results: WebResult[], maxPages: number = 3): Promise<WebResult[]> {
  const toFetch = results
    .filter(r => r.url && r.url.startsWith('http') && !r.url.includes('duckduckgo.com'))
    .slice(0, maxPages)

  if (toFetch.length === 0) return results

  const contentPromises = toFetch.map(async (result) => {
    try {
      const content = await fetchPageContent(result.url, 2500)
      return { ...result, content }
    } catch {
      return result
    }
  })

  const enriched = await Promise.allSettled(contentPromises)
  const enrichedMap = new Map<string, string>()
  for (const item of enriched) {
    if (item.status === 'fulfilled' && item.value.content) {
      enrichedMap.set(item.value.url, item.value.content)
    }
  }

  return results.map(r => ({
    ...r,
    content: r.content || enrichedMap.get(r.url) || undefined
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main search function
// ─────────────────────────────────────────────────────────────────────────────

export async function searchWeb(query: string): Promise<WebResult[]> {
  const enhancedQuery = extractSearchQuery(query)
  const directWikiPage = detectDirectWikipediaPage(query)

  console.log(`[web-search] Original: "${query}"`)
  console.log(`[web-search] Enhanced: "${enhancedQuery}"`)
  console.log(`[web-search] Direct Wikipedia: "${directWikiPage}"`)

  // Build search tasks — include direct Wikipedia page fetch
  const searchTasks: Promise<WebResult[]>[] = [
    searchDuckDuckGoHTML(enhancedQuery),
    searchWikipedia(enhancedQuery),
    searchDuckDuckGoAPI(enhancedQuery),
  ]

  // If we detected a specific Wikipedia page, fetch it directly
  if (directWikiPage) {
    searchTasks.push(fetchWikipediaPage(directWikiPage))
  }

  const results = await Promise.allSettled(searchTasks)

  const allResults: WebResult[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueResults: WebResult[] = []
  for (const result of allResults) {
    if (!seen.has(result.url)) {
      seen.add(result.url)
      uniqueResults.push(result)
    }
  }

  const topResults = uniqueResults.slice(0, 12)
  console.log(`[web-search] Total unique: ${topResults.length} results`)

  // Enrich top results with actual page content
  const enriched = await enrichResultsWithContent(topResults, 4)
  console.log(`[web-search] Enriched ${enriched.filter(r => r.content).length} results with page content`)

  return enriched
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect if query needs web search
// ─────────────────────────────────────────────────────────────────────────────

export function needsWebSearch(message: string): boolean {
  const lower = message.toLowerCase().trim()

  if (lower.length < 3) return false

  // Pure greetings / chitchat — don't search
  const noSearchPatterns = [
    /^(hi|hey|hello|yo|sup|ok|okay|thanks|thank you|bye|goodbye|see ya|lol|haha|yes|no|yep|nope|sure|cool|nice|great|awesome|wow)$/i,
    /^(good morning|good night|good afternoon|how are you|what'?s up|what'?s good)$/i,
    /^(help|commands|what can you do|who are you|what are you)$/i,
    /^(i love you|i hate you|you're (stupid|dumb|awesome|great|amazing))$/i,
  ]
  if (noSearchPatterns.some(p => p.test(lower))) return false

  // Personal / memory queries — don't search
  const personalPatterns = [
    /^(remember|recall|what do you know about me|my name|my favorite|my preference)/i,
    /^(who am i|what did i say|what did we talk about)/i,
    /^(save|store|note|noted|log|memo|bookmark)/i,
  ]
  if (personalPatterns.some(p => p.test(lower))) return false

  // Short conversational responses — don't search
  if (lower.length < 8 && !/\?/.test(message)) return false

  // Everything else — SEARCH
  // This includes:
  // - All questions (who, what, where, when, why, how)
  // - Factual queries (who won, what is, how many)
  // - Current events (news, scores, weather)
  // - Explanations and comparisons
  return true
}

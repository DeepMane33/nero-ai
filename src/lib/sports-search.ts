/**
 * Dedicated Sports Search for Nero AI
 *
 * Fetches actual match scores from ESPN API for:
 * - FIFA World Cup 2026
 * - IPL / Cricket
 * - NBA, NFL, and more
 *
 * Falls back to DuckDuckGo search for leagues not on ESPN.
 */

interface MatchInfo {
  sport: string
  league: string
  homeTeam: string
  awayTeam: string
  score: string
  status: string
  time: string
}

/* ------------------------------------------------------------------ */
/*  ESPN API helpers                                                    */
/* ------------------------------------------------------------------ */

async function fetchESPNScoreboard(sport: string): Promise<MatchInfo[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const matches: MatchInfo[] = []

    if (data.events) {
      for (const event of data.events) {
        const comp = event.competitions?.[0]
        if (!comp) continue

        const competitors = comp.competitors || []
        const teamA = competitors[0]
        const teamB = competitors[1]

        if (!teamA || !teamB) continue

        const scoreA = teamA.score || ''
        const scoreB = teamB.score || ''
        const score = scoreA && scoreB ? `${scoreA} - ${scoreB}` : 'Not started'

        matches.push({
          sport: sport.includes('cricket') ? 'Cricket' : sport.includes('basketball') ? 'Basketball' : 'Football',
          league: event.season?.slug || sport,
          homeTeam: teamA.team?.shortDisplayName || teamA.team?.displayName || 'TBD',
          awayTeam: teamB.team?.shortDisplayName || teamB.team?.displayName || 'TBD',
          score,
          status: event.status?.type?.description || 'Scheduled',
          time: event.date || '',
        })
      }
    }
    return matches
  } catch (err) {
    console.error(`[sports-search] ESPN ${sport} failed:`, err)
    return []
  }
}

async function fetchESPNStandings(sport: string): Promise<string> {
  try {
    const url = `https://site.api.espn.com/apis/v2/sports/${sport}/standings`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''

    const data = await res.json()
    let text = ''

    if (data.children) {
      for (const group of data.children.slice(0, 8)) {
        const groupName = group.name || 'Group'
        text += `${groupName}:\n`
        if (group.standings?.entries) {
          for (const entry of group.standings.entries.slice(0, 6)) {
            const team = entry.team?.shortDisplayName || entry.team?.displayName || 'Unknown'
            const stats = entry.stats || []
            const played = stats.find((s: any) => s.name === 'gamesPlayed')?.value || 0
            const won = stats.find((s: any) => s.name === 'wins')?.value || 0
            const drawn = stats.find((s: any) => s.name === 'draws')?.value || 0
            const lost = stats.find((s: any) => s.name === 'losses')?.value || 0
            const pts = stats.find((s: any) => s.name === 'points')?.value || 0
            text += `  ${team}: ${played}P ${won}W ${drawn}D ${lost}L ${pts}pts\n`
          }
        }
        text += '\n'
      }
    }
    return text
  } catch (err) {
    console.error(`[sports-search] ESPN standings failed:`, err)
    return ''
  }
}

/* ------------------------------------------------------------------ */
/*  DuckDuckGo fallback for leagues not on ESPN                        */
/* ------------------------------------------------------------------ */

async function fetchDDGSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''

    const html = await res.text()
    let text = ''

    // Extract results with snippets
    const regex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    let match
    let count = 0
    while ((match = regex.exec(html)) !== null && count < 5) {
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      const snippet = match[3].replace(/<[^>]*>/g, '').trim()
      if (title && snippet) {
        text += `• ${title}: ${snippet}\n`
        count++
      }
    }
    return text
  } catch (err) {
    console.error('[sports-search] DDG fallback failed:', err)
    return ''
  }
}

/* ------------------------------------------------------------------ */
/*  Sport detection                                                     */
/* ------------------------------------------------------------------ */

function detectSports(query: string): {
  isFIFA: boolean
  isCricket: boolean
  isNBA: boolean
  isNFL: boolean
  isLiveScores: boolean
  isStandings: boolean
} {
  const lower = query.toLowerCase()
  return {
    isFIFA: /\b(fifa|world cup|soccer|football)\b/i.test(lower) && !/\b(american|nfl)\b/i.test(lower),
    isCricket: /\b(ipl|cricket|t20|odi|test match|bcci|chennai|kolkata|mumbai|bangalore|hyderabad|rajasthan|delhi|punjab|gujarat|lucknow)\b/i.test(lower),
    isNBA: /\b(nba|basketball|lakers|celtics|warriors|nuggets)\b/i.test(lower),
    isNFL: /\b(nfl|american football|super bowl|patriots|chiefs|eagles)\b/i.test(lower),
    isLiveScores: /\b(live|score|result|who (won|is winning)|match|game|winner|champion)\b/i.test(lower),
    isStandings: /\b(standings|table|group|ranking|position|points table)\b/i.test(lower),
  }
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export async function getSportsContext(query: string): Promise<string> {
  const sports = detectSports(query)

  // No sports detected — skip
  if (!sports.isFIFA && !sports.isCricket && !sports.isNBA && !sports.isNFL) return ''

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  let context = `\n\n🏆 LIVE SPORTS DATA (as of ${now}):\n`

  // FIFA World Cup
  if (sports.isFIFA) {
    const matches = await fetchESPNScoreboard('soccer/fifa.world')
    if (matches.length > 0) {
      context += `\n⚽ FIFA WORLD CUP 2026 — TODAY'S MATCHES:\n`
      for (const m of matches) {
        context += `• ${m.homeTeam} vs ${m.awayTeam} — ${m.score} (${m.status})\n`
      }
    }
    if (sports.isStandings) {
      const standings = await fetchESPNStandings('soccer/fifa.world')
      if (standings) context += `\n${standings}`
    }
  }

  // Cricket / IPL
  if (sports.isCricket) {
    // ESPN cricket endpoint
    const cricketMatches = await fetchESPNScoreboard('cricket/ipl')
    if (cricketMatches.length > 0) {
      context += `\n🏏 IPL / CRICKET — LIVE MATCHES:\n`
      for (const m of cricketMatches) {
        context += `• ${m.homeTeam} vs ${m.awayTeam} — ${m.score} (${m.status})\n`
      }
    } else {
      // Fallback: search DuckDuckGo for IPL info
      const ddgQuery = sports.isLiveScores
        ? 'IPL 2026 winner champion result'
        : 'IPL 2026 schedule results'
      const ddgResults = await fetchDDGSearch(ddgQuery)
      if (ddgResults) {
        context += `\n🏏 IPL / CRICKET (from web):\n${ddgResults}\n`
      }
    }
  }

  // NBA
  if (sports.isNBA) {
    const matches = await fetchESPNScoreboard('basketball/nba')
    if (matches.length > 0) {
      context += `\n🏀 NBA — TODAY'S GAMES:\n`
      for (const m of matches) {
        context += `• ${m.homeTeam} vs ${m.awayTeam} — ${m.score} (${m.status})\n`
      }
    }
    if (sports.isStandings) {
      const standings = await fetchESPNStandings('basketball/nba')
      if (standings) context += `\n${standings}`
    }
  }

  // NFL
  if (sports.isNFL) {
    const matches = await fetchESPNScoreboard('football/nfl')
    if (matches.length > 0) {
      context += `\n🏈 NFL — TODAY'S GAMES:\n`
      for (const m of matches) {
        context += `• ${m.homeTeam} vs ${m.awayTeam} — ${m.score} (${m.status})\n`
      }
    }
  }

  context += `\n⚠️ Use the above LIVE DATA to answer. Never say "I don't have scores" when data is provided above. Give the user the actual facts.`

  return context
}

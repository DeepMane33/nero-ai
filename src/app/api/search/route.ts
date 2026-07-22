import { NextRequest } from 'next/server';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    // Try Wikipedia first (always works from Vercel)
    const wikiResults = await searchWikipedia(query);
    if (wikiResults.length > 0) {
      return Response.json({ results: wikiResults });
    }

    // Fallback to DuckDuckGo
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // DuckDuckGo blocked — return empty with helpful message
      return Response.json({ results: [], info: 'Search unavailable. Try asking in chat for web results.' });
    }

    const html = await response.text();
    const results = parseResults(html);

    return Response.json({ results });
  } catch (err: any) {
    console.error('Search error:', err);
    return Response.json({ results: [], info: 'Search temporarily unavailable.' });
  }
}

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=8`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const results: SearchResult[] = [];
    if (data.query?.search) {
      for (const item of data.query.search) {
        results.push({
          title: item.title,
          snippet: item.snippet?.replace(/<[^>]*>/g, '') || '',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function parseResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
    let rawUrl = match[1].trim();
    let title = match[2].replace(/<[^>]*>/g, '').trim();
    let snippet = match[3].replace(/<[^>]*>/g, '').trim();

    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      rawUrl = decodeURIComponent(uddgMatch[1]);
    }

    if (title && rawUrl) {
      results.push({ title, url: rawUrl, snippet });
    }
  }

  return results;
}

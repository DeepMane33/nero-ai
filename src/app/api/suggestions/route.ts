import { NextRequest } from 'next/server';
import { generateSuggestions, getDashboardSuggestions, type Suggestion } from '@/lib/suggestions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'all';

    let suggestions: Suggestion[]

    if (type === 'dashboard') {
      suggestions = getDashboardSuggestions()
    } else {
      suggestions = generateSuggestions()
    }

    return Response.json({ suggestions })
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to generate suggestions' }, { status: 500 })
  }
}

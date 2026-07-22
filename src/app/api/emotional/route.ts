import { NextRequest } from 'next/server';
import { getEmotionalTrends, detectMoodShift, getEmotionalInsights, getMoodSuggestions } from '@/lib/emotional-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');
    const mood = searchParams.get('mood');
    const days = parseInt(searchParams.get('days') || '7', 10);

    if (action === 'trends') {
      const trends = getEmotionalTrends(days);
      return Response.json({ trends });
    }

    if (action === 'shift') {
      const shift = detectMoodShift();
      return Response.json({ shift });
    }

    if (action === 'insights') {
      const insights = getEmotionalInsights();
      return Response.json({ insights });
    }

    if (action === 'suggestions' && mood) {
      const suggestions = getMoodSuggestions(mood);
      return Response.json({ suggestions });
    }

    // Default: return all emotional data
    const trends = getEmotionalTrends(7);
    const shift = detectMoodShift();
    const insights = getEmotionalInsights();

    return Response.json({ trends, shift, insights });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to get emotional data' }, { status: 500 });
  }
}

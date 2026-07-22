import { NextRequest } from 'next/server';
import { searchMessages, getConversations, getUserId } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { query, limit } = await request.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    const messages = searchMessages(query, userId);
    const allConversations = getConversations(userId);
    const conversations = allConversations
      .filter(c => c.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit || 50);

    return Response.json({ conversations, messages });
  } catch (error) {
    console.error('Error searching:', error);
    return Response.json({ error: 'Failed to search' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { createKnowledgeEdge } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sourceId, targetId, label, weight } = await request.json();

    if (!sourceId || !targetId) {
      return Response.json({ error: 'sourceId and targetId are required' }, { status: 400 });
    }

    const edge = await createKnowledgeEdge(sourceId, targetId, label || 'related_to', weight ?? 1);
    return Response.json({ edge });
  } catch (error) {
    console.error('Error creating knowledge edge:', error);
    return Response.json({ error: 'Failed to create knowledge edge' }, { status: 500 });
  }
}

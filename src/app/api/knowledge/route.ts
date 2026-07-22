import { NextRequest } from 'next/server';
import { getKnowledgeGraph, createKnowledgeNode, deleteKnowledgeNode, deleteKnowledgeEdge, getUserId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const graph = getKnowledgeGraph(userId);
    return Response.json(graph);
  } catch (error) {
    console.error('Error fetching knowledge graph:', error);
    return Response.json({ error: 'Failed to fetch knowledge graph' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { label, type, description, metadata } = await request.json();

    if (!label || !type) {
      return Response.json({ error: 'label and type are required' }, { status: 400 });
    }

    const node = createKnowledgeNode(label, type, description || '', userId);
    return Response.json({ node });
  } catch (error) {
    console.error('Error creating knowledge node:', error);
    return Response.json({ error: 'Failed to create knowledge node' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { type, id } = await request.json();

    if (!type || !id) {
      return Response.json({ error: 'type and id are required' }, { status: 400 });
    }

    if (type === 'node') {
      deleteKnowledgeNode(id, userId);
    } else if (type === 'edge') {
      deleteKnowledgeEdge(id, userId);
    } else {
      return Response.json({ error: 'type must be "node" or "edge"' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting from knowledge graph:', error);
    return Response.json({ error: 'Failed to delete from knowledge graph' }, { status: 500 });
  }
}

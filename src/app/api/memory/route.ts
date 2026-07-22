import { NextRequest } from 'next/server';
import { createMemory, getMemoriesByCategory, searchMemories, getAllMemories, updateMemory, deleteMemory, deleteMemories, clearConversations, getUserId } from '@/lib/db';
import { consolidateMemories, shouldConsolidate, getConsolidationStats } from '@/lib/memory-consolidation';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('q') || undefined;
    const action = searchParams.get('action');

    if (action === 'consolidation-status') {
      const status = shouldConsolidate();
      const stats = getConsolidationStats();
      return Response.json({ status, stats });
    }

    let memories;
    if (search) {
      memories = searchMemories(search, 100, userId);
    } else if (category) {
      memories = getMemoriesByCategory(category, userId);
    } else {
      memories = getAllMemories(userId);
    }
    return Response.json({ memories });
  } catch (err: any) {
    console.error('Memory GET error:', err);
    return Response.json({ error: err.message || 'Failed to list memories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();

    if (body.action === 'consolidate') {
      const result = consolidateMemories();
      return Response.json({ result });
    }

    const { category, key, value, confidence } = body;

    if (!category || !key || !value) {
      return Response.json({ error: 'category, key, and value are required' }, { status: 400 });
    }

    const memory = createMemory(category, key, value, userId);
    return Response.json({ memory }, { status: 201 });
  } catch (err: any) {
    console.error('Memory POST error:', err);
    return Response.json({ error: err.message || 'Failed to add memory' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { id, category, key, value, confidence } = await request.json();

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const memory = updateMemory(id, { category, key, value, confidence }, userId);
    if (!memory) {
      return Response.json({ error: 'Memory not found' }, { status: 404 });
    }

    return Response.json({ memory });
  } catch (err: any) {
    console.error('Memory PUT error:', err);
    return Response.json({ error: err.message || 'Failed to update memory' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        // Handle "type" based clear all
        if (body.type === 'conversations') {
          clearConversations(userId)
          return Response.json({ success: true, message: 'All conversations cleared' });
        }
        if (body.type === 'memories') {
          deleteMemories(userId)
          return Response.json({ success: true, message: 'All memories cleared' });
        }
        if (body.id) {
          const deleted = deleteMemory(body.id, userId);
          if (!deleted) return Response.json({ error: 'Memory not found' }, { status: 404 });
          return Response.json({ success: true });
        }
      } catch {}
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const deleted = deleteMemory(id, userId);
    if (!deleted) {
      return Response.json({ error: 'Memory not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Memory DELETE error:', err);
    return Response.json({ error: err.message || 'Failed to delete memory' }, { status: 500 });
  }
}

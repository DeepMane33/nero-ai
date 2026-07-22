import { NextRequest } from 'next/server';
import { getConversations, updateConversation, deleteConversation, getUserId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const conversations = getConversations(userId);
    return Response.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { id, title, is_pinned, folder, summary } = body;

    if (!id) {
      return Response.json({ error: 'Conversation id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    if (folder !== undefined) updates.folder = folder;
    if (summary !== undefined) updates.summary = summary;

    const conversation = updateConversation(id, updates, userId);
    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return Response.json({ conversation });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return Response.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      let body: { id?: string } = {};
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Conversation id is required' }, { status: 400 });
      }
      if (!body.id) {
        return Response.json({ error: 'Conversation id is required' }, { status: 400 });
      }
      deleteConversation(body.id, userId);
      return Response.json({ success: true });
    }

    deleteConversation(id, userId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

import { getMessages, getMessage, deleteMessage, getUserId } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');

    if (!conversationId) {
      return Response.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const messages = getMessages(conversationId, userId);
    return Response.json({ messages });
  } catch (error: any) {
    console.error('Messages GET error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = getUserId(request);
    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const success = deleteMessage(id, userId);
    return Response.json({ success });
  } catch (error: any) {
    console.error('Messages DELETE error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

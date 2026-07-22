import { NextRequest } from 'next/server';
import { getConversationFolders } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const folders = await getConversationFolders();
    return Response.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return Response.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

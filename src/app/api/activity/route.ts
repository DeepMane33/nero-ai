import { NextRequest } from 'next/server';
import { getActivity, logActivity, getUserId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const activities = getActivity(limit, userId);
    return Response.json({ activities });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return Response.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { type, title, description, entityType, entityId } = await request.json();

    if (!type || !title) {
      return Response.json({ error: 'type and title are required' }, { status: 400 });
    }

    const activity = logActivity(
      type,
      title,
      description || '',
      entityType || undefined,
      entityId || undefined,
      undefined,
      userId
    );
    return Response.json({ activity });
  } catch (error) {
    console.error('Error logging activity:', error);
    return Response.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}

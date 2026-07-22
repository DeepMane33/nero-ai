import { NextRequest } from 'next/server';
import { setPreference, getPreference, getAllPreferences, deletePreference } from '@/lib/db';

export async function GET() {
  try {
    const preferences = getAllPreferences();
    return Response.json({ preferences });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to list preferences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value, confidence, source } = await request.json();

    if (!key || !value) {
      return Response.json({ error: 'key and value are required' }, { status: 400 });
    }

    const pref = setPreference(key, value, confidence ?? 0.5, source ?? 'user');
    return Response.json({ preference: pref }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to set preference' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const key = searchParams.get('key');

    if (!key) {
      return Response.json({ error: 'key is required' }, { status: 400 });
    }

    const deleted = deletePreference(key);
    if (!deleted) {
      return Response.json({ error: 'Preference not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to delete preference' }, { status: 500 });
  }
}

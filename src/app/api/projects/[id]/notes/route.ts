import { NextRequest } from 'next/server';
import { getProjectNotes, createProjectNote, updateProjectNote, deleteProjectNote } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notes = await getProjectNotes(id);
    return Response.json({ notes });
  } catch (error) {
    console.error('Error fetching project notes:', error);
    return Response.json({ error: 'Failed to fetch project notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, content } = await request.json();

    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    const note = await createProjectNote(id, title, content || '');
    return Response.json({ note });
  } catch (error) {
    console.error('Error creating project note:', error);
    return Response.json({ error: 'Failed to create project note' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return Response.json({ error: 'Note id is required' }, { status: 400 });
    }

    const note = await updateProjectNote(id, updates);
    return Response.json({ note });
  } catch (error) {
    console.error('Error updating project note:', error);
    return Response.json({ error: 'Failed to update project note' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json();
      id = body.id;
    }

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteProjectNote(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project note:', error);
    return Response.json({ error: 'Failed to delete project note' }, { status: 500 });
  }
}

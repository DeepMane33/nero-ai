import { NextRequest } from 'next/server';
import { getProjectFiles, createProjectFile, updateProjectFile, deleteProjectFile } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const files = await getProjectFiles(id);
    return Response.json({ files });
  } catch (error) {
    console.error('Error fetching project files:', error);
    return Response.json({ error: 'Failed to fetch project files' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, path, content, language } = await request.json();

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const file = await createProjectFile(id, name, path || '', content || '', language || 'text');
    return Response.json({ file });
  } catch (error) {
    console.error('Error creating project file:', error);
    return Response.json({ error: 'Failed to create project file' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return Response.json({ error: 'File id is required' }, { status: 400 });
    }

    const file = await updateProjectFile(id, updates);
    return Response.json({ file });
  } catch (error) {
    console.error('Error updating project file:', error);
    return Response.json({ error: 'Failed to update project file' }, { status: 500 });
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

    await deleteProjectFile(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project file:', error);
    return Response.json({ error: 'Failed to delete project file' }, { status: 500 });
  }
}

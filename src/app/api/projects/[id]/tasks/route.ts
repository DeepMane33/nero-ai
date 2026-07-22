import { NextRequest } from 'next/server';
import { getProjectTasks, createProjectTask, updateProjectTask, deleteProjectTask } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tasks = await getProjectTasks(id);
    return Response.json({ tasks });
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    return Response.json({ error: 'Failed to fetch project tasks' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, description, priority, dueDate } = await request.json();

    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    const task = await createProjectTask(
      id,
      title,
      description || '',
      priority || 'medium',
      dueDate || null
    );
    return Response.json({ task });
  } catch (error) {
    console.error('Error creating project task:', error);
    return Response.json({ error: 'Failed to create project task' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return Response.json({ error: 'Task id is required' }, { status: 400 });
    }

    const task = await updateProjectTask(id, updates);
    return Response.json({ task });
  } catch (error) {
    console.error('Error updating project task:', error);
    return Response.json({ error: 'Failed to update project task' }, { status: 500 });
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

    await deleteProjectTask(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project task:', error);
    return Response.json({ error: 'Failed to delete project task' }, { status: 500 });
  }
}

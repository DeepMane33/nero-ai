import { NextRequest } from 'next/server';
import { getProjects, createProject, updateProject, deleteProject, getUserId, logActivity } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const projects = getProjects(userId);
    return Response.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { name, description, color } = await request.json();

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const project = createProject(name, description || '', color || '#b0b8c4', userId);
    logActivity('project', 'Project created', `${name}${description ? ': ' + description : ''}`, 'project', project.id, undefined, userId);
    return Response.json({ project });
  } catch (error) {
    console.error('Error creating project:', error);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const project = await updateProject(id, updates);
    return Response.json({ project });
  } catch (error) {
    console.error('Error updating project:', error);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }
    }

    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteProject(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

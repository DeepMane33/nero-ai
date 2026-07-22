/**
 * Client-side projects storage using localStorage.
 * All data stays in the browser — no server-side persistence.
 */

const PROJECTS_KEY = 'nero-projects'
const PROJECT_FILES_KEY = 'nero-project-files'
const PROJECT_NOTES_KEY = 'nero-project-notes'
const PROJECT_TASKS_KEY = 'nero-project-tasks'

export interface Project {
  id: string
  name: string
  description?: string
  color?: string
  status: string
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  path: string
  content: string
  is_directory?: boolean
  created_at: string
  updated_at: string
}

export interface ProjectNote {
  id: string
  project_id: string
  title: string
  content: string
  is_pinned: number
  created_at: string
  updated_at: string
}

export interface ProjectTask {
  id: string
  project_id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------------------ */
/*  Generic localStorage helpers                                       */
/* ------------------------------------------------------------------ */

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeJson<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

function genId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* ------------------------------------------------------------------ */
/*  Projects                                                           */
/* ------------------------------------------------------------------ */

export function getProjects(): Project[] {
  return readJson<Project>(PROJECTS_KEY)
}

export function getProject(id: string): Project | undefined {
  return getProjects().find(p => p.id === id)
}

export function createProject(name: string, description: string, color: string): Project {
  const now = new Date().toISOString()
  const project: Project = {
    id: genId(),
    name,
    description,
    color,
    status: 'active',
    created_at: now,
    updated_at: now,
  }
  const all = getProjects()
  all.unshift(project)
  writeJson(PROJECTS_KEY, all)
  return project
}

export function updateProject(id: string, updates: Partial<Project>): Project | undefined {
  const all = getProjects()
  const idx = all.findIndex(p => p.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() }
  writeJson(PROJECTS_KEY, all)
  return all[idx]
}

export function deleteProject(id: string): boolean {
  const all = getProjects()
  const filtered = all.filter(p => p.id !== id)
  if (filtered.length === all.length) return false
  writeJson(PROJECTS_KEY, filtered)
  // Also clean up files, notes, tasks for this project
  writeJson(PROJECT_FILES_KEY, readJson<ProjectFile>(PROJECT_FILES_KEY).filter(f => f.project_id !== id))
  writeJson(PROJECT_NOTES_KEY, readJson<ProjectNote>(PROJECT_NOTES_KEY).filter(n => n.project_id !== id))
  writeJson(PROJECT_TASKS_KEY, readJson<ProjectTask>(PROJECT_TASKS_KEY).filter(t => t.project_id !== id))
  return true
}

/* ------------------------------------------------------------------ */
/*  Project Files                                                      */
/* ------------------------------------------------------------------ */

export function getProjectFiles(projectId: string): ProjectFile[] {
  return readJson<ProjectFile>(PROJECT_FILES_KEY).filter(f => f.project_id === projectId)
}

export function createProjectFile(projectId: string, name: string, content: string): ProjectFile {
  const now = new Date().toISOString()
  const file: ProjectFile = {
    id: genId(),
    project_id: projectId,
    name,
    path: '/' + name,
    content,
    created_at: now,
    updated_at: now,
  }
  const all = readJson<ProjectFile>(PROJECT_FILES_KEY)
  all.push(file)
  writeJson(PROJECT_FILES_KEY, all)
  return file
}

export function updateProjectFile(id: string, content: string): ProjectFile | undefined {
  const all = readJson<ProjectFile>(PROJECT_FILES_KEY)
  const idx = all.findIndex(f => f.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], content, updated_at: new Date().toISOString() }
  writeJson(PROJECT_FILES_KEY, all)
  return all[idx]
}

export function deleteProjectFile(id: string): boolean {
  const all = readJson<ProjectFile>(PROJECT_FILES_KEY)
  const filtered = all.filter(f => f.id !== id)
  if (filtered.length === all.length) return false
  writeJson(PROJECT_FILES_KEY, filtered)
  return true
}

/* ------------------------------------------------------------------ */
/*  Project Notes                                                      */
/* ------------------------------------------------------------------ */

export function getProjectNotes(projectId: string): ProjectNote[] {
  return readJson<ProjectNote>(PROJECT_NOTES_KEY).filter(n => n.project_id === projectId)
}

export function createProjectNote(projectId: string, title: string, content: string): ProjectNote {
  const now = new Date().toISOString()
  const note: ProjectNote = {
    id: genId(),
    project_id: projectId,
    title,
    content,
    is_pinned: 0,
    created_at: now,
    updated_at: now,
  }
  const all = readJson<ProjectNote>(PROJECT_NOTES_KEY)
  all.push(note)
  writeJson(PROJECT_NOTES_KEY, all)
  return note
}

export function updateProjectNote(id: string, title: string, content: string): ProjectNote | undefined {
  const all = readJson<ProjectNote>(PROJECT_NOTES_KEY)
  const idx = all.findIndex(n => n.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], title, content, updated_at: new Date().toISOString() }
  writeJson(PROJECT_NOTES_KEY, all)
  return all[idx]
}

export function deleteProjectNote(id: string): boolean {
  const all = readJson<ProjectNote>(PROJECT_NOTES_KEY)
  const filtered = all.filter(n => n.id !== id)
  if (filtered.length === all.length) return false
  writeJson(PROJECT_NOTES_KEY, filtered)
  return true
}

/* ------------------------------------------------------------------ */
/*  Project Tasks                                                      */
/* ------------------------------------------------------------------ */

export function getProjectTasks(projectId: string): ProjectTask[] {
  return readJson<ProjectTask>(PROJECT_TASKS_KEY).filter(t => t.project_id === projectId)
}

export function createProjectTask(
  projectId: string,
  title: string,
  description: string,
  status: string,
  priority: string
): ProjectTask {
  const now = new Date().toISOString()
  const task: ProjectTask = {
    id: genId(),
    project_id: projectId,
    title,
    description,
    status,
    priority,
    created_at: now,
    updated_at: now,
  }
  const all = readJson<ProjectTask>(PROJECT_TASKS_KEY)
  all.push(task)
  writeJson(PROJECT_TASKS_KEY, all)
  return task
}

export function updateProjectTask(id: string, updates: Partial<ProjectTask>): ProjectTask | undefined {
  const all = readJson<ProjectTask>(PROJECT_TASKS_KEY)
  const idx = all.findIndex(t => t.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() }
  writeJson(PROJECT_TASKS_KEY, all)
  return all[idx]
}

export function deleteProjectTask(id: string): boolean {
  const all = readJson<ProjectTask>(PROJECT_TASKS_KEY)
  const filtered = all.filter(t => t.id !== id)
  if (filtered.length === all.length) return false
  writeJson(PROJECT_TASKS_KEY, filtered)
  return true
}

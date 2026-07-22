/**
 * Coding Agent Orchestrator for Nero AI
 * 
 * High-level coding task orchestration combining:
 * - Code execution
 * - File operations
 * - Terminal commands
 * - Project management
 */

import { executeCode, ExecutionResult } from '@/lib/sandbox'
import { performFileOperation, FileOperationResult, FileTree } from '@/lib/file-operations'
import { executeCommand, TerminalResult, createSession } from '@/lib/terminal'
import { detectProjectType, startProject, stopProject, ProjectConfig, ProjectProcess, getProjectConfig } from '@/lib/project-runner'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CodingTask {
  type: 'execute' | 'write_file' | 'read_file' | 'list_files' | 'terminal' | 'create_project' | 'run_project' | 'stop_project' | 'search_files'
  description: string
  language?: string
  code?: string
  filePath?: string
  content?: string
  command?: string
  projectPath?: string
  searchPattern?: string
  options?: Record<string, unknown>
}

export interface CodingResult {
  success: boolean
  output: string
  data?: unknown
  filesCreated?: string[]
  filesModified?: string[]
  executionResult?: ExecutionResult
  suggestions?: string[]
}

/* ------------------------------------------------------------------ */
/*  Main Task Processor                                                */
/* ------------------------------------------------------------------ */

export async function processCodingTask(
  task: CodingTask,
  conversationId?: string
): Promise<CodingResult> {
  try {
    switch (task.type) {
      case 'execute':
        return await handleExecute(task)
      
      case 'write_file':
        return await handleWriteFile(task)
      
      case 'read_file':
        return await handleReadFile(task)
      
      case 'list_files':
        return await handleListFiles(task)
      
      case 'terminal':
        return await handleTerminal(task)
      
      case 'create_project':
        return await handleCreateProject(task)
      
      case 'run_project':
        return await handleRunProject(task)
      
      case 'stop_project':
        return await handleStopProject(task)
      
      case 'search_files':
        return await handleSearchFiles(task)
      
      default:
        return {
          success: false,
          output: `Unknown task type: ${task.type}`,
        }
    }
  } catch (err: any) {
    return {
      success: false,
      output: `Error: ${err.message}`,
      suggestions: ['Try simplifying your request', 'Check if the file path is correct'],
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Task Handlers                                                      */
/* ------------------------------------------------------------------ */

async function handleExecute(task: CodingTask): Promise<CodingResult> {
  if (!task.code || !task.language) {
    return { success: false, output: 'Code and language are required' }
  }

  const result = await executeCode(task.code, task.language, {
    timeout: (task.options?.timeout as number) || 30000,
    workingDir: task.options?.workingDir as string,
  })

  return {
    success: result.success,
    output: result.output || result.error || 'No output',
    executionResult: result,
    suggestions: result.success ? [] : [
      'Check for syntax errors',
      'Verify all variables are defined',
      'Ensure required packages are installed',
    ],
  }
}

async function handleWriteFile(task: CodingTask): Promise<CodingResult> {
  if (!task.filePath || task.content === undefined) {
    return { success: false, output: 'File path and content are required' }
  }

  const result = await performFileOperation('write', task.filePath, task.content)

  return {
    success: result.success,
    output: result.success ? `File written successfully: ${task.filePath}` : result.error || 'Write failed',
    filesCreated: result.success ? [task.filePath] : undefined,
  }
}

async function handleReadFile(task: CodingTask): Promise<CodingResult> {
  if (!task.filePath) {
    return { success: false, output: 'File path is required' }
  }

  const result = await performFileOperation('read', task.filePath)

  return {
    success: result.success,
    output: result.success ? (result.result as string) : result.error || 'Read failed',
    data: result.result,
  }
}

async function handleListFiles(task: CodingTask): Promise<CodingResult> {
  const result = await performFileOperation('list', task.filePath || '.', undefined, {
    recursive: task.options?.recursive as boolean,
  })

  if (!result.success) {
    return { success: false, output: result.error || 'List failed' }
  }

  const tree = result.result as FileTree[]
  const formatted = formatFileTree(tree)

  return {
    success: true,
    output: formatted,
    data: tree,
  }
}

async function handleTerminal(task: CodingTask): Promise<CodingResult> {
  if (!task.command) {
    return { success: false, output: 'Command is required' }
  }

  const result = await executeCommand({
    command: task.command,
    workingDir: task.options?.workingDir as string,
    timeout: (task.options?.timeout as number) || 30000,
  })

  return {
    success: result.success,
    output: result.output || result.error || 'No output',
    suggestions: result.success ? [] : [
      'Check command syntax',
      'Ensure required tools are installed',
      'Verify working directory',
    ],
  }
}

async function handleCreateProject(task: CodingTask): Promise<CodingResult> {
  if (!task.projectPath || !task.language) {
    return { success: false, output: 'Project path and language are required' }
  }

  // Sanitize project path to prevent shell injection — only allow safe characters
  const safePath = task.projectPath.replace(/[^a-zA-Z0-9_\-./\\: ]/g, '')
  if (!safePath || safePath !== task.projectPath) {
    return { success: false, output: 'Invalid project path: only alphanumeric characters, hyphens, underscores, dots, slashes, and spaces are allowed' }
  }

  const projectTemplates: Record<string, string> = {
    nextjs: `npx create-next-app@latest "${safePath}" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`,
    react: `npx create-vite@latest "${safePath}" --template react-ts`,
    python: `mkdir -p "${safePath}" && cd "${safePath}" && python -m venv venv && echo "# ${safePath}" > README.md`,
    node: `mkdir -p "${safePath}" && cd "${safePath}" && npm init -y`,
  }

  const template = projectTemplates[task.language] || projectTemplates.node
  const result = await executeCommand({
    command: template,
    timeout: 120000, // 2 minutes for project creation
  })

  return {
    success: result.success,
    output: result.output || result.error || 'Project created',
    filesCreated: result.success ? [safePath] : undefined,
    suggestions: result.success ? [
      `cd ${safePath}`,
      'Install dependencies if needed',
      'Start development server',
    ] : [],
  }
}

async function handleRunProject(task: CodingTask): Promise<CodingResult> {
  if (!task.projectPath) {
    return { success: false, output: 'Project path is required' }
  }

  const config = await getProjectConfig(task.projectPath)
  const project = await startProject(config)

  return {
    success: project.status === 'running',
    output: project.status === 'running'
      ? `Project started!\nType: ${config.type}\nPort: ${config.port}\nURL: http://localhost:${config.port}\nProject ID: ${project.id}`
      : `Failed to start: ${project.error}`,
    data: { projectId: project.id, port: config.port },
    suggestions: project.status === 'running' ? [
      `Open http://localhost:${config.port} in your browser`,
      `Use project ID ${project.id} to manage the project`,
    ] : [
      'Check if dependencies are installed',
      'Verify the start command in package.json',
      'Check for port conflicts',
    ],
  }
}

async function handleStopProject(task: CodingTask): Promise<CodingResult> {
  if (!task.projectPath) {
    return { success: false, output: 'Project ID is required' }
  }

  const stopped = await stopProject(task.projectPath)

  return {
    success: stopped,
    output: stopped ? 'Project stopped' : 'Project not found or already stopped',
  }
}

async function handleSearchFiles(task: CodingTask): Promise<CodingResult> {
  if (!task.searchPattern) {
    return { success: false, output: 'Search pattern is required' }
  }

  const result = await performFileOperation('search', task.filePath || '.', undefined, {
    pattern: task.searchPattern,
  })

  if (!result.success) {
    return { success: false, output: result.error || 'Search failed' }
  }

  const files = result.result as FileTree[]
  const formatted = files.map(f => `${f.type === 'directory' ? '📁' : '📄'} ${f.path}`).join('\n')

  return {
    success: true,
    output: files.length > 0 ? `Found ${files.length} matches:\n${formatted}` : 'No files found',
    data: files,
  }
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

function formatFileTree(tree: FileTree[], indent: number = 0): string {
  const lines: string[] = []
  const prefix = '  '.repeat(indent)
  
  for (const item of tree) {
    const icon = item.type === 'directory' ? '📁' : '📄'
    const size = item.size ? ` (${formatSize(item.size)})` : ''
    lines.push(`${prefix}${icon} ${item.name}${size}`)
    
    if (item.children && item.children.length > 0) {
      lines.push(formatFileTree(item.children, indent + 1))
    }
  }
  
  return lines.join('\n')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/* ------------------------------------------------------------------ */
/*  Exports                                                             */
/* ------------------------------------------------------------------ */

export type { ExecutionResult, TerminalResult, ProjectConfig, ProjectProcess }

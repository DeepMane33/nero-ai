/**
 * Tool Executor — executes tool calls and returns results.
 * Each tool maps to existing functionality in the Nero codebase.
 */

import { searchWeb } from '@/lib/web-search'
import { getWeather } from '@/lib/free-apis'
import { createMemory, searchMemories, getKnowledgeNodes, getKnowledgeEdges, createProjectTask, getProjectTasks, updateProjectTask, logCodeExecution, logFileOperation } from '@/lib/db'
import { logToolCall } from '@/lib/db'
import { fetchPageContent } from '@/lib/web-search'
import { executeCode } from '@/lib/sandbox'
import { performFileOperation } from '@/lib/file-operations'
import { executeCommand } from '@/lib/terminal'
import { processCodingTask } from '@/core/coding-agent'

export interface ToolResult {
  success: boolean
  result: string
  error?: string
}

/**
 * Execute a tool call and return the result.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  conversationId?: string
): Promise<ToolResult> {
  try {
    let result: string

    switch (toolName) {
      case 'search_web':
        result = await executeSearchWeb(params)
        break
      case 'get_weather':
        result = await executeGetWeather(params)
        break
      case 'manage_task':
        result = await executeManageTask(params)
        break
      case 'save_memory':
        result = await executeSaveMemory(params)
        break
      case 'get_memory':
        result = await executeGetMemory(params)
        break
      case 'knowledge_search':
        result = await executeKnowledgeSearch(params)
        break
      case 'read_url':
        result = await executeReadUrl(params)
        break
      case 'execute_code':
        result = await executeCodeTool(params, conversationId)
        break
      case 'read_file':
        result = await executeReadFile(params)
        break
      case 'write_file':
        result = await executeWriteFile(params, conversationId)
        break
      case 'list_files':
        result = await executeListFiles(params)
        break
      case 'search_files':
        result = await executeSearchFiles(params)
        break
      case 'run_terminal':
        result = await executeTerminalCommand(params)
        break
      case 'run_project':
        result = await executeRunProject(params)
        break
      case 'stop_project':
        result = await executeStopProject(params)
        break
      default:
        return { success: false, result: '', error: `Unknown tool: ${toolName}` }
    }

    // Log the tool call
    logToolCall(toolName, params, result.slice(0, 500), true, conversationId)

    return { success: true, result }
  } catch (error: any) {
    const errorMsg = error?.message || 'Tool execution failed'
    logToolCall(toolName, params, errorMsg, false, conversationId)
    return { success: false, result: '', error: errorMsg }
  }
}

/* ------------------------------------------------------------------ */
/*  Tool implementations                                               */
/* ------------------------------------------------------------------ */

async function executeSearchWeb(params: Record<string, unknown>): Promise<string> {
  const query = params.query as string
  if (!query) throw new Error('query parameter is required')

  const results = await searchWeb(query)
  if (!results || results.length === 0) {
    return `No results found for "${query}".`
  }

  return results
    .slice(0, 5)
    .map((r: any, i: number) => `[${i + 1}] ${r.title}\n    ${r.snippet}\n    URL: ${r.url}`)
    .join('\n\n')
}

async function executeGetWeather(params: Record<string, unknown>): Promise<string> {
  const location = params.location as string
  if (!location) throw new Error('location parameter is required')

  const weather = await getWeather(location)
  if (!weather) {
    return `Could not get weather for "${location}".`
  }

  return `${weather.icon} Weather in ${weather.location}:\n${weather.description}\nTemperature: ${weather.temp}°C (feels like ${weather.feelsLike}°C)\nHumidity: ${weather.humidity}%\nWind: ${weather.windSpeed} km/h`
}

async function executeManageTask(params: Record<string, unknown>): Promise<string> {
  const action = params.action as string

  switch (action) {
    case 'create': {
      const title = params.title as string
      if (!title) throw new Error('title is required for creating a task')
      const task = createProjectTask(
        (params.project_id as string) || 'default',
        title,
        (params.description as string) || '',
        (params.priority as string) || 'medium'
      )
      return `Task created: "${task.title}" (ID: ${task.id}, Priority: ${task.priority})`
    }

    case 'list': {
      const projectId = (params.project_id as string) || 'default'
      const tasks = getProjectTasks(projectId)
      if (tasks.length === 0) return 'No tasks found.'
      return tasks
        .map(t => `- [${t.status}] ${t.title} (${t.priority})`)
        .join('\n')
    }

    case 'update': {
      const taskId = params.id as string
      if (!taskId) throw new Error('id is required for updating a task')
      const updates: Record<string, string> = {}
      if (params.status) updates.status = params.status as string
      if (params.title) updates.title = params.title as string
      if (params.priority) updates.priority = params.priority as string
      const task = updateProjectTask(taskId, updates)
      if (!task) return `Task ${taskId} not found.`
      return `Task updated: "${task.title}" (Status: ${task.status}, Priority: ${task.priority})`
    }

    default:
      throw new Error(`Unknown task action: ${action}`)
  }
}

async function executeSaveMemory(params: Record<string, unknown>): Promise<string> {
  const category = params.category as string
  const key = params.key as string
  const value = params.value as string

  if (!category || !key || !value) {
    throw new Error('category, key, and value are required')
  }

  createMemory(category, key, value)
  return `Memory saved: [${category}] ${key}: ${value}`
}

async function executeGetMemory(params: Record<string, unknown>): Promise<string> {
  const query = params.query as string
  if (!query) throw new Error('query parameter is required')

  const memories = searchMemories(query, 10)
  if (memories.length === 0) {
    return `No memories found matching "${query}".`
  }

  return memories
    .map(m => `- [${m.category}] ${m.key}: ${m.value}`)
    .join('\n')
}

async function executeKnowledgeSearch(params: Record<string, unknown>): Promise<string> {
  const query = (params.query as string)?.toLowerCase() || ''
  if (!query) throw new Error('query parameter is required')

  const nodes = getKnowledgeNodes(500)
  const edges = getKnowledgeEdges(1000)

  // Find matching nodes
  const matchingNodes = nodes.filter(n =>
    n.label.toLowerCase().includes(query) ||
    n.description.toLowerCase().includes(query)
  ).slice(0, 10)

  if (matchingNodes.length === 0) {
    return `No knowledge found matching "${query}".`
  }

  // Find edges connected to matching nodes
  const nodeIds = new Set(matchingNodes.map(n => n.id))
  const connectedEdges = edges.filter(e =>
    nodeIds.has(e.source_id) || nodeIds.has(e.target_id)
  ).slice(0, 20)

  const parts = matchingNodes.map(n => `- ${n.label} (${n.type}): ${n.description}`)
  if (connectedEdges.length > 0) {
    parts.push('\nConnections:')
    for (const edge of connectedEdges.slice(0, 10)) {
      const source = nodes.find(n => n.id === edge.source_id)
      const target = nodes.find(n => n.id === edge.target_id)
      if (source && target) {
        parts.push(`  - ${source.label} → [${edge.label}] → ${target.label}`)
      }
    }
  }

  return parts.join('\n')
}

async function executeReadUrl(params: Record<string, unknown>): Promise<string> {
  const url = params.url as string
  if (!url) throw new Error('url parameter is required')

  const content = await fetchPageContent(url)
  if (!content) {
    return `Could not read content from "${url}".`
  }

  // Truncate to reasonable length
  const truncated = content.length > 2000 ? content.slice(0, 2000) + '...' : content
  return `Content from ${url}:\n\n${truncated}`
}

/* ──── Coding Agent Tool Implementations ──── */

async function executeCodeTool(params: Record<string, unknown>, conversationId?: string): Promise<string> {
  const code = params.code as string
  const language = params.language as string
  if (!code || !language) throw new Error('code and language parameters are required')

  const result = await executeCode(code, language, {
    timeout: (params.timeout as number) || 30000,
  })

  // Log the execution
  try {
    logCodeExecution(
      language,
      code,
      result.output,
      result.error,
      result.exitCode,
      result.executionTime,
      result.success ? 'success' : 'error',
      conversationId
    )
  } catch (logErr) {
    console.warn('[tool-executor] Code execution logging failed:', logErr)
  }

  if (result.success) {
    return `Code executed successfully (${result.executionTime}ms):\n\n${result.output}`
  } else {
    return `Code execution failed (exit code ${result.exitCode}):\n\n${result.error || result.output}`
  }
}

async function executeReadFile(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string
  if (!filePath) throw new Error('path parameter is required')

  const result = await performFileOperation('read', filePath)
  if (!result.success) {
    return `Could not read file: ${result.error}`
  }

  // Log the operation
  try {
    logFileOperation('read', filePath, true)
  } catch {}

  const content = result.result as string
  const truncated = content.length > 5000 ? content.slice(0, 5000) + '\n... (truncated)' : content
  return `File: ${filePath}\n\n${truncated}`
}

async function executeWriteFile(params: Record<string, unknown>, conversationId?: string): Promise<string> {
  const filePath = params.path as string
  const content = params.content as string
  if (!filePath || content === undefined) throw new Error('path and content parameters are required')

  const result = await performFileOperation('write', filePath, content)
  if (!result.success) {
    return `Could not write file: ${result.error}`
  }

  // Log the operation
  try {
    logFileOperation('write', filePath, true, undefined, conversationId)
  } catch {}

  return `File written successfully: ${filePath} (${content.length} characters)`
}

async function executeListFiles(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string || '.'
  const recursive = params.recursive as boolean || false

  const result = await performFileOperation('list', filePath, undefined, { recursive })
  if (!result.success) {
    return `Could not list files: ${result.error}`
  }

  // Format the file tree
  const tree = result.result as any[]
  if (!tree || tree.length === 0) {
    return `No files found in ${filePath}`
  }

  const formatTree = (items: any[], indent: number = 0): string => {
    return items.map(item => {
      const prefix = '  '.repeat(indent)
      const icon = item.type === 'directory' ? '📁' : '📄'
      const size = item.size ? ` (${item.size}B)` : ''
      let line = `${prefix}${icon} ${item.name}${size}`
      if (item.children && item.children.length > 0) {
        line += '\n' + formatTree(item.children, indent + 1)
      }
      return line
    }).join('\n')
  }

  return `Files in ${filePath}:\n\n${formatTree(tree)}`
}

async function executeSearchFiles(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string || '.'
  const pattern = params.pattern as string
  if (!pattern) throw new Error('pattern parameter is required')

  const result = await performFileOperation('search', filePath, undefined, { pattern })
  if (!result.success) {
    return `Could not search files: ${result.error}`
  }

  const files = result.result as any[]
  if (!files || files.length === 0) {
    return `No files found matching "${pattern}"`
  }

  const formatted = files.map(f => `${f.type === 'directory' ? '📁' : '📄'} ${f.path}`).join('\n')
  return `Found ${files.length} files matching "${pattern}":\n\n${formatted}`
}

async function executeTerminalCommand(params: Record<string, unknown>): Promise<string> {
  const command = params.command as string
  if (!command) throw new Error('command parameter is required')

  const result = await executeCommand({
    command,
    workingDir: params.working_dir as string,
    timeout: (params.timeout as number) || 30000,
  })

  if (result.success) {
    return `Command executed successfully (${result.executionTime}ms):\n\n${result.output || '(no output)'}`
  } else {
    return `Command failed (exit code ${result.exitCode}):\n\n${result.error || result.output || '(no error details)'}`
  }
}

async function executeRunProject(params: Record<string, unknown>): Promise<string> {
  const projectPath = params.path as string
  if (!projectPath) throw new Error('path parameter is required')

  const result = await processCodingTask({
    type: 'run_project',
    description: 'Run project',
    projectPath,
  })

  return result.output
}

async function executeStopProject(params: Record<string, unknown>): Promise<string> {
  const projectId = params.project_id as string
  if (!projectId) throw new Error('project_id parameter is required')

  const result = await processCodingTask({
    type: 'stop_project',
    description: 'Stop project',
    projectPath: projectId,
  })

  return result.output
}

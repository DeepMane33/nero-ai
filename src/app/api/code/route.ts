/**
 * Code Execution API Endpoint
 * 
 * Handles code execution, file operations, and terminal commands
 */

import { processCodingTask, CodingTask } from '@/core/coding-agent'
import { logActivity, logToolCall } from '@/lib/db'

export const maxDuration = 60

/* ------------------------------------------------------------------ */
/*  POST /api/code                                                     */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    if (!action) {
      return Response.json({ error: 'Action is required' }, { status: 400 })
    }

    // Build the coding task based on action
    const task: CodingTask = buildTask(action, params)

    // Execute the task
    const result = await processCodingTask(task, params.conversationId)

    // Log the activity
    try {
      logActivity('code', `Code: ${action}`, params.description || action.slice(0, 100))
      logToolCall(action, params, result.output.slice(0, 500), result.success, params.conversationId)
    } catch (logErr) {
      console.warn('[code] Activity logging failed:', logErr)
    }

    return Response.json(result)
  } catch (err: any) {
    console.error('[code] API error:', err)
    return Response.json(
      { error: err.message || 'Code execution failed' },
      { status: 500 }
    )
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/code - Get supported languages and status                 */
/* ------------------------------------------------------------------ */

export async function GET() {
  return Response.json({
    supportedLanguages: ['javascript', 'typescript', 'python', 'shell'],
    features: {
      codeExecution: true,
      fileOperations: true,
      terminalCommands: true,
      projectManagement: true,
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Task Builder                                                       */
/* ------------------------------------------------------------------ */

function buildTask(action: string, params: Record<string, unknown>): CodingTask {
  switch (action) {
    case 'execute':
    case 'execute_code':
      return {
        type: 'execute',
        description: params.description as string || 'Execute code',
        code: params.code as string,
        language: params.language as string,
        options: {
          timeout: params.timeout as number,
          workingDir: params.workingDir as string,
        },
      }

    case 'read_file':
      return {
        type: 'read_file',
        description: params.description as string || `Read ${params.path}`,
        filePath: params.path as string,
      }

    case 'write_file':
    case 'create_file':
      return {
        type: 'write_file',
        description: params.description as string || `Write ${params.path}`,
        filePath: params.path as string,
        content: params.content as string,
      }

    case 'list_files':
      return {
        type: 'list_files',
        description: params.description as string || 'List files',
        filePath: params.path as string,
        options: {
          recursive: params.recursive as boolean,
        },
      }

    case 'search_files':
      return {
        type: 'search_files',
        description: params.description as string || `Search for ${params.pattern}`,
        filePath: params.path as string,
        searchPattern: params.pattern as string,
      }

    case 'terminal':
    case 'run_command':
      return {
        type: 'terminal',
        description: params.description as string || `Run: ${params.command}`,
        command: params.command as string,
        options: {
          workingDir: params.workingDir as string,
          timeout: params.timeout as number,
        },
      }

    case 'create_project':
      return {
        type: 'create_project',
        description: params.description as string || `Create ${params.language} project`,
        projectPath: params.path as string,
        language: params.language as string,
      }

    case 'run_project':
      return {
        type: 'run_project',
        description: params.description as string || 'Run project',
        projectPath: params.path as string,
      }

    case 'stop_project':
      return {
        type: 'stop_project',
        description: params.description as string || 'Stop project',
        projectPath: params.projectId as string,
      }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

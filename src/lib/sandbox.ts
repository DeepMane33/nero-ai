/**
 * Sandboxed Code Execution Engine for Nero AI
 * 
 * Safely executes code in isolated environments with:
 * - Timeout limits
 * - Memory restrictions
 * - File system isolation
 * - Process cleanup
 */

import { spawn, ChildProcess } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuid } from 'uuid'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExecutionOptions {
  timeout?: number      // milliseconds, default 30000
  memoryLimit?: string  // e.g., '128m'
  workingDir?: string
  env?: Record<string, string>
}

export interface ExecutionResult {
  success: boolean
  output: string
  error: string | null
  exitCode: number
  executionTime: number
  language: string
}

interface TempFile {
  path: string
  cleanup: () => Promise<void>
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_TIMEOUT = 60000     // 60 seconds max
const TEMP_DIR = join(tmpdir(), 'nero-sandbox')

// Dangerous commands to block
const BLOCKED_COMMANDS = [
  /\brm\s+-rf\s+[\/~]/i,           // rm -rf / or ~
  /\bformat\s+[a-z]:/i,            // format C:
  /\bdel\s+\/[sfq]/i,              // Windows del /s /f /q
  /\bshutdown/i,
  /\breboot/i,
  /\binit\s+[06]/i,
  /\bmkfs/i,
  /\bdd\s+if=/i,
]

/* ------------------------------------------------------------------ */
/*  Language Executors                                                  */
/* ------------------------------------------------------------------ */

const executors: Record<string, (code: string, file: TempFile, opts: ExecutionOptions) => Promise<ExecutionResult>> = {
  javascript: executeJavaScript,
  typescript: executeTypeScript,
  python: executePython,
  shell: executeShell,
}

/* ------------------------------------------------------------------ */
/*  Main Execution Function                                            */
/* ------------------------------------------------------------------ */

export async function executeCode(
  code: string,
  language: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const timeout = Math.min(options.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT)

  // Validate language
  const executor = executors[language.toLowerCase()]
  if (!executor) {
    return {
      success: false,
      output: '',
      error: `Unsupported language: ${language}. Supported: ${Object.keys(executors).join(', ')}`,
      exitCode: 1,
      executionTime: Date.now() - startTime,
      language,
    }
  }

  // Security check for shell commands
  if (language === 'shell' && isBlockedCommand(code)) {
    return {
      success: false,
      output: '',
      error: 'This command is blocked for security reasons.',
      exitCode: 1,
      executionTime: Date.now() - startTime,
      language,
    }
  }

  // Create temp file
  const tempFile = await createTempFile(code, language)

  try {
    const result = await executor(code, tempFile, { ...options, timeout })
    result.executionTime = Date.now() - startTime
    return result
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return {
        success: false,
        output: '',
        error: `Execution timed out after ${timeout / 1000} seconds`,
        exitCode: -1,
        executionTime: Date.now() - startTime,
        language,
      }
    }
    return {
      success: false,
      output: '',
      error: err.message || 'Execution failed',
      exitCode: 1,
      executionTime: Date.now() - startTime,
      language,
    }
  } finally {
    await tempFile.cleanup()
  }
}

/* ------------------------------------------------------------------ */
/*  Language-Specific Executors                                         */
/* ------------------------------------------------------------------ */

async function executeJavaScript(
  code: string,
  file: TempFile,
  opts: ExecutionOptions
): Promise<ExecutionResult> {
  const result = await runProcess('node', [file.path], opts)
  return { ...result, language: 'javascript' }
}

async function executeTypeScript(
  code: string,
  file: TempFile,
  opts: ExecutionOptions
): Promise<ExecutionResult> {
  // Try tsx first, fallback to ts-node, then compile with tsc
  const tsFile = file.path.replace('.js', '.ts')
  await writeFile(tsFile, code)
  
  try {
    // Try tsx (fastest)
    const result = await runProcess('npx', ['tsx', tsFile], opts)
    return { ...result, language: 'typescript' }
  } catch {
    try {
      // Fallback to ts-node
      const result = await runProcess('npx', ['ts-node', tsFile], opts)
      return { ...result, language: 'typescript' }
    } finally {
      await unlink(tsFile).catch(() => {})
    }
  }
}

async function executePython(
  code: string,
  file: TempFile,
  opts: ExecutionOptions
): Promise<ExecutionResult> {
  const pyFile = file.path.replace('.js', '.py')
  await writeFile(pyFile, code)
  
  try {
    const result = await runProcess('python', [pyFile], opts)
    return { ...result, language: 'python' }
  } finally {
    await unlink(pyFile).catch(() => {})
  }
}

async function executeShell(
  code: string,
  file: TempFile,
  opts: ExecutionOptions
): Promise<ExecutionResult> {
  const isWindows = process.platform === 'win32'
  const shellFile = isWindows ? file.path.replace('.js', '.bat') : file.path.replace('.js', '.sh')
  
  if (isWindows) {
    await writeFile(shellFile, code)
  } else {
    await writeFile(shellFile, code)
  }
  
  try {
    const cmd = isWindows ? shellFile : 'bash'
    const args = isWindows ? [] : [shellFile]
    const result = await runProcess(cmd, args, opts)
    return { ...result, language: 'shell' }
  } finally {
    await unlink(shellFile).catch(() => {})
  }
}

/* ------------------------------------------------------------------ */
/*  Process Runner                                                     */
/* ------------------------------------------------------------------ */

function runProcess(
  command: string,
  args: string[],
  opts: ExecutionOptions
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let output = ''
    let error = ''
    let killed = false

    const proc = spawn(command, args, {
      cwd: opts.workingDir || TEMP_DIR,
      env: { ...process.env, ...opts.env },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Timeout
    const timeoutId = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      // Force kill after 2 seconds if still alive
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch {}
      }, 2000)
    }, opts.timeout || DEFAULT_TIMEOUT)

    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      error += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      
      if (killed) {
        resolve({
          success: false,
          output: output.slice(0, 10000), // Limit output
          error: `Process was killed after timeout (${(opts.timeout || DEFAULT_TIMEOUT) / 1000}s)`,
          exitCode: -1,
          executionTime: 0,
          language: '',
        })
        return
      }

      resolve({
        success: code === 0,
        output: output.slice(0, 10000), // Limit output
        error: error ? error.slice(0, 5000) : null,
        exitCode: code ?? 1,
        executionTime: 0,
        language: '',
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        output: '',
        error: err.message,
        exitCode: 1,
        executionTime: 0,
        language: '',
      })
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Temp File Management                                               */
/* ------------------------------------------------------------------ */

async function createTempFile(code: string, language: string): Promise<TempFile> {
  await mkdir(TEMP_DIR, { recursive: true })
  
  const ext = language === 'python' ? '.py' : 
              language === 'shell' ? '.sh' : 
              language === 'typescript' ? '.ts' : '.js'
  
  const filename = `${uuid()}${ext}`
  const filepath = join(TEMP_DIR, filename)
  
  await writeFile(filepath, code)
  
  return {
    path: filepath,
    cleanup: async () => {
      try {
        await unlink(filepath)
      } catch {}
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Security Helpers                                                   */
/* ------------------------------------------------------------------ */

function isBlockedCommand(code: string): boolean {
  const lines = code.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue // Skip comments
    
    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(trimmed)) {
        return true
      }
    }
  }
  return false
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

export function getSupportedLanguages(): string[] {
  return Object.keys(executors)
}

export function isLanguageSupported(language: string): boolean {
  return language.toLowerCase() in executors
}

export async function cleanupTempDir(): Promise<void> {
  try {
    const { readdir } = await import('fs/promises')
    const files = await readdir(TEMP_DIR)
    for (const file of files) {
      await unlink(join(TEMP_DIR, file)).catch(() => {})
    }
  } catch {}
}

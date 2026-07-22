/**
 * Terminal Integration for Nero AI Coding Agent
 * 
 * Provides shell command execution with:
 * - Real-time output streaming
 * - Session management
 * - Command history
 * - Working directory tracking
 */

import { spawn, ChildProcess } from 'child_process'
import { v4 as uuid } from 'uuid'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TerminalCommand {
  command: string
  workingDir?: string
  timeout?: number
  env?: Record<string, string>
}

export interface TerminalResult {
  success: boolean
  output: string
  error: string | null
  exitCode: number
  command: string
  workingDir: string
  executionTime: number
}

export interface TerminalSession {
  id: string
  pid: number | null
  workingDir: string
  output: string[]
  status: 'idle' | 'running' | 'closed'
  history: string[]
  createdAt: Date
  lastActivity: Date
}

export type OutputCallback = (chunk: string, stream: 'stdout' | 'stderr') => void

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT = 30000
const MAX_TIMEOUT = 300000 // 5 minutes for long-running commands
const MAX_HISTORY = 100
const MAX_OUTPUT_LINES = 1000

// Commands that need special handling
const INTERACTIVE_COMMANDS = [
  /^npm\s+(init|config)/i,
  /^yarn\s+(init|config)/i,
  /^git\s+(rebase|merge)/i,
  /^vim|^nano|^vi\b/i,
  /^ssh\b/i,
  /^docker\s+(run|exec)\s+-it/i,
]

// Blocked commands for security
const BLOCKED_COMMANDS = [
  /\brm\s+-rf\s+[\/~]/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+\/[sfq]/i,
  /\bshutdown/i,
  /\breboot/i,
  /\binit\s+[06]/i,
  /\bmkfs/i,
  /\bdd\s+if=/i,
  /\bsudo\s+rm/i,
  /\bchmod\s+777/i,
]

/* ------------------------------------------------------------------ */
/*  Session Management                                                 */
/* ------------------------------------------------------------------ */

const sessions = new Map<string, TerminalSession>()
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_SESSIONS = 50

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastActivity.getTime() > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

export function createSession(workingDir?: string): TerminalSession {
  cleanupExpiredSessions()
  // Evict oldest if at capacity
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = Array.from(sessions.entries())
      .sort((a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime())[0]
    if (oldest) sessions.delete(oldest[0])
  }
  const id = uuid()
  const session: TerminalSession = {
    id,
    pid: null,
    workingDir: workingDir || process.cwd(),
    output: [],
    status: 'idle',
    history: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  }
  sessions.set(id, session)
  return session
}

export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id)
}

export function getAllSessions(): TerminalSession[] {
  return Array.from(sessions.values())
}

export function closeSession(id: string): boolean {
  const session = sessions.get(id)
  if (!session) return false
  
  session.status = 'closed'
  sessions.delete(id)
  return true
}

export function getSessionHistory(id: string): string[] {
  return sessions.get(id)?.history || []
}

/* ------------------------------------------------------------------ */
/*  Command Execution                                                  */
/* ------------------------------------------------------------------ */

export async function executeCommand(
  cmd: TerminalCommand,
  sessionId?: string,
  onOutput?: OutputCallback
): Promise<TerminalResult> {
  const startTime = Date.now()
  const timeout = Math.min(cmd.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT)
  
  // Security check
  if (isBlockedCommand(cmd.command)) {
    return {
      success: false,
      output: '',
      error: 'This command is blocked for security reasons.',
      exitCode: 1,
      command: cmd.command,
      workingDir: cmd.workingDir || process.cwd(),
      executionTime: 0,
    }
  }
  
  // Check for interactive commands
  if (isInteractiveCommand(cmd.command)) {
    return {
      success: false,
      output: '',
      error: 'Interactive commands are not supported in this mode. Use a dedicated terminal session.',
      exitCode: 1,
      command: cmd.command,
      workingDir: cmd.workingDir || process.cwd(),
      executionTime: 0,
    }
  }

  // Update session if provided
  if (sessionId) {
    const session = sessions.get(sessionId)
    if (session) {
      session.status = 'running'
      session.history.push(cmd.command)
      if (session.history.length > MAX_HISTORY) {
        session.history.shift()
      }
    }
  }

  const isWindows = process.platform === 'win32'
  const shell = isWindows ? 'cmd.exe' : 'bash'
  const shellArgs = isWindows ? ['/c', cmd.command] : ['-c', cmd.command]

  return new Promise((resolve) => {
    let output = ''
    let error = ''
    let killed = false

    const proc = spawn(shell, shellArgs, {
      cwd: cmd.workingDir || process.cwd(),
      env: { ...process.env, ...cmd.env },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Store PID in session
    if (sessionId) {
      const session = sessions.get(sessionId)
      if (session) session.pid = proc.pid || null
    }

    // Timeout
    const timeoutId = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch {}
      }, 2000)
    }, timeout)

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      
      // Stream to callback
      if (onOutput) {
        onOutput(chunk, 'stdout')
      }
      
      // Update session output
      if (sessionId) {
        const session = sessions.get(sessionId)
        if (session) {
          const lines = chunk.split('\n').filter((l: string) => l)
          session.output.push(...lines)
          if (session.output.length > MAX_OUTPUT_LINES) {
            session.output = session.output.slice(-MAX_OUTPUT_LINES)
          }
        }
      }
    })

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString()
      error += chunk
      
      // Stream to callback
      if (onOutput) {
        onOutput(chunk, 'stderr')
      }
      
      // Update session output
      if (sessionId) {
        const session = sessions.get(sessionId)
        if (session) {
          const lines = chunk.split('\n').filter((l: string) => l)
          session.output.push(...lines)
          if (session.output.length > MAX_OUTPUT_LINES) {
            session.output = session.output.slice(-MAX_OUTPUT_LINES)
          }
        }
      }
    })

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      
      // Update session status
      if (sessionId) {
        const session = sessions.get(sessionId)
        if (session) {
          session.status = 'idle'
          session.pid = null
          session.lastActivity = new Date()
        }
      }

      if (killed) {
        resolve({
          success: false,
          output: output.slice(0, 10000),
          error: `Command was killed after timeout (${timeout / 1000}s)`,
          exitCode: -1,
          command: cmd.command,
          workingDir: cmd.workingDir || process.cwd(),
          executionTime: Date.now() - startTime,
        })
        return
      }

      resolve({
        success: code === 0,
        output: output.slice(0, 10000),
        error: error ? error.slice(0, 5000) : null,
        exitCode: code ?? 1,
        command: cmd.command,
        workingDir: cmd.workingDir || process.cwd(),
        executionTime: Date.now() - startTime,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      
      if (sessionId) {
        const session = sessions.get(sessionId)
        if (session) {
          session.status = 'idle'
          session.pid = null
        }
      }

      resolve({
        success: false,
        output: '',
        error: err.message,
        exitCode: 1,
        command: cmd.command,
        workingDir: cmd.workingDir || process.cwd(),
        executionTime: Date.now() - startTime,
      })
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Convenience Functions                                              */
/* ------------------------------------------------------------------ */

export async function runCommand(
  command: string,
  options?: {
    workingDir?: string
    timeout?: number
    env?: Record<string, string>
  }
): Promise<TerminalResult> {
  return executeCommand({
    command,
    workingDir: options?.workingDir,
    timeout: options?.timeout,
    env: options?.env,
  })
}

export async function runWithOutput(
  command: string,
  onOutput: OutputCallback,
  options?: {
    workingDir?: string
    timeout?: number
  }
): Promise<TerminalResult> {
  return executeCommand(
    {
      command,
      workingDir: options?.workingDir,
      timeout: options?.timeout,
    },
    undefined,
    onOutput
  )
}

/* ------------------------------------------------------------------ */
/*  Security Helpers                                                   */
/* ------------------------------------------------------------------ */

function isBlockedCommand(command: string): boolean {
  const lines = command.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue
    
    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(trimmed)) {
        return true
      }
    }
  }
  return false
}

function isInteractiveCommand(command: string): boolean {
  return INTERACTIVE_COMMANDS.some(pattern => pattern.test(command.trim()))
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

export function getCommandHistory(sessionId: string): string[] {
  return sessions.get(sessionId)?.history || []
}

export function clearSessionOutput(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false
  session.output = []
  return true
}

export function isWindows(): boolean {
  return process.platform === 'win32'
}

export function getShellInfo(): { shell: string; platform: string } {
  const platform = process.platform
  if (platform === 'win32') {
    return { shell: process.env.COMSPEC || 'cmd.exe', platform: 'windows' }
  }
  return { shell: process.env.SHELL || '/bin/bash', platform: 'unix' }
}

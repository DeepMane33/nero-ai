/**
 * Project Runner for Nero AI Coding Agent
 * 
 * Detects project types and manages local development servers:
 * - Next.js / React
 * - Python (Flask/FastAPI)
 * - Node.js (Express)
 * - Generic projects
 */

import { spawn, ChildProcess } from 'child_process'
import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { executeCommand } from './terminal'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProjectConfig {
  type: 'nextjs' | 'react' | 'python' | 'node' | 'generic'
  name: string
  rootDir: string
  startCommand: string
  installCommand?: string
  buildCommand?: string
  port?: number
  env?: Record<string, string>
}

export interface ProjectProcess {
  id: string
  config: ProjectConfig
  pid: number | null
  port: number | null
  status: 'starting' | 'running' | 'stopped' | 'error'
  logs: string[]
  error?: string
  startedAt: Date | null
  stoppedAt: Date | null
}

export interface ProjectDetection {
  type: ProjectConfig['type']
  confidence: number
  evidence: string[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROJECT_MARKERS: Record<string, { files: string[]; type: ProjectConfig['type'] }> = {
  nextjs: {
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    type: 'nextjs',
  },
  react: {
    files: ['package.json'],
    type: 'react',
  },
  python: {
    files: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
    type: 'python',
  },
  node: {
    files: ['package.json'],
    type: 'node',
  },
}

const DEFAULT_PORTS: Record<string, number> = {
  nextjs: 3000,
  react: 3000,
  python: 5000,
  node: 3000,
  generic: 8080,
}

/* ------------------------------------------------------------------ */
/*  Active Projects                                                    */
/* ------------------------------------------------------------------ */

const activeProjects = new Map<string, ProjectProcess>()

function cleanupStoppedProjects() {
  for (const [id, project] of activeProjects) {
    if (project.status === 'stopped' || project.status === 'error') {
      // Keep for 10 minutes then clean up
      const stoppedAt = project.stoppedAt?.getTime() || 0
      if (Date.now() - stoppedAt > 10 * 60 * 1000) {
        activeProjects.delete(id)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Project Detection                                                  */
/* ------------------------------------------------------------------ */

export async function detectProjectType(dir: string): Promise<ProjectDetection> {
  const entries = await readdir(dir)
  const detections: ProjectDetection[] = []

  // Check for Next.js
  if (entries.some(f => ['next.config.js', 'next.config.mjs', 'next.config.ts'].includes(f))) {
    detections.push({
      type: 'nextjs',
      confidence: 0.95,
      evidence: ['Found next.config.*'],
    })
  }

  // Check for Python
  const pythonFiles = entries.filter(f => 
    ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'].includes(f) ||
    f.endsWith('.py')
  )
  if (pythonFiles.length > 0) {
    detections.push({
      type: 'python',
      confidence: pythonFiles.includes('requirements.txt') ? 0.9 : 0.7,
      evidence: pythonFiles.map(f => `Found ${f}`),
    })
  }

  // Check for Node.js
  if (entries.includes('package.json')) {
    try {
      const pkgContent = await readFile(join(dir, 'package.json'), 'utf-8')
      const pkg = JSON.parse(pkgContent)
      
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      
      if (deps['next']) {
        detections.push({
          type: 'nextjs',
          confidence: 0.98,
          evidence: ['Found package.json with next dependency'],
        })
      } else if (deps['react'] || deps['react-dom']) {
        detections.push({
          type: 'react',
          confidence: 0.85,
          evidence: ['Found package.json with react dependency'],
        })
      } else {
        detections.push({
          type: 'node',
          confidence: 0.7,
          evidence: ['Found package.json'],
        })
      }
    } catch {
      detections.push({
        type: 'node',
        confidence: 0.5,
        evidence: ['Found package.json (could not parse)'],
      })
    }
  }

  // Sort by confidence
  detections.sort((a, b) => b.confidence - a.confidence)

  return detections[0] || {
    type: 'generic',
    confidence: 0.3,
    evidence: ['No specific markers found'],
  }
}

/* ------------------------------------------------------------------ */
/*  Project Configuration                                              */
/* ------------------------------------------------------------------ */

export async function getProjectConfig(dir: string): Promise<ProjectConfig> {
  const detection = await detectProjectType(dir)
  const dirName = dir.split(/[/\\]/).pop() || 'project'

  switch (detection.type) {
    case 'nextjs':
      return {
        type: 'nextjs',
        name: dirName,
        rootDir: dir,
        startCommand: 'npm run dev',
        installCommand: 'npm install',
        buildCommand: 'npm run build',
        port: DEFAULT_PORTS.nextjs,
      }
    
    case 'react':
      return {
        type: 'react',
        name: dirName,
        rootDir: dir,
        startCommand: 'npm run dev',
        installCommand: 'npm install',
        buildCommand: 'npm run build',
        port: DEFAULT_PORTS.react,
      }
    
    case 'python':
      return {
        type: 'python',
        name: dirName,
        rootDir: dir,
        startCommand: 'python app.py',
        installCommand: 'pip install -r requirements.txt',
        port: DEFAULT_PORTS.python,
      }
    
    case 'node':
      return {
        type: 'node',
        name: dirName,
        rootDir: dir,
        startCommand: 'npm start',
        installCommand: 'npm install',
        port: DEFAULT_PORTS.node,
      }
    
    default:
      return {
        type: 'generic',
        name: dirName,
        rootDir: dir,
        startCommand: 'echo "No start command configured"',
        port: DEFAULT_PORTS.generic,
      }
  }
}

/* ------------------------------------------------------------------ */
/*  Project Lifecycle Management                                       */
/* ------------------------------------------------------------------ */

export async function startProject(
  config: ProjectConfig,
  onLog?: (log: string) => void
): Promise<ProjectProcess> {
  cleanupStoppedProjects()
  const id = uuid()

  // Find an available port instead of using hardcoded defaults
  const desiredPort = config.port || DEFAULT_PORTS[config.type]
  const availablePort = await findAvailablePort(desiredPort)

  const process: ProjectProcess = {
    id,
    config,
    pid: null,
    port: availablePort,
    status: 'starting',
    logs: [],
    startedAt: new Date(),
    stoppedAt: null,
  }

  activeProjects.set(id, process)

  // Install dependencies if needed
  if (config.installCommand) {
    try {
      process.logs.push(`Installing dependencies: ${config.installCommand}`)
      onLog?.(`Installing dependencies: ${config.installCommand}`)
      
      await executeCommand({
        command: config.installCommand,
        workingDir: config.rootDir,
        timeout: 120000, // 2 minutes for install
      })
    } catch (err: any) {
      process.status = 'error'
      process.error = `Install failed: ${err.message}`
      process.logs.push(`Install error: ${err.message}`)
      return process
    }
  }

  // Start the project
  const isWindows = typeof globalThis.process !== 'undefined' && globalThis.process.platform === 'win32'
  const shell = isWindows ? 'cmd.exe' : 'bash'
  const shellArgs = isWindows ? ['/c', config.startCommand] : ['-c', config.startCommand]

  try {
    const proc = spawn(shell, shellArgs, {
      cwd: config.rootDir,
      env: { ...globalThis.process.env, PORT: String(config.port), ...config.env },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    process.pid = proc.pid || null
    process.status = 'running'

    proc.stdout?.on('data', (data) => {
      const log = data.toString()
      process.logs.push(log)
      if (process.logs.length > 1000) process.logs.shift()
      onLog?.(log)
    })

    proc.stderr?.on('data', (data) => {
      const log = data.toString()
      process.logs.push(log)
      if (process.logs.length > 1000) process.logs.shift()
      onLog?.(log)
    })

    proc.on('close', (code) => {
      process.status = code === 0 ? 'stopped' : 'error'
      process.stoppedAt = new Date()
      process.pid = null
      if (code !== 0) {
        process.error = `Process exited with code ${code}`
      }
    })

    proc.on('error', (err) => {
      process.status = 'error'
      process.error = err.message
      process.stoppedAt = new Date()
    })

    process.logs.push(`Project started on port ${config.port}`)
    onLog?.(`Project started on port ${config.port}`)

  } catch (err: any) {
    process.status = 'error'
    process.error = err.message
  }

  return process
}

export async function stopProject(projectId: string): Promise<boolean> {
  const project = activeProjects.get(projectId)
  if (!project) return false

  if (project.pid) {
    try {
      process.kill(project.pid, 'SIGTERM')
      // Force kill after 5 seconds
      setTimeout(() => {
        try {
          process.kill(project.pid!, 'SIGKILL')
        } catch {}
      }, 5000)
    } catch {}
  }

  project.status = 'stopped'
  project.stoppedAt = new Date()
  project.pid = null

  return true
}

export function getProjectStatus(projectId: string): ProjectProcess | undefined {
  return activeProjects.get(projectId)
}

export function getAllProjects(): ProjectProcess[] {
  return Array.from(activeProjects.values())
}

export function getProjectLogs(projectId: string, limit: number = 100): string[] {
  const project = activeProjects.get(projectId)
  if (!project) return []
  return project.logs.slice(-limit)
}

/* ------------------------------------------------------------------ */
/*  Port Detection                                                     */
/* ------------------------------------------------------------------ */

export async function findAvailablePort(startPort: number = 3000): Promise<number> {
  const net = await import('net')
  
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    
    server.listen(startPort, () => {
      const port = (server.address() as any)?.port || startPort
      server.close(() => resolve(port))
    })
    
    server.on('error', () => {
      // Port in use, try next
      resolve(findAvailablePort(startPort + 1))
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

export function isProjectRunning(projectId: string): boolean {
  const project = activeProjects.get(projectId)
  return project?.status === 'running'
}

export function getProjectByPort(port: number): ProjectProcess | undefined {
  return Array.from(activeProjects.values()).find(p => p.port === port)
}

export function cleanupAllProjects(): void {
  for (const [id] of activeProjects) {
    stopProject(id)
  }
}

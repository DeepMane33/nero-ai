/**
 * File System Operations for Nero AI Coding Agent
 * 
 * Provides safe file system CRUD operations with:
 * - Path validation (prevent directory traversal)
 * - Project directory isolation
 * - Operation logging
 */

import { readFile, writeFile, readdir, stat, mkdir, unlink, rename as fsRename } from 'fs/promises'
import { join, relative, resolve, extname } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FileTree {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileTree[]
}

export interface FileOperationResult {
  success: boolean
  result?: string | FileTree | FileTree[]
  error?: string
  path: string
}

export type FileOperationType = 'read' | 'write' | 'create' | 'delete' | 'list' | 'search' | 'mkdir' | 'rename'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

// Allowed base directories for file operations
const ALLOWED_BASE_DIRS = [
  join(homedir(), 'nero-projects'),
  join(homedir(), 'nero-os'),
  join(homedir(), '.nero'),
]

// Blocked file patterns
const BLOCKED_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /credentials/i,
  /secrets/i,
  /private[_-]?key/i,
  /\.git\/(?!config)/i,
  /node_modules/i,
]

/* ------------------------------------------------------------------ */
/*  Main Operation Function                                            */
/* ------------------------------------------------------------------ */

export async function performFileOperation(
  type: FileOperationType,
  filePath: string,
  content?: string,
  options?: {
    pattern?: string
    newPath?: string
    recursive?: boolean
  }
): Promise<FileOperationResult> {
  try {
    // Validate and resolve path
    const resolvedPath = resolvePath(filePath)
    
    // Security checks
    if (!isPathAllowed(resolvedPath)) {
      return {
        success: false,
        error: 'Access to this path is not allowed.',
        path: filePath,
      }
    }

    if (isBlockedPath(resolvedPath)) {
      return {
        success: false,
        error: 'Access to this file is restricted for security reasons.',
        path: filePath,
      }
    }

    switch (type) {
      case 'read':
        return await readFileContent(resolvedPath)
      
      case 'write':
      case 'create':
        if (!content && content !== '') {
          return { success: false, error: 'Content is required', path: filePath }
        }
        return await writeFileContent(resolvedPath, content)
      
      case 'delete':
        return await deleteFile(resolvedPath)
      
      case 'list':
        return await listDirectory(resolvedPath, options?.recursive)
      
      case 'search':
        if (!options?.pattern) {
          return { success: false, error: 'Search pattern is required', path: filePath }
        }
        return await searchFiles(resolvedPath, options.pattern)
      
      case 'mkdir':
        return await createDirectory(resolvedPath)
      
      case 'rename':
        if (!options?.newPath) {
          return { success: false, error: 'New path is required for rename', path: filePath }
        }
        const newResolvedPath = resolvePath(options.newPath)
        if (!isPathAllowed(newResolvedPath)) {
          return { success: false, error: 'Destination path is not allowed', path: filePath }
        }
        return await renameFile(resolvedPath, newResolvedPath)
      
      default:
        return { success: false, error: `Unknown operation: ${type}`, path: filePath }
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'File operation failed',
      path: filePath,
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Individual Operations                                              */
/* ------------------------------------------------------------------ */

async function readFileContent(path: string): Promise<FileOperationResult> {
  const content = await readFile(path, 'utf-8')
  return { success: true, result: content, path }
}

async function writeFileContent(path: string, content: string): Promise<FileOperationResult> {
  // Create parent directory if it doesn't exist
  const dir = join(path, '..')
  await mkdir(dir, { recursive: true })
  
  await writeFile(path, content, 'utf-8')
  return { success: true, result: `File written: ${path}`, path }
}

async function deleteFile(path: string): Promise<FileOperationResult> {
  await unlink(path)
  return { success: true, result: `Deleted: ${path}`, path }
}

async function listDirectory(path: string, recursive: boolean = false): Promise<FileOperationResult> {
  const tree = await buildFileTree(path, recursive)
  return { success: true, result: tree, path }
}

async function searchFiles(startPath: string, pattern: string): Promise<FileOperationResult> {
  const matches: FileTree[] = []
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'i')
  } catch {
    return { success: false, error: 'Invalid regex pattern', path: startPath }
  }
  
  async function search(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        
        // Skip blocked directories
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        
        if (regex.test(entry.name)) {
          const stats = await stat(fullPath)
          matches.push({
            name: entry.name,
            path: relative(process.cwd(), fullPath),
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
          })
        }
        
        if (entry.isDirectory()) {
          await search(fullPath)
        }
      }
    } catch {}
  }
  
  await search(startPath)
  return { success: true, result: matches, path: startPath }
}

async function createDirectory(path: string): Promise<FileOperationResult> {
  await mkdir(path, { recursive: true })
  return { success: true, result: `Created directory: ${path}`, path }
}

async function renameFile(oldPath: string, newPath: string): Promise<FileOperationResult> {
  await fsRename(oldPath, newPath)
  return { success: true, result: `Renamed: ${oldPath} → ${newPath}`, path: oldPath }
}

/* ------------------------------------------------------------------ */
/*  File Tree Builder                                                  */
/* ------------------------------------------------------------------ */

async function buildFileTree(dirPath: string, recursive: boolean = true, depth: number = 0): Promise<FileTree[]> {
  // Limit depth to prevent infinite recursion
  if (depth > 10) return []
  
  const entries = await readdir(dirPath, { withFileTypes: true })
  const trees: FileTree[] = []
  
  // Sort: directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })
  
  for (const entry of sorted) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    
    const fullPath = join(dirPath, entry.name)
    const relativePath = relative(process.cwd(), fullPath)
    
    try {
      const stats = await stat(fullPath)
      
      const node: FileTree = {
        name: entry.name,
        path: relativePath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
      }
      
      if (entry.isDirectory() && recursive) {
        node.children = await buildFileTree(fullPath, true, depth + 1)
      }
      
      trees.push(node)
    } catch {
      // Skip files we can't stat
    }
  }
  
  return trees
}

/* ------------------------------------------------------------------ */
/*  Path Validation Helpers                                            */
/* ------------------------------------------------------------------ */

function resolvePath(filePath: string): string {
  // If absolute path, use as-is
  if (filePath.startsWith('/') || /^[A-Z]:\\/.test(filePath)) {
    return resolve(filePath)
  }
  
  // Otherwise, resolve relative to current working directory
  return resolve(process.cwd(), filePath)
}

function isPathAllowed(path: string): boolean {
  const normalized = path.toLowerCase().replace(/\\/g, '/')
  
  return ALLOWED_BASE_DIRS.some(dir => {
    const normalizedDir = dir.toLowerCase().replace(/\\/g, '/')
    return normalized.startsWith(normalizedDir + '/') || normalized === normalizedDir
  })
}

function isBlockedPath(path: string): boolean {
  const normalized = path.toLowerCase().replace(/\\/g, '/')
  return BLOCKED_PATTERNS.some(pattern => pattern.test(normalized))
}

/* ------------------------------------------------------------------ */
/*  Utility Functions                                                  */
/* ------------------------------------------------------------------ */

export function getFileExtension(path: string): string {
  return extname(path).toLowerCase()
}

export function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.pyw': 'python',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sql': 'sql',
  }
  return langMap[ext] || 'text'
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export const ALLOWED_DIRECTORIES = ALLOWED_BASE_DIRS

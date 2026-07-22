'use client'

import { useState, useCallback, useEffect } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
}

interface FileExplorerProps {
  rootPath?: string
  onFileSelect?: (path: string) => void
  onFileCreate?: (path: string) => void
  onFileDelete?: (path: string) => void
  refreshTrigger?: number
}

/* ------------------------------------------------------------------ */
/*  FileExplorer Component                                             */
/* ------------------------------------------------------------------ */

export default function FileExplorer({
  rootPath = '.',
  onFileSelect,
  onFileCreate,
  onFileDelete,
  refreshTrigger,
}: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  const [newFileDir, setNewFileDir] = useState('')

  // Fetch files from API
  const fetchFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_files',
          path: rootPath,
          recursive: true,
        }),
      })
      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        setFiles(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch files:', err)
    } finally {
      setIsLoading(false)
    }
  }, [rootPath])

  // Fetch on mount and when refreshTrigger changes
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles, refreshTrigger])

  // Toggle directory expansion
  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Handle file click
  const handleFileClick = useCallback((node: FileNode) => {
    if (node.type === 'directory') {
      toggleDir(node.path)
    } else {
      setSelectedFile(node.path)
      onFileSelect?.(node.path)
    }
  }, [toggleDir, onFileSelect])

  // Handle new file creation
  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) return

    const filePath = newFileDir ? `${newFileDir}/${newFileName}` : newFileName
    
    try {
      const response = await fetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write_file',
          path: filePath,
          content: '',
        }),
      })
      const result = await response.json()
      if (result.success) {
        onFileCreate?.(filePath)
        setNewFileName('')
        setShowNewFileInput(false)
        fetchFiles()
      }
    } catch (err) {
      console.error('Failed to create file:', err)
    }
  }, [newFileName, newFileDir, onFileCreate, fetchFiles])

  // Handle file deletion
  const handleDeleteFile = useCallback(async (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete ${path}?`)) return

    try {
      const response = await fetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_file',
          path,
        }),
      })
      const result = await response.json()
      if (result.success) {
        onFileDelete?.(path)
        fetchFiles()
      }
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }, [onFileDelete, fetchFiles])

  // Render file tree recursively
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path)
    const isSelected = selectedFile === node.path
    const isDir = node.type === 'directory'
    const indent = depth * 16

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors
            ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5 text-white/70 hover:text-white/90'}`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {/* Icon */}
          <span className="w-4 h-4 flex-shrink-0">
            {isDir ? (
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4l8 6-8 6V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            )}
          </span>

          {/* Name */}
          <span className="flex-1 truncate text-sm">
            {isDir ? `${node.name}/` : node.name}
          </span>

          {/* Size */}
          {node.size !== undefined && !isDir && (
            <span className="text-xs text-white/30">
              {formatSize(node.size)}
            </span>
          )}

          {/* Delete button */}
          {!isDir && (
            <button
              onClick={(e) => handleDeleteFile(node.path, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Children */}
        {isDir && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-xs text-white/50">Files</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewFileDir('')
              setShowNewFileInput(!showNewFileInput)
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="New file"
          >
            <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={fetchFiles}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* New file input */}
      {showNewFileInput && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.js"
            className="flex-1 px-2 py-1 text-sm bg-black/30 rounded border border-white/20 text-white/90 focus:outline-none focus:border-blue-500/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFile()
              if (e.key === 'Escape') setShowNewFileInput(false)
            }}
          />
          <button
            onClick={handleCreateFile}
            className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
          >
            Create
          </button>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-white/30">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-white/30 text-sm">
            No files found
          </div>
        ) : (
          files.map(node => renderNode(node))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-t border-white/10 text-xs text-white/40">
        <span>{files.length} items</span>
        <span>{expandedDirs.size} expanded</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

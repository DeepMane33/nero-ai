'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getProjects as getProjectsStore,
  createProject as createProjectStore,
  updateProject as updateProjectStore,
  deleteProject as deleteProjectStore,
  getProjectFiles as getProjectFilesStore,
  createProjectFile as createProjectFileStore,
  updateProjectFile as updateProjectFileStore,
  deleteProjectFile as deleteProjectFileStore,
  getProjectNotes as getProjectNotesStore,
  createProjectNote as createProjectNoteStore,
  updateProjectNote as updateProjectNoteStore,
  deleteProjectNote as deleteProjectNoteStore,
  getProjectTasks as getProjectTasksStore,
  createProjectTask as createProjectTaskStore,
  updateProjectTask as updateProjectTaskStore,
  deleteProjectTask as deleteProjectTaskStore,
  type Project,
  type ProjectFile,
  type ProjectNote,
  type ProjectTask,
} from '@/lib/client-projects';
import { addActivity } from '@/lib/client-activity';

type ActiveTab = 'files' | 'notes' | 'tasks';

const PRESET_COLORS = [
  '#b0b8c4', '#a0b8d0', '#8fb996', '#808080', '#c8b86a',
  '#7b8da4', '#ffffff', '#14b8a6', '#6b8ca8', '#b4a0d4',
];

const PRIORITY_CONFIG = {
  high: { bg: 'rgba(212, 115, 110, 0.12)', border: 'rgba(212, 115, 110, 0.25)', color: '#ffffff', label: 'HIGH' },
  medium: { bg: '#111111', border: '#222222', color: '#808080', label: 'MED' },
  low: { bg: 'rgba(200, 205, 215, 0.03)', border: 'rgba(200, 205, 215, 0.08)', color: 'rgba(138, 143, 152, 0.4)', label: 'LOW' },
};

const STATUS_CONFIG = {
  todo: { color: 'rgba(138, 143, 152, 0.4)', glow: 'none', label: 'To Do' },
  in_progress: { color: '#808080', glow: '0 0 10px rgba(148, 163, 184, 0.3)', label: 'In Progress' },
  done: { color: '#c0c0c0', glow: '0 0 10px rgba(126, 221, 214, 0.3)', label: 'Done' },
};

// ─── Animation Variants ────────────────────────────────

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
};

const staggerItem = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.2 },
};

// ─── Sub-Components ────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        padding: '12px 20px', borderRadius: 0, fontSize: 13, fontWeight: 500,
        background: type === 'error'
          ? '#ffffff'
          : '#000000',
        color: type === 'error' ? '#fff' : '#000000',
        boxShadow: type === 'error'
          ? '0 4px 24px rgba(248, 113, 113, 0.4)'
          : '0 4px 24px rgba(52, 211, 153, 0.3)',
        display: 'flex', alignItems: 'center', gap: 8,

      }}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
    >
      <span>{type === 'error' ? '!' : '\u2713'}</span>
      <span>{message}</span>
    </motion.div>
  );
}

function ConfirmDialog({
  title, message, onConfirm, onCancel, danger,
}: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <motion.div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000000', backdropFilter: 'blur(6px)',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        style={{
          width: 360, padding: 24, borderRadius: 0,
          background: 'rgba(13, 14, 19, 0.97)', backdropFilter: 'blur(24px)',
          border: '2px solid #333333',
          boxShadow: '0 8px 48px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'rgba(255, 255, 255, 0.9)' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{
              flex: 1, padding: '10px 0', borderRadius: 0, fontSize: 13, fontWeight: 600,
              background: '#0a0a0a', border: '2px solid #333333',
              color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              flex: 1, padding: '10px 0', borderRadius: 0, fontSize: 13, fontWeight: 600,
              background: danger ? 'rgba(248, 113, 113, 0.2)' : 'rgba(176, 184, 196, 0.15)',
              border: danger ? '1px solid rgba(248, 113, 113, 0.4)' : '1px solid rgba(176, 184, 196, 0.3)',
              color: danger ? '#ffffff' : '#b0b8c4', cursor: 'pointer',
            }}
            onClick={onConfirm}
          >
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalShell({
  children, onClose, width = 400,
}: {
  children: React.ReactNode; onClose: () => void; width?: number;
}) {
  return (
    <motion.div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          width, maxHeight: '85vh', overflowY: 'auto',
          background: 'rgba(13, 14, 19, 0.97)', backdropFilter: 'blur(24px)',
          border: '2px solid #333333',
          borderRadius: 0, padding: 28,
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 24 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 0,
      background: color.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#', ''),
      border: '1px solid ' + color.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#', ''),
      /* Fallback: use inline approach */
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
    </div>
  );
}

function Skeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 42, borderRadius: 0, marginBottom: 6,
          background: '#0a0a0a', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: '#000000',
            animation: 'shimmer 1.5s infinite',
          }} />
        </div>
      ))}
    </>
  );
}

function EmptyState({
  icon, title, description, action, actionLabel,
}: {
  icon: string; title: string; description: string; action?: () => void; actionLabel?: string;
}) {
  return (
    <motion.div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48,
      }}
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        style={{ fontSize: 48, opacity: 0.25 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon}
      </motion.div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255, 255, 255, 0.45)' }}>{title}</div>
      <div style={{
        fontSize: 12, color: 'rgba(255, 255, 255, 0.25)', textAlign: 'center',
        lineHeight: 1.6, maxWidth: 300,
      }}>{description}</div>
      {action && (
        <motion.button
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 0, fontSize: 12, fontWeight: 600,
            background: '#000000',
            border: '2px solid #333333',
            color: '#b0b8c4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 0 16px rgba(176, 184, 196, 0.1)',
          }}
          whileHover={{ scale: 1.03, boxShadow: '0 0 24px rgba(176, 184, 196, 0.2)' }}
          whileTap={{ scale: 0.97 }}
          onClick={action}
        >
          <span>+</span> {actionLabel || 'Create'}
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────

export default function ProjectsWorkspace() {
  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // Confirm dialog
  const [confirm, setConfirm] = useState<{
    title: string; message: string; onConfirm: () => void; danger?: boolean;
  } | null>(null);

  // Project modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#b0b8c4' });
  const [showSettings, setShowSettings] = useState(false);

  // Edit project inline
  const [editingProject, setEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Files state
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [filesLoading, setFilesLoading] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [fileModified, setFileModified] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [activeNote, setActiveNote] = useState<ProjectNote | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteModified, setNoteModified] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: string }>({
    title: '', description: '', priority: 'medium',
  });
  const [dragTask, setDragTask] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // ─── Filtered projects ──────────────────────────────

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // ─── Fetch Projects ─────────────────────────────────

  const fetchProjects = useCallback(() => {
    setLoading(true);
    try {
      const data = getProjectsStore();
      setProjects(data);
    } catch {
      showToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ─── Fetch project data when active project changes ──

  const fetchFiles = useCallback((projectId: string) => {
    setFilesLoading(true);
    try {
      const data = getProjectFilesStore(projectId);
      setFiles(data);
    } catch {
      showToast('Failed to load files', 'error');
    } finally {
      setFilesLoading(false);
    }
  }, [showToast]);

  const fetchNotes = useCallback((projectId: string) => {
    setNotesLoading(true);
    try {
      const data = getProjectNotesStore(projectId);
      setNotes(data);
    } catch {
      showToast('Failed to load notes', 'error');
    } finally {
      setNotesLoading(false);
    }
  }, [showToast]);

  const fetchTasks = useCallback((projectId: string) => {
    setTasksLoading(true);
    try {
      const data = getProjectTasksStore(projectId);
      setTasks(data);
    } catch {
      showToast('Failed to load tasks', 'error');
    } finally {
      setTasksLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!activeProject) return;
    fetchFiles(activeProject.id);
    fetchNotes(activeProject.id);
    fetchTasks(activeProject.id);
    setActiveFile(null);
    setActiveNote(null);
    setFileContent('');
    setNoteContent('');
    setNoteTitle('');
    setFileModified(false);
    setNoteModified(false);
    setShowSettings(false);
    setEditingProject(false);
  }, [activeProject, fetchFiles, fetchNotes, fetchTasks]);

  // ─── Project CRUD ───────────────────────────────────

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) { showToast('Project name is required', 'error'); return; }
    try {
      createProjectStore(newProject.name, newProject.description, newProject.color);
      // Log to activity feed
      addActivity('project', 'Project created', `${newProject.name}${newProject.description ? ': ' + newProject.description : ''}`, 'project');
      showToast('Project created successfully');
      setShowNewModal(false);
      setNewProject({ name: '', description: '', color: '#b0b8c4' });
      fetchProjects();
    } catch {
      showToast('Failed to create project', 'error');
    }
  };

  const handleDeleteProject = async (id: string) => {
    setConfirm({
      title: 'Delete Project',
      message: 'This will permanently delete the project and all its files, notes, and tasks. This action cannot be undone.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const project = projects.find(p => p.id === id);
          deleteProjectStore(id);
          addActivity('project', 'Project deleted', project?.name || 'Unknown project', 'project');
          showToast('Project deleted');
          if (activeProject?.id === id) setActiveProject(null);
          fetchProjects();
        } catch {
          showToast('Failed to delete project', 'error');
        }
      },
    });
  };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!activeProject) return;
    try {
      updateProjectStore(activeProject.id, updates);
      showToast('Project updated');
      fetchProjects();
      setActiveProject((prev) => (prev ? { ...prev, ...updates } : null));
    } catch {
      showToast('Failed to update project', 'error');
    }
  };

  const handleSaveProjectEdit = () => {
    if (!editName.trim()) { showToast('Name is required', 'error'); return; }
    handleUpdateProject({ name: editName, description: editDesc });
    setEditingProject(false);
  };

  // ─── File operations ────────────────────────────────

  const handleCreateFile = async () => {
    if (!activeProject || !newFileName.trim()) { showToast('File name is required', 'error'); return; }
    try {
      createProjectFileStore(activeProject.id, newFileName, '');
      showToast('File created');
      setShowNewFileModal(false);
      setNewFileName('');
      fetchFiles(activeProject.id);
    } catch {
      showToast('Failed to create file', 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!activeProject || !activeFile) return;
    try {
      updateProjectFileStore(activeFile.id, fileContent);
      showToast('File saved');
      setFileModified(false);
    } catch {
      showToast('Failed to save file', 'error');
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!activeProject) return;
    setConfirm({
      title: 'Delete File',
      message: 'Delete "' + fileName + '"? This cannot be undone.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          deleteProjectFileStore(fileId);
          showToast('File deleted');
          if (activeFile?.id === fileId) { setActiveFile(null); setFileContent(''); setFileModified(false); }
          fetchFiles(activeProject.id);
        } catch {
          showToast('Failed to delete file', 'error');
        }
      },
    });
  };

  const handleSelectFile = (file: ProjectFile) => {
    if (fileModified) {
      setConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Discard them?',
        onConfirm: () => {
          setConfirm(null);
          setActiveFile(file);
          setFileContent(file.content || '');
          setFileModified(false);
        },
      });
      return;
    }
    setActiveFile(file);
    setFileContent(file.content || '');
    setFileModified(false);
  };

  // ─── Note operations ────────────────────────────────

  const handleCreateNote = async () => {
    if (!activeProject) return;
    try {
      const note = createProjectNoteStore(activeProject.id, 'Untitled Note', '');
      showToast('Note created');
      fetchNotes(activeProject.id);
      setActiveNote(note);
      setNoteTitle(note.title || '');
      setNoteContent(note.content || '');
      setNoteModified(false);
    } catch {
      showToast('Failed to create note', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!activeProject || !activeNote) return;
    try {
      updateProjectNoteStore(activeNote.id, noteTitle, noteContent);
      showToast('Note saved');
      setNoteModified(false);
      setActiveNote((prev) => (prev ? { ...prev, title: noteTitle, content: noteContent } : null));
    } catch {
      showToast('Failed to save note', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string, noteTitleStr: string) => {
    if (!activeProject) return;
    setConfirm({
      title: 'Delete Note',
      message: 'Delete "' + (noteTitleStr || 'Untitled') + '"? This cannot be undone.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          deleteProjectNoteStore(noteId);
          showToast('Note deleted');
          if (activeNote?.id === noteId) { setActiveNote(null); setNoteContent(''); setNoteTitle(''); setNoteModified(false); }
          fetchNotes(activeProject.id);
        } catch {
          showToast('Failed to delete note', 'error');
        }
      },
    });
  };

  const handleSelectNote = (note: ProjectNote) => {
    if (noteModified) {
      setConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Discard them?',
        onConfirm: () => {
          setConfirm(null);
          setActiveNote(note);
          setNoteTitle(note.title || '');
          setNoteContent(note.content || '');
          setNoteModified(false);
        },
      });
      return;
    }
    setActiveNote(note);
    setNoteTitle(note.title || '');
    setNoteContent(note.content || '');
    setNoteModified(false);
  };

  // ─── Task operations ────────────────────────────────

  const handleCreateTask = async () => {
    if (!activeProject || !newTask.title.trim()) { showToast('Task title is required', 'error'); return; }
    try {
      createProjectTaskStore(activeProject.id, newTask.title, newTask.description, 'todo', newTask.priority);
      showToast('Task created');
      setShowNewTaskModal(false);
      setNewTask({ title: '', description: '', priority: 'medium' });
      fetchTasks(activeProject.id);
    } catch {
      showToast('Failed to create task', 'error');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: ProjectTask['status']) => {
    if (!activeProject) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      updateProjectTaskStore(taskId, { status });
    } catch {
      showToast('Failed to update task', 'error');
      fetchTasks(activeProject.id);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject) return;
    try {
      deleteProjectTaskStore(taskId);
      showToast('Task deleted');
      fetchTasks(activeProject.id);
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  // ─── Drag & Drop ────────────────────────────────────

  const handleDragStart = (taskId: string) => setDragTask(taskId);

  const handleDrop = (status: ProjectTask['status']) => {
    if (dragTask) {
      handleUpdateTaskStatus(dragTask, status);
      setDragTask(null);
      setDragOverCol(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // ─── Task stats ─────────────────────────────────────

  const taskStats = useMemo(() => {
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return { todo, inProgress, done, total: tasks.length };
  }, [tasks]);

  // ─── Styles ─────────────────────────────────────────

  const glassCard: React.CSSProperties = {
    background: '#050505',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    border: '2px solid #333333',
    borderRadius: 0,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0a0a0a',
    border: '2px solid #333333',
    borderRadius: 0,
    padding: '10px 14px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 6, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.8px',
  };

  const btnBase: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 0, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    transition: 'all 0.2s', border: 'none', fontFamily: 'inherit',
  };

  const btnGhost: React.CSSProperties = {
    ...btnBase,
    background: '#0a0a0a',
    border: '2px solid #333333',
    color: 'rgba(255, 255, 255, 0.7)',
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: '#000000',
    border: '2px solid #333333',
    color: '#b0b8c4',
    boxShadow: '0 0 12px rgba(176, 184, 196, 0.1)',
  };

  const btnDanger: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(248, 113, 113, 0.1)',
    border: '2px solid #333333',
    color: '#ffffff',
  };

  // ─── Render: Project Sidebar ────────────────────────

  const renderSidebar = () => (
    <div className="neu-raised" style={{
      width: 260, minWidth: 260, display: 'flex', flexDirection: 'column' as const,
      borderRadius: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', borderBottom: '2px solid #333333',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '0.5px',
          }}>Projects</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 0,
            background: 'rgba(176, 184, 196, 0.1)', color: '#b0b8c4',
            fontWeight: 600,
          }}>{projects.length}</span>
        </div>
        <motion.button
          style={{
            width: 28, height: 28, borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(176, 184, 196, 0.08)', border: '2px solid #333333',
            color: '#b0b8c4', cursor: 'pointer', fontSize: 16,
          }}
          whileHover={{ scale: 1.05, background: 'rgba(176, 184, 196, 0.12)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewModal(true)}
        >
          +
        </motion.button>
      </div>

      {/* Search — neumorphic */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ position: 'relative' }} className="neu-search">
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: 'rgba(255, 255, 255, 0.25)', pointerEvents: 'none',
          }}>{'\u{1F50D}'}</span>
          <input
            style={{
              width: '100%', background: 'transparent', border: 'none', borderRadius: 0,
              padding: '8px 12px 8px 32px', fontSize: 12,
              color: 'rgba(255, 255, 255, 0.85)', outline: 'none', fontFamily: 'inherit',
            }}
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {loading ? (
          <Skeleton count={6} />
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>{'\u{1F4C1}'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.25)' }}>
              {searchQuery ? 'No matching projects' : 'No projects yet'}
            </div>
          </div>
        ) : (
          filteredProjects.map((p, i) => {
            const isActive = activeProject?.id === p.id;
            const color = p.color || '#b0b8c4';
            return (
              <motion.div
                key={p.id}
                className={isActive ? 'neu-flat' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 0, cursor: 'pointer',
                  background: isActive ? undefined : 'transparent',
                  border: isActive ? 'none' : '1px solid transparent',
                  marginBottom: 2, position: 'relative' as const,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                whileHover={{
                  background: isActive ? color + '18' : '#0a0a0a',
                }}
                onClick={() => setActiveProject(p)}
              >
                {/* Color dot with glow */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0,
                  boxShadow: isActive ? '0 0 8px ' + color + '66' : '0 0 4px ' + color + '33',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.75)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  }}>{p.name}</div>
                  {p.description && (
                    <div style={{
                      fontSize: 10, color: 'rgba(255, 255, 255, 0.3)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 1,
                    }}>{p.description}</div>
                  )}
                </div>
                {isActive && (
                  <motion.button
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0,
                    }}
                    whileHover={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                    title="Project settings"
                  >
                    {'\u2699'}
                  </motion.button>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Project settings panel */}
      <AnimatePresence>
        {showSettings && activeProject && (
          <motion.div
            style={{
              padding: '14px', borderTop: '2px solid #333333',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.35)',
              marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px',
            }}>Settings</div>

            {/* Edit name/description */}
            <motion.button
              style={{ ...btnGhost, width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 11 }}
              whileHover={{ background: 'rgba(176, 184, 196, 0.06)' }}
              onClick={() => {
                setEditName(activeProject.name);
                setEditDesc(activeProject.description || '');
                setEditingProject(true);
                setShowSettings(false);
              }}
            >
              {'\u270F'} Edit Project
            </motion.button>

            {/* Color picker */}
            <div style={{ marginBottom: 10 }}>
              <div style={labelStyle}>Color</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {PRESET_COLORS.map((c) => (
                  <motion.div
                    key={c}
                    style={{
                      width: 30, height: 30, borderRadius: 0, background: c, cursor: 'pointer',
                      border: activeProject.color === c ? '2px solid rgba(255, 255, 255, 0.8)' : '2px solid transparent',
                      boxShadow: activeProject.color === c ? '0 0 12px ' + c + '66' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleUpdateProject({ color: c })}
                  />
                ))}
              </div>
            </div>

            {/* Delete */}
            <motion.button
              style={{ ...btnDanger, width: '100%', justifyContent: 'center', fontSize: 11 }}
              whileHover={{ background: 'rgba(248, 113, 113, 0.18)' }}
              onClick={() => handleDeleteProject(activeProject.id)}
            >
              {'\u{1F5D1}'} Delete Project
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ─── Render: Project Header ─────────────────────────

  const renderProjectHeader = () => {
    if (!activeProject) return null;
    const color = activeProject.color || '#b0b8c4';
    return (
      <div style={{
        padding: '14px 20px', borderBottom: '2px solid #333333',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#050505',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
            boxShadow: '0 0 8px ' + color + '66',
          }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            {editingProject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  style={{ ...inputStyle, padding: '6px 10px', fontSize: 14, fontWeight: 600, maxWidth: 250 }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProjectEdit(); if (e.key === 'Escape') setEditingProject(false); }}
                />
                <input
                  style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, flex: 1, maxWidth: 300 }}
                  placeholder="Description (optional)"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProjectEdit(); if (e.key === 'Escape') setEditingProject(false); }}
                />
                <motion.button style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }} whileTap={{ scale: 0.95 }} onClick={handleSaveProjectEdit}>Save</motion.button>
                <motion.button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11 }} whileTap={{ scale: 0.95 }} onClick={() => setEditingProject(false)}>Cancel</motion.button>
              </div>
            ) : (
              <>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: 'rgba(255, 255, 255, 0.92)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                }}>{activeProject.name}</div>
                {activeProject.description && (
                  <div style={{
                    fontSize: 11, color: 'rgba(255, 255, 255, 0.35)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  }}>{activeProject.description}</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {!editingProject && (
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 0,
              background: 'rgba(176, 184, 196, 0.06)', border: '2px solid #333333',
            }}>
              <span style={{ fontSize: 11 }}>{'\u{1F4C4}'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#b0b8c4' }}>{files.length}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 0,
              background: 'rgba(168, 85, 247, 0.06)', border: '2px solid #333333',
            }}>
              <span style={{ fontSize: 11 }}>{'\u{1F4DD}'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#a855f7' }}>{notes.length}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 0,
              background: 'rgba(52, 211, 153, 0.06)', border: '2px solid #333333',
            }}>
              <span style={{ fontSize: 11 }}>{'\u2705'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#c0c0c0' }}>{taskStats.done}/{taskStats.total}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Tab Bar ────────────────────────────────

  const renderTabBar = () => (
    <div style={{
      display: 'flex', alignItems: 'center',
      borderBottom: '2px solid #333333',
      padding: '0 16px', background: 'rgba(13, 14, 19, 0.3)',
    }}>
      {([
        { key: 'files' as ActiveTab, icon: '\u{1F4C1}', label: 'Files' },
        { key: 'notes' as ActiveTab, icon: '\u{1F4DD}', label: 'Notes' },
        { key: 'tasks' as ActiveTab, icon: '\u2705', label: 'Tasks' },
      ]).map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <motion.button
            key={tab.key}
            style={{
              padding: '12px 20px', fontSize: 12, fontWeight: 600,
              color: isActive ? '#b0b8c4' : 'rgba(255, 255, 255, 0.35)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: isActive ? '2px solid #b0b8c4' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.2s, border-color 0.2s',
              textTransform: 'uppercase' as const, letterSpacing: '0.5px',
              fontFamily: 'inherit',
            }}
            whileHover={{ color: isActive ? '#b0b8c4' : 'rgba(255, 255, 255, 0.6)' }}
            onClick={() => setActiveTab(tab.key)}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            {tab.label}
          </motion.button>
        );
      })}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {activeTab === 'files' && (
          <motion.button style={{ ...btnPrimary, padding: '6px 14px', fontSize: 11 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewFileModal(true)}>
            + File
          </motion.button>
        )}
        {activeTab === 'notes' && (
          <motion.button style={{ ...btnPrimary, padding: '6px 14px', fontSize: 11 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateNote}>
            + Note
          </motion.button>
        )}
        {activeTab === 'tasks' && (
          <motion.button style={{ ...btnPrimary, padding: '6px 14px', fontSize: 11 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewTaskModal(true)}>
            + Task
          </motion.button>
        )}
      </div>
    </div>
  );

  // ─── Render: Files Tab ──────────────────────────────

  const renderFilesTab = () => {
    if (filesLoading) return <div style={{ padding: 12 }}><Skeleton count={8} /></div>;
    return (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list */}
        <div style={{
          width: 230, minWidth: 230, borderRight: '2px solid #333333',
          overflowY: 'auto', padding: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)',
            textTransform: 'uppercase', letterSpacing: '0.8px', padding: '6px 8px 8px',
          }}>
            Files ({files.length})
          </div>
          {files.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'rgba(255, 255, 255, 0.2)' }}>
              No files yet
            </div>
          ) : files.map((f, i) => {
            const isActive = activeFile?.id === f.id;
            return (
              <motion.div
                key={f.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 0, cursor: 'pointer',
                  fontSize: 12, color: isActive ? '#b0b8c4' : 'rgba(255, 255, 255, 0.65)',
                  background: isActive ? 'rgba(176, 184, 196, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(176, 184, 196, 0.15)' : '1px solid transparent',
                  marginBottom: 2, transition: 'all 0.15s',
                }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ background: isActive ? 'rgba(176, 184, 196, 0.1)' : '#0a0a0a' }}
                onClick={() => handleSelectFile(f)}
              >
                <span style={{ fontSize: 12 }}>{f.is_directory ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  fontWeight: isActive ? 500 : 400,
                }}>{f.name}</span>
                <motion.button
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255, 255, 255, 0.15)', cursor: 'pointer', fontSize: 10, padding: '2px 4px',
                    borderRadius: 0, lineHeight: 1,
                  }}
                  whileHover={{ color: '#ffffff', background: 'rgba(248, 113, 113, 0.1)' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id, f.name); }}
                  title="Delete file"
                >
                  {'\u2715'}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', padding: 0 }}>
          {activeFile ? (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderBottom: '2px solid #333333',
                background: 'rgba(13, 14, 19, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }}>{'\u{1F4C4}'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                    {activeFile.name}
                  </span>
                  {fileModified && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 0,
                      background: 'rgba(234, 179, 8, 0.12)', color: '#eab308', fontWeight: 600,
                    }}>MODIFIED</span>
                  )}
                </div>
                <motion.button
                  style={{
                    ...btnPrimary, padding: '6px 16px', fontSize: 11,
                    opacity: fileModified ? 1 : 0.5,
                  }}
                  whileHover={fileModified ? { scale: 1.03 } : {}}
                  whileTap={fileModified ? { scale: 0.97 } : {}}
                  onClick={handleSaveFile}
                >
                  {'\u{1F4BE}'} Save
                </motion.button>
              </div>
              <textarea
                style={{
                  flex: 1, width: '100%', background: 'rgba(0, 0, 0, 0.2)',
                  border: 'none', padding: '16px 20px',
                  color: 'rgba(255, 255, 255, 0.88)', fontSize: 13, lineHeight: 1.7,
                  fontFamily: "'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
                  resize: 'none' as const, outline: 'none', boxSizing: 'border-box' as const,
                }}
                value={fileContent}
                onChange={(e) => { setFileContent(e.target.value); setFileModified(true); }}
                placeholder="Start writing..."
                spellCheck={false}
              />
            </>
          ) : (
            <EmptyState
              icon={'\u{1F4C4}'}
              title="No file selected"
              description="Select a file from the list to view or edit its content"
            />
          )}
        </div>
      </div>
    );
  };

  // ─── Render: Notes Tab ──────────────────────────────

  const renderNotesTab = () => {
    if (notesLoading) return <div style={{ padding: 12 }}><Skeleton count={6} /></div>;
    return (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Note list */}
        <div style={{
          width: 240, minWidth: 240, borderRight: '2px solid #333333',
          overflowY: 'auto', padding: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)',
            textTransform: 'uppercase', letterSpacing: '0.8px', padding: '6px 8px 8px',
          }}>
            Notes ({notes.length})
          </div>
          {notes.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'rgba(255, 255, 255, 0.2)' }}>
              No notes yet
            </div>
          ) : notes.map((n, i) => {
            const isActive = activeNote?.id === n.id;
            return (
              <motion.div
                key={n.id}
                style={{
                  padding: '10px 12px', borderRadius: 0, cursor: 'pointer',
                  background: isActive ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid transparent',
                  marginBottom: 4, position: 'relative' as const, transition: 'all 0.15s',
                }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ background: isActive ? 'rgba(168, 85, 247, 0.12)' : '#0a0a0a' }}
                onClick={() => handleSelectNote(n)}
              >
                <div style={{
                  fontSize: 12, fontWeight: 600, color: isActive ? '#a855f7' : 'rgba(255, 255, 255, 0.75)',
                  marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  paddingRight: 20,
                }}>
                  {n.title || 'Untitled'}
                </div>
                <div style={{
                  fontSize: 10, color: 'rgba(255, 255, 255, 0.25)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                }}>
                  {n.content ? n.content.substring(0, 60) : 'Empty note'}
                </div>
                <motion.button
                  style={{
                    position: 'absolute' as const, top: 10, right: 8,
                    background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer', fontSize: 10, padding: '2px 4px', borderRadius: 0,
                  }}
                  whileHover={{ color: '#ffffff', background: 'rgba(248, 113, 113, 0.1)' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id, n.title); }}
                  title="Delete note"
                >
                  {'\u2715'}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Note editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
          {activeNote ? (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderBottom: '2px solid #333333',
                background: 'rgba(13, 14, 19, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12 }}>{'\u{1F4DD}'}</span>
                  <input
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 14, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)',
                      flex: 1, minWidth: 0, fontFamily: 'inherit', padding: '2px 0',
                    }}
                    value={noteTitle}
                    onChange={(e) => { setNoteTitle(e.target.value); setNoteModified(true); }}
                    placeholder="Note title..."
                  />
                  {noteModified && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 0,
                      background: 'rgba(234, 179, 8, 0.12)', color: '#eab308', fontWeight: 600,
                      flexShrink: 0,
                    }}>MODIFIED</span>
                  )}
                </div>
                <motion.button
                  style={{
                    ...btnPrimary, padding: '6px 16px', fontSize: 11, flexShrink: 0, marginLeft: 12,
                    opacity: noteModified ? 1 : 0.5,
                  }}
                  whileHover={noteModified ? { scale: 1.03 } : {}}
                  whileTap={noteModified ? { scale: 0.97 } : {}}
                  onClick={handleSaveNote}
                >
                  {'\u{1F4BE}'} Save
                </motion.button>
              </div>
              <textarea
                style={{
                  flex: 1, width: '100%', background: 'rgba(0, 0, 0, 0.15)',
                  border: 'none', padding: '16px 20px',
                  color: 'rgba(255, 255, 255, 0.85)', fontSize: 13, lineHeight: 1.7,
                  fontFamily: 'inherit', resize: 'none' as const, outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
                value={noteContent}
                onChange={(e) => { setNoteContent(e.target.value); setNoteModified(true); }}
                placeholder="Write your note..."
              />
            </>
          ) : (
            <EmptyState
              icon={'\u{1F4DD}'}
              title="No note selected"
              description="Select a note from the list or create a new one"
              action={handleCreateNote}
              actionLabel="New Note"
            />
          )}
        </div>
      </div>
    );
  };

  // ─── Render: Tasks Tab (Kanban) ─────────────────────

  const renderTasksTab = () => {
    if (tasksLoading) return <div style={{ padding: 12 }}><Skeleton count={6} /></div>;

    const columns: { status: ProjectTask['status']; label: string; icon: string }[] = [
      { status: 'todo', label: 'To Do', icon: '\u{1F4CB}' },
      { status: 'in_progress', label: 'In Progress', icon: '\u26A1' },
      { status: 'done', label: 'Done', icon: '\u2705' },
    ];

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        {/* Task stats bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px',
          borderBottom: '2px solid #333333',
          background: 'rgba(13, 14, 19, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 0, background: 'rgba(255, 255, 255, 0.4)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)' }}>To Do: <strong style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{taskStats.todo}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 0, background: '#b0b8c4' }} />
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)' }}>In Progress: <strong style={{ color: '#b0b8c4' }}>{taskStats.inProgress}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 0, background: '#c0c0c0' }} />
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)' }}>Done: <strong style={{ color: '#c0c0c0' }}>{taskStats.done}</strong></span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255, 255, 255, 0.3)' }}>
            {taskStats.total} task{taskStats.total !== 1 ? 's' : ''} total
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: 16, overflowX: 'auto' }}>
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            const statusConf = STATUS_CONFIG[col.status as keyof typeof STATUS_CONFIG];
            const isDragOver = dragOverCol === col.status;
            return (
              <div
                key={col.status}
                style={{
                  flex: 1, minWidth: 220, borderRadius: 0,
                  background: isDragOver ? 'rgba(176, 184, 196, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                  border: isDragOver ? '1px dashed rgba(176, 184, 196, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                  display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => { handleDrop(col.status); setDragOverCol(null); }}
              >
                {/* Column header */}
                <div style={{
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '2px solid #333333',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{col.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                      letterSpacing: '0.8px', color: statusConf.color,
                      textShadow: statusConf.glow !== 'none' ? statusConf.glow : 'none',
                    }}>{col.label}</span>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 0,
                    background: '#0a0a0a',
                    color: 'rgba(255, 255, 255, 0.35)', fontWeight: 600,
                  }}>{colTasks.length}</span>
                </div>

                {/* Column body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 80 }}>
                  {colTasks.length === 0 ? (
                    <div style={{
                      padding: '20px 8px', textAlign: 'center', fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.15)', fontStyle: 'italic',
                    }}>
                      {isDragOver ? 'Drop here' : 'No tasks'}
                    </div>
                  ) : colTasks.map((task, i) => {
                    const priority = PRIORITY_CONFIG[(task.priority || 'medium') as keyof typeof PRIORITY_CONFIG];
                    return (
                      <motion.div
                        key={task.id}
                        style={{
                          background: 'rgba(13, 14, 19, 0.8)',
                          border: '2px solid #333333',
                          borderRadius: 0, padding: '12px 14px', marginBottom: 6,
                          cursor: 'grab', position: 'relative' as const,
                          opacity: dragTask === task.id ? 0.4 : 1,
                          transition: 'opacity 0.2s',
                        }}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onDragEnd={() => { setDragTask(null); setDragOverCol(null); }}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                        whileHover={{
                          borderColor: '#1a1a1a',
                          background: 'rgba(13, 14, 19, 0.95)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)',
                            flex: 1, lineHeight: 1.4, paddingRight: 8,
                          }}>{task.title}</span>
                          <motion.button
                            style={{
                              background: 'none', border: 'none',
                              color: 'rgba(255, 255, 255, 0.15)', cursor: 'pointer',
                              fontSize: 10, padding: '2px 4px', borderRadius: 0, flexShrink: 0,
                            }}
                            whileHover={{ color: '#ffffff', background: 'rgba(248, 113, 113, 0.1)' }}
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            {'\u2715'}
                          </motion.button>
                        </div>
                        {task.description && (
                          <div style={{
                            fontSize: 11, color: 'rgba(255, 255, 255, 0.35)',
                            marginBottom: 8, lineHeight: 1.4,
                          }}>
                            {task.description.substring(0, 100)}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 0,
                            background: priority.bg, border: '1px solid ' + priority.border,
                            color: priority.color, letterSpacing: '0.5px',
                          }}>{priority.label}</span>
                        </div>

                        {/* Status action buttons */}
                        <div style={{
                          display: 'flex', gap: 4, marginTop: 8, paddingTop: 8,
                          borderTop: '2px solid #333333',
                        }}>
                          {columns.filter((c) => c.status !== task.status).map((c) => (
                            <motion.button
                              key={c.status}
                              style={{
                                flex: 1, padding: '4px 0', borderRadius: 0, fontSize: 9, fontWeight: 600,
                                background: '#0a0a0a',
                                border: '2px solid #333333',
                                color: STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG].color,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                              whileHover={{ background: '#0a0a0a' }}
                              onClick={() => handleUpdateTaskStatus(task.id, c.status)}
                            >
                              {c.label}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────

  return (
    <motion.div
      style={{
        display: 'flex', height: '100%', background: 'var(--bg-primary, #0a0a1a)',
        color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'inherit', overflow: 'hidden',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Left sidebar: project list */}
      {renderSidebar()}

      {/* Center: project view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', minWidth: 0 }}>
        {!activeProject ? (
          <EmptyState
            icon={'\u{1F4C1}'}
            title="Select a project"
            description="Choose a project from the sidebar or create a new one to get started"
            action={() => setShowNewModal(true)}
            actionLabel="New Project"
          />
        ) : (
          <>
            {renderProjectHeader()}
            {renderTabBar()}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'files' && renderFilesTab()}
                  {activeTab === 'notes' && renderNotesTab()}
                  {activeTab === 'tasks' && renderTasksTab()}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────── */}

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewModal && (
          <ModalShell onClose={() => setShowNewModal(false)}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255, 255, 255, 0.92)', marginBottom: 20 }}>
              Create New Project
            </div>
            <label style={labelStyle}>Name *</label>
            <input
              style={{ ...inputStyle, marginBottom: 14 }}
              placeholder="My Awesome Project"
              value={newProject.name}
              onChange={(e) => setNewProject((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
            />
            <label style={labelStyle}>Description</label>
            <textarea
              style={{
                ...inputStyle, minHeight: 70, resize: 'vertical' as const,
                marginBottom: 14, lineHeight: 1.5,
              }}
              placeholder="What's this project about?"
              value={newProject.description}
              onChange={(e) => setNewProject((prev) => ({ ...prev, description: e.target.value }))}
            />
            <label style={labelStyle}>Color</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
              {PRESET_COLORS.map((c) => (
                <motion.div
                  key={c}
                  style={{
                    width: 34, height: 34, borderRadius: 0, background: c, cursor: 'pointer',
                    border: newProject.color === c ? '2px solid rgba(255, 255, 255, 0.85)' : '2px solid transparent',
                    boxShadow: newProject.color === c ? '0 0 14px ' + c + '66' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setNewProject((prev) => ({ ...prev, color: c }))}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleCreateProject}
              >
                Create Project
              </motion.button>
              <motion.button
                style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </motion.button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* New File Modal */}
      <AnimatePresence>
        {showNewFileModal && (
          <ModalShell onClose={() => setShowNewFileModal(false)} width={360}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255, 255, 255, 0.92)', marginBottom: 20 }}>
              Create New File
            </div>
            <label style={labelStyle}>File Name *</label>
            <input
              style={{ ...inputStyle, marginBottom: 20 }}
              placeholder="e.g. index.tsx, notes.md, README.md"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile(); }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleCreateFile}
              >
                Create File
              </motion.button>
              <motion.button
                style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={() => setShowNewFileModal(false)}
              >
                Cancel
              </motion.button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <ModalShell onClose={() => setShowNewTaskModal(false)} width={400}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255, 255, 255, 0.92)', marginBottom: 20 }}>
              Create New Task
            </div>
            <label style={labelStyle}>Title *</label>
            <input
              style={{ ...inputStyle, marginBottom: 14 }}
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
              autoFocus
            />
            <label style={labelStyle}>Description</label>
            <textarea
              style={{
                ...inputStyle, minHeight: 60, resize: 'vertical' as const,
                marginBottom: 14, lineHeight: 1.5,
              }}
              placeholder="Task details..."
              value={newTask.description}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
            />
            <label style={labelStyle}>Priority</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['low', 'medium', 'high'] as const).map((p) => {
                const conf = PRIORITY_CONFIG[p];
                const isSelected = newTask.priority === p;
                return (
                  <motion.button
                    key={p}
                    style={{
                      ...btnBase, flex: 1, justifyContent: 'center', padding: '9px 0',
                      background: isSelected ? conf.bg : '#0a0a0a',
                      border: isSelected ? '1px solid ' + conf.border : '1px solid rgba(255, 255, 255, 0.06)',
                      color: isSelected ? conf.color : 'rgba(255, 255, 255, 0.45)',
                      fontSize: 12,
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setNewTask((prev) => ({ ...prev, priority: p }))}
                  >
                    {conf.label}
                  </motion.button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handleCreateTask}
              >
                Create Task
              </motion.button>
              <motion.button
                style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '11px 0', fontSize: 13 }}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={() => setShowNewTaskModal(false)}
              >
                Cancel
              </motion.button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
            danger={confirm.danger}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        textarea:focus, input:focus {
          border-color: rgba(176, 184, 196, 0.4) !important;
          box-shadow: 0 0 0 3px rgba(176, 184, 196, 0.08), 0 0 16px rgba(176, 184, 196, 0.1) !important;
        }
      `}</style>
    </motion.div>
  );
}

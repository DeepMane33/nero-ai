'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthHeaders } from '@/lib/user-id';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Conversation {
  id: string;
  title: string;
  preview?: string;
  brain_type?: string;
  folder?: string;
  is_pinned?: boolean;
  message_count?: number;
  last_message_at?: string;
  created_at?: string;
}

interface Folder {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  conversationId: string | null;
}

interface SortOption {
  id: string;
  label: string;
  icon: string;
}

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  isVisible: boolean;
  onToggle: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FOLDERS: Folder[] = [
  { id: 'all', name: 'All', icon: 'chat', color: '#808080' },
  { id: 'default', name: 'Default', icon: 'home', color: '#808080' },
  { id: 'research', name: 'Research', icon: 'search', color: '#b4a0d4' },
  { id: 'code', name: 'Code', icon: 'code', color: '#8fb996' },
  { id: 'creative', name: 'Creative', icon: 'sparkle', color: '#808080' },
  { id: 'analysis', name: 'Analysis', icon: 'chart', color: '#c8b86a' },
  { id: 'archive', name: 'Archive', icon: 'archive', color: '#555a63' },
];

const BRAIN_BADGES: Record<string, { color: string; label: string }> = {
  default: { color: '#808080', label: 'General' },
  research: { color: '#b4a0d4', label: 'Research' },
  code: { color: '#8fb996', label: 'Code' },
  creative: { color: '#808080', label: 'Creative' },
  analysis: { color: '#c8b86a', label: 'Analysis' },
};

const SORT_OPTIONS: SortOption[] = [
  { id: 'recent', label: 'Most Recent', icon: 'clock' },
  { id: 'oldest', label: 'Oldest First', icon: 'calendar' },
  { id: 'alpha', label: 'A \u2192 Z', icon: 'alpha' },
  { id: 'messages', label: 'Most Messages', icon: 'messages' },
];

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return diffMin + 'm';
  if (diffHr < 24) return diffHr + 'h';
  if (diffDay < 7) return diffDay + 'd';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateGroup(dateStr?: string): string {
  if (!dateStr) return 'Older';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay < 1) return 'Today';
  if (diffDay < 2) return 'Yesterday';
  if (diffDay < 7) return 'This Week';
  if (diffDay < 30) return 'This Month';
  return 'Older';
}

function sortConversations(list: Conversation[], sortBy: string): Conversation[] {
  const sorted = [...list];
  switch (sortBy) {
    case 'recent':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.created_at || 0).getTime();
        const dateB = new Date(b.last_message_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
    case 'oldest':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
    case 'alpha':
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'messages':
      return sorted.sort((a, b) => (b.message_count || 0) - (a.message_count || 0));
    default:
      return sorted;
  }
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5" />
    <path d="M9 2h6l-1 7h4l-6 8h-1l1-5H7l2-10z" />
  </svg>
);

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const FolderIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ExportIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SortIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="16" y2="6" />
    <line x1="4" y1="12" x2="12" y2="12" />
    <line x1="4" y1="18" x2="8" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BulkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

/* Folder & Sort SVG Icons */
const FolderIconMap: Record<string, () => React.JSX.Element> = {
  chat: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  home: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  search: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  code: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  sparkle: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  ),
  chart: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  archive: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
};

const SortIconMap: Record<string, () => React.JSX.Element> = {
  clock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  calendar: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  alpha: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
    </svg>
  ),
  messages: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isVisible,
  onToggle,
}: ConversationSidebarProps) {
  /* ---- State ---- */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, conversationId: null,
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  /* ---- Refs ---- */
  const contextRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Helpers ---- */
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---- Data fetching ---- */
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFolder !== 'all') params.set('folder', activeFolder);
      if (debouncedQuery) params.set('search', debouncedQuery);
      const res = await fetch('/api/conversations?' + params.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const convs = data.conversations || data || [];
      setConversations(convs);
      setTotalCount(convs.length);
    } catch {
      showToast('Failed to load conversations', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFolder, debouncedQuery, showToast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* ---- Search debounce ---- */
  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedQuery(val), 300);
  };

  /* ---- Close menus on outside click ---- */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (contextRef.current && !contextRef.current.contains(target)) {
        setContextMenu(c => ({ ...c, visible: false }));
      }
      if (!target.closest('[data-sort-menu]')) {
        setShowSortMenu(false);
      }
      if (!target.closest('[data-move-menu]')) {
        setMoveMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          onToggle();
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
        return;
      }
      if (e.key === 'Escape') {
        if (bulkMode) {
          setBulkMode(false);
          setSelectedIds(new Set());
        } else if (contextMenu.visible) {
          setContextMenu(c => ({ ...c, visible: false }));
        } else if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else {
          onToggle();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onToggle, onNewChat, bulkMode, contextMenu.visible, deleteConfirmId]);

  /* ---- Sort + filter + group ---- */
  const processedConversations = useMemo(() => {
    let list = [...conversations];
    list = sortConversations(list, sortBy);
    return list;
  }, [conversations, sortBy]);

  const pinned = useMemo(
    () => processedConversations.filter(c => c.is_pinned),
    [processedConversations]
  );
  const unpinned = useMemo(
    () => processedConversations.filter(c => !c.is_pinned),
    [processedConversations]
  );

  const dateGroups = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    for (const c of unpinned) {
      const group = getDateGroup(c.last_message_at || c.created_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(c);
    }
    return groups;
  }, [unpinned]);

  /* ---- Actions ---- */
  const handleContextMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, conversationId: convId });
  };

  const handlePin = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    try {
      await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id, is_pinned: !conv.is_pinned }),
      });
      showToast(conv.is_pinned ? 'Unpinned conversation' : 'Pinned conversation');
      fetchConversations();
    } catch {
      showToast('Failed to update pin', 'error');
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id }),
      });
      showToast('Conversation deleted');
      fetchConversations();
    } catch {
      showToast('Failed to delete', 'error');
    }
    setDeleteConfirmId(null);
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch('/api/conversations', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ id }),
          })
        )
      );
      showToast(selectedIds.size + ' conversations deleted');
      setSelectedIds(new Set());
      setBulkMode(false);
      fetchConversations();
    } catch {
      showToast('Failed to delete some conversations', 'error');
    }
  };

  const handleRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id, title: renameValue.trim() }),
      });
      showToast('Renamed');
      fetchConversations();
    } catch {
      showToast('Failed to rename', 'error');
    }
    setRenamingId(null);
  };

  const handleMoveToFolder = async (id: string, folder: string) => {
    try {
      await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id, folder }),
      });
      const folderName = FOLDERS.find(f => f.id === folder)?.name || folder;
      showToast('Moved to ' + folderName);
      fetchConversations();
    } catch {
      showToast('Failed to move', 'error');
    }
    setMoveMenuOpen(false);
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleExport = async (id: string, format: 'json' | 'markdown' = 'json') => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    if (format === 'markdown') {
      try {
        const res = await fetch(`/api/messages?conversationId=${id}`, { headers: getAuthHeaders() });
        const data = await res.json();
        const messages = data.messages || data || [];
        let md = `# ${conv.title || 'Conversation'}\n\n`;
        for (const msg of messages) {
          const role = msg.role === 'user' ? '**You**' : '**Nero**';
          md += `${role}:\n${msg.content}\n\n---\n\n`;
        }
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (conv.title || 'conversation') + '.md';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported as Markdown');
      } catch {
        showToast('Failed to export', 'error');
      }
    } else {
      const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (conv.title || 'conversation') + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported as JSON');
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(processedConversations.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  /* ---- Render helpers ---- */
  const renderSkeletons = () => (
    <>
      {[1, 2, 3, 4, 5].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.08 }}
          style={{
            height: 60,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-glass-light)',
            marginBottom: 4,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000000',
            animation: 'shimmer 1.5s infinite',
          }} />
        </motion.div>
      ))}
    </>
  );

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeConversationId;
    const isSelected = selectedIds.has(conv.id);
    const badge = BRAIN_BADGES[conv.brain_type || 'default'] || BRAIN_BADGES.default;
    const isRenaming = renamingId === conv.id;

    return (
      <motion.div
        key={conv.id}
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8, height: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => {
          if (bulkMode) {
            toggleBulkSelect(conv.id);
          } else if (!isRenaming) {
            onSelectConversation(conv.id);
          }
        }}
        onContextMenu={(e) => !bulkMode && handleContextMenu(e, conv.id)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: isActive
            ? 'var(--accent-dim)'
            : isSelected
              ? 'var(--accent-subtle)'
              : 'transparent',
          border: isActive
            ? '1px solid var(--accent-glass)'
            : isSelected
              ? '1px solid var(--accent-subtle)'
              : '1px solid transparent',
          marginBottom: 2,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isActive && !isSelected) {
            (e.currentTarget as HTMLElement).style.background = 'var(--accent-subtle)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive && !isSelected) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        {/* Bulk checkbox */}
        {bulkMode && (
          <div style={{
            width: 16,
            height: 16,
            borderRadius: 0,
            border: isSelected
              ? '1.5px solid var(--accent)'
              : '1.5px solid var(--text-tertiary)',
            background: isSelected ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
            color: 'var(--bg-primary)',
          }}>
            {isSelected && <CheckIcon />}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 2,
          }}>
            {isRenaming ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(conv.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit(conv.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1,
                  background: '#0a0a0a',
                  border: '1px solid var(--accent)',
                  borderRadius: 0,
                  padding: '2px 6px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            ) : (
              <span style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {conv.title || 'Untitled'}
              </span>
            )}

            {conv.is_pinned && (
              <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>
                <PinIcon filled />
              </span>
            )}

            <span style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 0,
              background: badge.color + '22',
              color: badge.color,
              border: '1px solid ' + badge.color + '44',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {badge.label}
            </span>
          </div>

          {conv.preview && !isRenaming && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 2,
            }}>
              {conv.preview}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10,
            color: 'var(--text-tertiary)',
          }}>
            <span>{getRelativeTime(conv.last_message_at || conv.created_at)}</span>
            <span style={{ opacity: 0.5 }}>\u00B7</span>
            <span>{(conv.message_count ?? 0) + ' msgs'}</span>
            {conv.folder && conv.folder !== 'default' && (
              <>
                <span style={{ opacity: 0.3 }}>\u00B7</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {FOLDERS.find(f => f.id === conv.folder)?.name || conv.folder}
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu.visible || !contextMenu.conversationId) return null;
    const conv = conversations.find(c => c.id === contextMenu.conversationId);
    if (!conv) return null;

    // Adjust position to stay in viewport
    const menuWidth = 180;
    const menuHeight = 260;
    let x = contextMenu.x;
    let y = contextMenu.y;
    if (typeof window !== 'undefined') {
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
    }

    const itemStyle = (danger?: boolean) => ({
      display: 'flex' as const,
      alignItems: 'center' as const,
      gap: 8,
      padding: '7px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 12,
      color: danger ? 'var(--color-error)' : 'var(--text-primary)',
      cursor: 'pointer' as const,
      border: 'none',
      background: 'transparent',
      width: '100%',
      textAlign: 'left' as const,
      transition: 'background 0.1s',
    });

    return (
      <motion.div
        ref={contextRef}
        initial={{ opacity: 0, scale: 0.92, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: -4 }}
        transition={{ duration: 0.12 }}            className="glass-context-menu"
            style={{
          position: 'fixed',
          left: x,
          top: y,
          background: 'var(--bg-glass-heavy)',

          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-md)',
          padding: 4,
          zIndex: 200,
          minWidth: menuWidth,
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <button
          style={itemStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handlePin(conv.id)}
        >
          <PinIcon filled={conv.is_pinned} />
          {conv.is_pinned ? 'Unpin' : 'Pin to top'}
        </button>

        <button
          style={itemStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handleRename(conv.id, conv.title || '')}
        >
          <EditIcon />
          Rename
        </button>

        <div style={{ position: 'relative' }} data-move-menu>
          <button
            style={itemStyle()}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              setMoveMenuOpen(true);
            }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FolderIcon />
            Move to folder
            <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: 10 }}>\u25B8</span>
          </button>
          <AnimatePresence>
            {moveMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className="glass-context-menu"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  background: 'var(--bg-glass-heavy)',

                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 4,
                  minWidth: 130,
                  zIndex: 201,
                  boxShadow: 'var(--shadow-elevated)',
                }}
              >
                {FOLDERS.filter(f => f.id !== 'all').map(f => (
                  <button
                    key={f.id}
                    style={itemStyle()}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => handleMoveToFolder(conv.id, f.id)}
                  >
                    <span style={{ fontSize: 12 }}>{f.icon}</span>
                    {f.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          style={itemStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handleExport(conv.id, 'json')}
        >
          <ExportIcon />
          Export as JSON
        </button>

        <button
          style={itemStyle()}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handleExport(conv.id, 'markdown')}
        >
          <ExportIcon />
          Export as Markdown
        </button>

        <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />

        {deleteConfirmId === conv.id ? (
          <div style={{ padding: '6px 10px' }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}>
              Delete this conversation?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{
                  ...itemStyle(true),
                  padding: '4px 10px',
                  fontSize: 11,
                  background: 'rgba(248, 113, 113, 0.15)',
                  borderRadius: 0,
                  flex: 1,
                  justifyContent: 'center',
                }}
                onClick={() => handleDelete(conv.id)}
              >
                Delete
              </button>
              <button
                style={{
                  ...itemStyle(),
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 0,
                  flex: 1,
                  justifyContent: 'center',
                }}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            style={itemStyle(true)}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setDeleteConfirmId(conv.id)}
          >
            <TrashIcon />
            Delete
          </button>
        )}
      </motion.div>
    );
  };

  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ opacity: 0.2 }}>
        {debouncedQuery ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
      }}>
        {debouncedQuery ? 'No results found' : 'No conversations yet'}
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        lineHeight: 1.6,
        maxWidth: 200,
      }}>
        {debouncedQuery
          ? 'Try a different search term or clear filters.'
          : 'Start a new chat to begin exploring ideas with your AI assistant.'}
      </div>
      {!debouncedQuery && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-glass)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 16px',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          <PlusIcon />
          Start New Chat
        </motion.button>
      )}
    </motion.div>
  );

  /* ---- Folder counts ---- */
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: conversations.length };
    for (const c of conversations) {
      const f = c.folder || 'default';
      counts[f] = (counts[f] || 0) + 1;
    }
    return counts;
  }, [conversations]);

  /* ---- Bulk toolbar ---- */
  const renderBulkToolbar = () => {
    if (!bulkMode) return null;
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--accent-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent)',
          }}>
            {selectedIds.size + ' selected'}
          </span>
          <button
            onClick={selectAll}
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            All
          </button>
          <button
            onClick={deselectAll}
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            None
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {selectedIds.size > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBulkDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(248, 113, 113, 0.12)',
                border: '2px solid #333333',
                borderRadius: 0,
                color: 'var(--color-error)',
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              <TrashIcon />
              Delete
            </motion.button>
          )}
          <button
            onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#0a0a0a',
              border: '1px solid var(--glass-border)',
              borderRadius: 0,
              color: 'var(--text-secondary)',
              fontSize: 10,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            <CloseIcon />
            Cancel
          </button>
        </div>
      </motion.div>
    );
  };

  /* ---- Main render ---- */
  return (
    <>
      {/* Toggle button (visible when sidebar is hidden) */}
      <AnimatePresence>
        {!isVisible && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            whileHover={{
              background: 'var(--accent-dim)',
              borderColor: 'var(--accent-glass)',
            }}
            onClick={onToggle}
            title="Open conversations (Ctrl+K)"
            style={{
              position: 'fixed',
              top: 12,
              left: 268,
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-glass-heavy)',

              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 60,
            }}
          >
            <MenuIcon />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar panel (no backdrop — this is a persistent sidebar, not a modal) */}
      <AnimatePresence>
        {isVisible && (
          <>
            {/* Panel */}
            <motion.aside
              ref={sidebarRef}
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="glass-panel-strong"
              style={{
                position: 'fixed',
                top: 0,
                left: 260,
                bottom: 0,
                width: 280,
                background: 'var(--sidebar-bg)',

                borderRight: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderBottom: '1px solid var(--glass-border)',
              }}>
                {/* Title row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '0.02em',
                    }}>
                      History
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      background: '#0a0a0a',
                      padding: '1px 6px',
                      borderRadius: 0,
                    }}>
                      {totalCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={onNewChat}
                      title="New Chat (Ctrl+N)"
                      className="glass-btn"
                      style={{
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-glass)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                      }}
                    >
                      <PlusIcon />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setBulkMode(!bulkMode)}
                      title="Bulk select"
                      className="glass-btn"
                      style={{
                        background: bulkMode
                          ? 'var(--accent-dim)'
                          : '#0a0a0a',
                        border: '1px solid',
                        borderColor: bulkMode
                          ? 'var(--accent-glass)'
                          : 'var(--glass-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: bulkMode ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                      }}
                    >
                      <BulkIcon />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={onToggle}
                      title="Close (Esc)"
                      className="glass-btn"
                      style={{
                        background: '#0a0a0a',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                      }}
                    >
                      <CloseIcon />
                    </motion.button>
                  </div>
                </div>

                {/* Search bar */}
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none',
                    display: 'flex',
                  }}>
                    <SearchIcon />
                  </span>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    placeholder="Search conversations..."
                    style={{
                      width: '100%',
                      background: '#0a0a0a',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '7px 8px 7px 32px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-glass)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-dim)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                      }}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* Folder tabs */}
              <div style={{
                display: 'flex',
                gap: 2,
                padding: '6px 12px',
                borderBottom: '1px solid var(--glass-border)',
                overflowX: 'auto',
              }}>
                {FOLDERS.map(f => {
                  const isActive = activeFolder === f.id;
                  const count = folderCounts[f.id] || 0;
                  return (
                    <motion.button
                      key={f.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveFolder(f.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                        background: isActive ? 'var(--accent-dim)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'color 0.15s, background 0.15s',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.6 }}>
                        {FolderIconMap[f.icon]?.() || null}
                      </span>
                      {f.name}
                      {count > 0 && f.id !== 'all' && (
                        <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 2 }}>
                          {count}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Sort bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 12px',
                borderBottom: '1px solid var(--glass-border)',
              }}>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                }}>
                  {processedConversations.length + ' conversation' + (processedConversations.length !== 1 ? 's' : '')}
                </span>
                <div style={{ position: 'relative' }} data-sort-menu>
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 0,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    <SortIcon />
                    {SORT_OPTIONS.find(s => s.id === sortBy)?.label || 'Sort'}
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="glass-context-menu"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          background: 'var(--bg-glass-heavy)',

                          border: '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: 4,
                          minWidth: 140,
                          zIndex: 200,
                          boxShadow: 'var(--shadow-elevated)',
                        }}
                      >
                        {SORT_OPTIONS.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setSortBy(opt.id); setShowSortMenu(false); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              borderRadius: 0,
                              fontSize: 12,
                              color: sortBy === opt.id ? 'var(--accent)' : 'var(--text-primary)',
                              background: sortBy === opt.id ? 'var(--accent-dim)' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              width: '100%',
                              textAlign: 'left',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => {
                              if (sortBy !== opt.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            }}
                            onMouseLeave={e => {
                              if (sortBy !== opt.id) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center' }}>{SortIconMap[opt.icon]?.() || null}</span>
                            {opt.label}
                            {sortBy === opt.id && (
                              <span style={{ marginLeft: 'auto' }}>
                                <CheckIcon />
                              </span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Bulk toolbar */}
              <AnimatePresence>
                {renderBulkToolbar()}
              </AnimatePresence>

              {/* Conversation list */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '6px 6px',
              }}>
                {loading ? renderSkeletons() : (
                  <AnimatePresence mode="popLayout">
                    {processedConversations.length === 0 ? renderEmptyState() : (
                      <>
                        {/* Pinned section */}
                        {pinned.length > 0 && (
                          <>
                            <div style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: 'var(--text-tertiary)',
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              padding: '8px 8px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                              <PinIcon filled />
                              Pinned
                              <span style={{
                                fontSize: 9,
                                opacity: 0.5,
                                fontWeight: 400,
                              }}>
                                {pinned.length}
                              </span>
                            </div>
                            {pinned.map(renderConversationItem)}
                            <div style={{ height: 8 }} />
                          </>
                        )}

                        {/* Date-grouped sections */}
                        {GROUP_ORDER.map(group => {
                          const items = dateGroups[group];
                          if (!items || items.length === 0) return null;
                          return (
                            <React.Fragment key={group}>
                              <div style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                padding: '8px 8px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}>
                                {group}
                                <span style={{
                                  fontSize: 9,
                                  opacity: 0.5,
                                  fontWeight: 400,
                                }}>
                                  {items.length}
                                </span>
                              </div>
                              {items.map(renderConversationItem)}
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer with keyboard hints */}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}>
                <span style={{
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <kbd style={{
                    background: '#0a0a0a',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 0,
                    padding: '1px 4px',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    Ctrl+K
                  </kbd>
                  Search
                </span>
                <span style={{
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <kbd style={{
                    background: '#0a0a0a',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 0,
                    padding: '1px 4px',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    Ctrl+N
                  </kbd>
                  New
                </span>
                <span style={{
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  Right-click
                  Menu
                </span>
              </div>

              {/* Context menu portal */}
              <AnimatePresence>
                {renderContextMenu()}
              </AnimatePresence>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              zIndex: 300,
              maxWidth: 300,

              boxShadow: 'var(--shadow-elevated)',
              background: toast.type === 'error'
                ? 'rgba(248, 113, 113, 0.15)'
                : 'rgba(52, 211, 153, 0.15)',
              border: '1px solid',
              borderColor: toast.type === 'error'
                ? 'rgba(248, 113, 113, 0.3)'
                : 'rgba(52, 211, 153, 0.3)',
              color: toast.type === 'error'
                ? 'var(--color-error)'
                : 'var(--color-success)',
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}

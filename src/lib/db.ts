/**
 * Database layer for Nero AI
 * STATELESS — no server-side data persistence.
 * All user data lives in the browser (localStorage).
 * This prevents any cross-user data leakage on Vercel.
 */

import { v4 as uuid } from 'uuid'

export function getUserId(_request?: Request): string {
  return 'anonymous'
}

/* ------------------------------------------------------------------ */
/*  Types (kept for compilation)                                       */
/* ------------------------------------------------------------------ */

export interface Memory {
  id: string; category: string; key: string; value: string; confidence: number;
  source: string | null; tags: string; created_at: string; updated_at: string;
}

export interface Conversation {
  id: string; title: string; brain_type: string; is_pinned: number; folder: string;
  summary: string | null; message_count: number; created_at: string; updated_at: string;
}

export interface Message {
  id: string; conversation_id: string; role: string; content: string;
  brain_used: string | null; tokens_used: number; metadata: string; created_at: string;
}

export interface Project {
  id: string; name: string; description: string | null; status: string; color: string;
  icon: string; tags: string; created_at: string; updated_at: string;
}

export interface ActivityEntry {
  id: string; type: string; title: string; description: string; entity_type: string | null;
  entity_id: string | null; metadata: string; created_at: string;
}

export interface KnowledgeNode {
  id: string; label: string; type: string; description: string; metadata: string; created_at: string;
}

export interface KnowledgeEdge {
  id: string; source_id: string; target_id: string; label: string; weight: number; created_at: string;
}

export interface Feedback {
  id: string; message_id: string; type: string; content: string; created_at: string;
}

export interface EmotionalState {
  id: string; conversation_id: string | null; message_id: string | null; mood: string;
  sentiment: number; valence: number; arousal: number; dominant_emotion: string;
  emoji: string; context: string; created_at: string;
}

export interface UserPreference {
  key: string; value: string; confidence: number; source: string;
  created_at: string; updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  All functions return empty/default — nothing stored server-side     */
/* ------------------------------------------------------------------ */

export function getDb() { return null as any }

export function createMemory(..._args: any[]): Memory {
  return { id: uuid(), category: '', key: '', value: '', confidence: 0, source: null, tags: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
}
export function getMemory(..._args: any[]): Memory | undefined { return undefined }
export function getMemoriesByCategory(..._args: any[]): Memory[] { return [] }
export function getAllMemories(..._args: any[]): Memory[] { return [] }
export function updateMemory(..._args: any[]): Memory | undefined { return undefined }
export function deleteMemory(..._args: any[]): boolean { return false }
export function searchMemories(..._args: any[]): Memory[] { return [] }
export function getMemoryStats(..._args: any[]) { return { total: 0, byCategory: {} as Record<string, number> } }
export function getMemoryCount(..._args: any[]): number { return 0 }
export function deleteMemories(..._args: any[]) {}
export function deleteMemoriesByIds(..._args: any[]) {}

export function createConversation(..._args: any[]): Conversation {
  return { id: uuid(), title: 'New Chat', brain_type: 'reasoning', is_pinned: 0, folder: 'default', summary: null, message_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
}
export function getConversation(..._args: any[]): Conversation | undefined { return undefined }
export function getConversations(..._args: any[]): Conversation[] { return [] }
export function getConversationFolders(..._args: any[]) { return [] }
export function updateConversation(..._args: any[]): Conversation | undefined { return undefined }
export function deleteConversation(..._args: any[]): boolean { return false }
export function touchConversation(..._args: any[]) {}
export function clearConversations(..._args: any[]) {}

export function createMessage(..._args: any[]): Message {
  return { id: uuid(), conversation_id: '', role: '', content: '', brain_used: null, tokens_used: 0, metadata: '{}', created_at: new Date().toISOString() }
}
export function getMessages(..._args: any[]): Message[] { return [] }
export function getMessage(..._args: any[]): Message | undefined { return undefined }
export function deleteMessage(..._args: any[]): boolean { return false }
export function searchMessages(..._args: any[]) { return [] }
export function getMessageCount(..._args: any[]): number { return 0 }

export function createProject(..._args: any[]): Project {
  return { id: uuid(), name: '', description: null, status: 'active', color: '#c0c0c0', icon: 'folder', tags: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
}
export function getProject(..._args: any[]): Project | undefined { return undefined }
export function getProjects(..._args: any[]): Project[] { return [] }
export function updateProject(..._args: any[]): Project | undefined { return undefined }
export function deleteProject(..._args: any[]): boolean { return false }

// Project files/notes/tasks stubs
export interface ProjectFile { id: string; project_id: string; name: string; path: string; content: string; language: string; size: number; created_at: string; updated_at: string }
export interface ProjectNote { id: string; project_id: string; title: string; content: string; is_pinned: number; tags: string; created_at: string; updated_at: string }
export interface ProjectTask { id: string; project_id: string; title: string; description: string; status: string; priority: string; due_date: string | null; created_at: string; updated_at: string }

export function createProjectFile(..._args: any[]): ProjectFile { return { id: uuid(), project_id: '', name: '', path: '', content: '', language: 'text', size: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }
export function getProjectFiles(..._args: any[]): ProjectFile[] { return [] }
export function getProjectFile(..._args: any[]): ProjectFile | undefined { return undefined }
export function updateProjectFile(..._args: any[]): ProjectFile | undefined { return undefined }
export function deleteProjectFile(..._args: any[]) { return false }

export function createProjectNote(..._args: any[]): ProjectNote { return { id: uuid(), project_id: '', title: 'Untitled', content: '', is_pinned: 0, tags: '[]', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }
export function getProjectNotes(..._args: any[]): ProjectNote[] { return [] }
export function updateProjectNote(..._args: any[]): ProjectNote | undefined { return undefined }
export function deleteProjectNote(..._args: any[]) { return false }

export function createProjectTask(..._args: any[]): ProjectTask { return { id: uuid(), project_id: '', title: '', description: '', status: 'todo', priority: 'medium', due_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }
export function getProjectTasks(..._args: any[]): ProjectTask[] { return [] }
export function updateProjectTask(..._args: any[]): ProjectTask | undefined { return undefined }
export function deleteProjectTask(..._args: any[]) { return false }

export function logActivity(..._args: any[]): ActivityEntry {
  return { id: uuid(), type: '', title: '', description: '', entity_type: null, entity_id: null, metadata: '{}', created_at: new Date().toISOString() }
}
export function getActivity(..._args: any[]): ActivityEntry[] { return [] }

export function createKnowledgeNode(..._args: any[]): KnowledgeNode {
  return { id: uuid(), label: '', type: 'concept', description: '', metadata: '{}', created_at: new Date().toISOString() }
}
export function getKnowledgeNodes(..._args: any[]): KnowledgeNode[] { return [] }
export function createKnowledgeEdge(..._args: any[]): KnowledgeEdge {
  return { id: uuid(), source_id: '', target_id: '', label: 'related_to', weight: 1, created_at: new Date().toISOString() }
}
export function getKnowledgeEdges(..._args: any[]): KnowledgeEdge[] { return [] }
export function deleteKnowledgeNode(..._args: any[]): boolean { return false }
export function deleteKnowledgeEdge(..._args: any[]): boolean { return false }
export function getKnowledgeGraph(..._args: any[]) { return { nodes: [], edges: [] } }

export function createFeedback(..._args: any[]): Feedback {
  return { id: uuid(), message_id: '', type: '', content: '', created_at: new Date().toISOString() }
}
export function getFeedbackForMessage(..._args: any[]): Feedback[] { return [] }
export function getRecentFeedback(..._args: any[]) { return [] }
export function getFeedbackStats(..._args: any[]) { return { total: 0, byType: {} as Record<string, number> } }

export function createEmotionalState(..._args: any[]): EmotionalState {
  return { id: uuid(), conversation_id: null, message_id: null, mood: 'neutral', sentiment: 0, valence: 0, arousal: 0, dominant_emotion: 'neutral', emoji: '😐', context: '', created_at: new Date().toISOString() }
}
export function getLatestEmotionalState(..._args: any[]): EmotionalState | undefined { return undefined }
export function getEmotionalHistory(..._args: any[]): EmotionalState[] { return [] }
export function getMoodStats(..._args: any[]) { return { dominant: 'neutral', avgSentiment: 0, avgValence: 0, avgArousal: 0, distribution: {} as Record<string, number> } }

export function logToolCall(..._args: any[]) { return { id: uuid(), tool_name: '', parameters: '{}', result: '', success: 1, conversation_id: null, created_at: new Date().toISOString() } }
export function getToolCalls(..._args: any[]) { return [] }

export function setPreference(..._args: any[]) { return { key: '', value: '', confidence: 0.5, source: 'learned', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }
export function getPreference(..._args: any[]): UserPreference | undefined { return undefined }
export function getAllPreferences(..._args: any[]): UserPreference[] { return [] }
export function deletePreference(..._args: any[]) { return false }

export function createMemorySummary(..._args: any[]) { return { id: uuid(), category: '', summary_text: '', memory_ids: '[]', created_at: new Date().toISOString(), created_from_count: 0 } }
export function getMemorySummaries(..._args: any[]): { id: string; category: string; summary_text: string; memory_ids: string; created_at: string; created_from_count: number }[] { return [] }
export function deleteMemorySummary(..._args: any[]) { return false }

export function logCodeExecution(..._args: any[]) { return { id: uuid(), conversation_id: null, language: '', code: '', output: '', error: null, exit_code: null, execution_time: null, status: 'pending', created_at: new Date().toISOString() } }
export function getCodeExecutions(..._args: any[]) { return [] }
export function logFileOperation(..._args: any[]) { return { id: uuid(), conversation_id: null, operation: '', file_path: '', success: 1, error: null, created_at: new Date().toISOString() } }

// Compatibility stubs for image gen
export function insertDailyNews(..._args: any[]) { return { id: uuid(), category: 'general', title: '', snippet: '', url: '', source: '', query: '', fetched_at: new Date().toISOString(), date: new Date().toISOString().split('T')[0] } }
export function getDailyNews(..._args: any[]): { id: string; category: string; title: string; snippet: string; url: string; source: string; query: string; fetched_at: string; date: string }[] { return [] }
export function getLatestNews(..._args: any[]): { id: string; category: string; title: string; snippet: string; url: string; source: string; query: string; fetched_at: string; date: string }[] { return [] }
export function getNewsDates(..._args: any[]): { date: string; count: number }[] { return [] }
export function clearOldNews(..._args: any[]) { return 0 }
export function getNewsCount(..._args: any[]) { return 0 }

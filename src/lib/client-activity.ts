/**
 * Client-side activity feed storage using localStorage.
 * All data stays in the browser — no server-side persistence.
 */

const ACTIVITY_KEY = 'nero-activity-feed'
const MAX_ACTIVITIES = 200

export type ActivityType = 'chat' | 'memory' | 'research' | 'project' | 'system'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown>
}

function readAll(): Activity[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(activities: Activity[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, MAX_ACTIVITIES)))
  } catch { /* quota exceeded */ }
}

export function getActivities(limit = 50): Activity[] {
  return readAll().slice(0, limit)
}

export function addActivity(
  type: ActivityType,
  title: string,
  description: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Activity {
  const activity: Activity = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  }
  const all = readAll()
  all.unshift(activity)
  writeAll(all)
  return activity
}

export function clearActivities(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACTIVITY_KEY)
}

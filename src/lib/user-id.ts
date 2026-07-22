/**
 * User ID management — generates and persists a unique ID per browser.
 * Used for per-user data isolation on Vercel.
 */

const USER_ID_KEY = 'nero-user-id'

export function getUserId(): string {
  if (typeof window === 'undefined') return 'default'
  
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function getAuthHeaders(): Record<string, string> {
  return { 'x-user-id': getUserId() }
}

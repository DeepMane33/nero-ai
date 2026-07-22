import useSWR from 'swr'
import { fetcher } from '@/lib/swr-config'

export function useConversations(folder?: string, search?: string) {
  const params = new URLSearchParams()
  if (folder) params.set('folder', folder)
  if (search) params.set('search', search)
  const key = `/api/conversations?${params.toString()}`
  return useSWR(key, fetcher, { refreshInterval: 30000 })
}

export function useMessages(conversationId: string | null) {
  return useSWR(
    conversationId ? `/api/messages?conversationId=${conversationId}` : null,
    fetcher
  )
}

export function useModels() {
  return useSWR('/api/models', fetcher, { revalidateOnFocus: false })
}

export function useMemoryStats() {
  return useSWR('/api/memory/stats', fetcher, { refreshInterval: 60000 })
}

export function useProjects() {
  return useSWR('/api/projects', fetcher, { refreshInterval: 30000 })
}

export function useActivity() {
  return useSWR('/api/activity', fetcher, { refreshInterval: 15000 })
}

export function useMood() {
  return useSWR('/api/mood', fetcher, { refreshInterval: 15000 })
}

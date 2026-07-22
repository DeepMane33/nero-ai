/**
 * Merge class names, filtering out falsy values.
 * Lightweight replacement for clsx — no external dependency.
 */
export function cn(
  ...inputs: (string | boolean | null | undefined | Record<string, boolean>)[]
): string {
  const classes: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === 'string') {
      classes.push(input)
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key)
      }
    }
  }
  return classes.join(' ')
}

/**
 * Format a timestamp into a human-friendly relative or absolute string.
 */
export function formatTime(
  date: Date | string | number,
  opts?: { relative?: boolean }
): string {
  const d = new Date(date)
  if (opts?.relative) {
    const diff = Date.now() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Strip markdown syntax from text — useful for TTS or plain-text previews.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links
    .replace(/#{1,6}\s+/g, '') // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/>\s+/g, '') // blockquotes
    .replace(/[-*+]\s+/g, '') // unordered lists
    .replace(/\d+\.\s+/g, '') // ordered lists
    .replace(/\n{2,}/g, '\n') // collapse blank lines
    .trim()
}

/**
 * Truncate text to a maximum length with an ellipsis.
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

/**
 * Get the stored Gemini API key from localStorage.
 * Used by client components to pass the key with API requests.
 */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('nero-gemini-key')
}

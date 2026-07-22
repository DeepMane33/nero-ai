import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Load the soul prompt from soul.md at startup.
 * Cached once — restart the dev server to pick up edits.
 */
let _soul: string | null = null

export function getSoul(): string {
  if (_soul !== null) return _soul
  try {
    const soulPath = resolve(process.cwd(), 'soul.md')
    const raw = readFileSync(soulPath, 'utf-8')
    // Strip markdown headings but keep the content
    _soul = raw
      .replace(/^#.*$/gm, '')          // remove heading lines
      .replace(/\|.*\|/g, '')          // remove table rows
      .replace(/-{3,}/g, '')           // remove table separators
      .replace(/\n{3,}/g, '\n\n')      // collapse blank lines
      .trim()
  } catch {
    console.warn('[soul] Could not load soul.md — running without base personality')
    _soul = ''
  }
  return _soul
}

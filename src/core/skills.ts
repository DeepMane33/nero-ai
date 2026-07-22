import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, basename } from 'path'

/**
 * Skill Loader — discovers and loads .md skill files from the skills/ directory.
 *
 * Each skill has YAML frontmatter (name, description) and markdown body.
 * Skills are categorized into directories that map to brain types.
 */

export interface Skill {
  name: string
  description: string
  category: string
  body: string
  filePath: string
}

export type SkillCategory =
  | 'engineering'
  | 'frontend-design'
  | 'content'
  | 'visual'
  | 'workflows'
  | 'agent-meta'

/** Map skill categories to the brain type they enhance */
const CATEGORY_TO_BRAIN: Record<SkillCategory, string> = {
  engineering: 'coding',
  'frontend-design': 'creative',
  content: 'creative',
  visual: 'creative',
  workflows: 'automation',
  'agent-meta': 'memory',
}

let _skills: Skill[] | null = null

/**
 * Parse YAML frontmatter from a markdown file.
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { meta: {}, body: raw }

  const meta: Record<string, string> = {}
  for (const line of fmMatch[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return { meta, body: fmMatch[2].trim() }
}

/**
 * Recursively find all .md files in a directory.
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      try {
        const st = statSync(full)
        if (st.isDirectory()) {
          files.push(...findMarkdownFiles(full))
        } else if (entry.endsWith('.md')) {
          files.push(full)
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // dir doesn't exist
  }
  return files
}

/**
 * Load all skills from the skills/ directory.
 * Cached after first load.
 */
export function loadSkills(): Skill[] {
  if (_skills) return _skills

  const skillsDir = resolve(process.cwd(), 'skills')
  const mdFiles = findMarkdownFiles(skillsDir)

  _skills = mdFiles.map((filePath) => {
    const raw = readFileSync(filePath, 'utf-8')
    const { meta, body } = parseFrontmatter(raw)

    // Determine category from directory path
    const relPath = filePath.replace(skillsDir, '').replace(/^[/\\]/, '')
    const category = (relPath.split(/[\\/]/)[0] || 'uncategorized') as SkillCategory

    return {
      name: meta.name || basename(filePath, '.md'),
      description: meta.description || '',
      category,
      body,
      filePath,
    }
  })

  console.log(`[skills] Loaded ${_skills.length} skills from ${skillsDir}`)
  return _skills
}

/**
 * Get skills filtered by category.
 */
export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return loadSkills().filter((s) => s.category === category)
}

/**
 * Get skills that enhance a specific brain type.
 */
export function getSkillsForBrain(brainType: string): Skill[] {
  return loadSkills().filter((s) => {
    const mappedBrain = CATEGORY_TO_BRAIN[s.category as SkillCategory]
    return mappedBrain === brainType || s.category === brainType
  })
}

/**
 * Get a summary of all loaded skills (for UI).
 */
export function getSkillsSummary(): { category: string; skills: { name: string; description: string }[] }[] {
  const skills = loadSkills()
  const grouped: Record<string, { name: string; description: string }[]> = {}

  for (const skill of skills) {
    if (!grouped[skill.category]) grouped[skill.category] = []
    grouped[skill.category].push({ name: skill.name, description: skill.description })
  }

  return Object.entries(grouped).map(([category, skills]) => ({ category, skills }))
}

/**
 * Get the total count of loaded skills.
 */
export function getSkillCount(): number {
  return loadSkills().length
}

/**
 * Generate a combined skill prompt for a brain type.
 * Injects ALL relevant skills with their actual content, not just summaries.
 */
export function buildSkillPrompt(brainType: string): string {
  const allSkills = loadSkills()
  if (allSkills.length === 0) return ''

  // Get skills specifically for this brain type
  const brainSkills = getSkillsForBrain(brainType)

  // Also include skills from ALL categories that might be relevant
  // (e.g., reasoning brain should still know about engineering patterns)
  const otherSkills = allSkills.filter(
    (s) => !brainSkills.some((bs) => bs.filePath === s.filePath)
  )

  // Priority: brain-specific skills first, then others
  const relevantSkills = [...brainSkills, ...otherSkills.slice(0, 6)]

  if (relevantSkills.length === 0) return ''

  const skillBlocks = relevantSkills.map((s) => {
    // Include a meaningful portion of the skill body, not just the description
    const bodyPreview = s.body.slice(0, 800)
    return `### ${s.name} (${s.category})\n${s.description}\n\n${bodyPreview}`
  })

  return `
## 🛠️ SKILLS — Apply these patterns when relevant

You have ${allSkills.length} specialized skills loaded. Use them when the user's request matches:

${skillBlocks.join('\n\n---\n\n')}

IMPORTANT: When a user request matches a skill above, actively apply its patterns, rules, and techniques in your response. Don't just acknowledge the skill exists — USE it.`.trim()
}

/**
 * Invalidate the cache (useful for hot-reload in dev).
 */
export function invalidateSkillsCache(): void {
  _skills = null
}

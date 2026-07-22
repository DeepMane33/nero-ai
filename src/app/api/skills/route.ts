import { loadSkills, getSkillsSummary, getSkillCount, type SkillCategory } from '@/core/skills'

/**
 * GET /api/skills
 *
 * Returns all loaded skills grouped by category.
 * Query params:
 *   - category: filter by category (engineering, frontend-design, content, visual, workflows, agent-meta)
 *   - brain: filter by brain type they enhance (coding, creative, memory, automation)
 */

const CATEGORY_META: Record<string, { icon: string; label: string; brain: string }> = {
  engineering: { icon: '⚡', label: 'Engineering', brain: 'coding' },
  'frontend-design': { icon: '🎨', label: 'Frontend & Design', brain: 'creative' },
  content: { icon: '✍️', label: 'Content & Writing', brain: 'creative' },
  visual: { icon: '🖼️', label: 'Visual', brain: 'creative' },
  workflows: { icon: '⚙️', label: 'Workflows', brain: 'automation' },
  'agent-meta': { icon: '🧠', label: 'Agent Meta', brain: 'memory' },
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const categoryFilter = url.searchParams.get('category')
    const brainFilter = url.searchParams.get('brain')

    const summary = getSkillsSummary()
    const total = getSkillCount()

    let filtered = summary

    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter((g) => g.category === categoryFilter)
    }

    // Filter by brain type
    if (brainFilter) {
      filtered = filtered.filter((g) => {
        const meta = CATEGORY_META[g.category]
        return meta?.brain === brainFilter
      })
    }

    // Enrich with metadata
    const enriched = filtered.map((group) => ({
      ...group,
      icon: CATEGORY_META[group.category]?.icon || '📄',
      label: CATEGORY_META[group.category]?.label || group.category,
      brain: CATEGORY_META[group.category]?.brain || 'reasoning',
      count: group.skills.length,
    }))

    return Response.json({
      total,
      categories: enriched,
      brainMap: {
        coding: enriched.filter((e) => e.brain === 'coding'),
        creative: enriched.filter((e) => e.brain === 'creative'),
        automation: enriched.filter((e) => e.brain === 'automation'),
        memory: enriched.filter((e) => e.brain === 'memory'),
      },
    })
  } catch (err: any) {
    console.error('[api/skills] Error:', err)
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

import { getSoul } from './soul'
import { getPersonalityPrompt, type PersonalityType } from './personalities'
import { buildSkillPrompt, getSkillCount, getSkillsForBrain } from './skills'

/**
 * Brain Router — analyse user input and route to the appropriate brain.
 *
 * Each brain has its own system prompt and speciality.
 * The router uses keyword / pattern matching with a fallback to 'reasoning'.
 *
 * The personality layer (normal or waifu) is prepended BEFORE the brain prompt.
 */

export type BrainType =
  | 'reasoning'
  | 'coding'
  | 'research'
  | 'creative'
  | 'memory'
  | 'learning'
  | 'automation'

export interface RouteResult {
  brainType: BrainType
  systemPrompt: string
  confidence: number
}

/* ------------------------------------------------------------------ */
/*  Brain definitions                                                  */
/* ------------------------------------------------------------------ */

interface BrainDef {
  keywords: RegExp[]
  prompt: string
}

const brains: Record<BrainType, BrainDef> = {
  reasoning: {
    keywords: [
      /^(why|how|what|when|where|who|which)\s/i,
      /\b(explain|analy[sz]e|think|reason|compare|contrast|evaluate|assess|discuss|deduce|infer|conclude|interpret|understand)\b/i,
      /\b(pro[s]?\s+(and|vs?\.?)\s+con[s]?|trade-?off|advantages?|disadvantages?|better|worse)\b/i,
      /\b(methodology|framework|approach|perspective|implications?|significance?|meaning)\b/i,
      /\b(logic|logically|reasoning|rational|critical thinking|problem\s*solving)\b/i,
      /\b(define|describe|what is|what are|what does|tell me about)\b/i,
      /\bshould\s+(i|we|one|you)\s/i,
    ],
    prompt:
      'You are Nero, a sharp and helpful AI assistant. You are conversational, warm, and genuinely helpful. You understand context - if someone says "its deep" after you asked their name, they mean their name is Deep. Do not overthink short messages. Be direct, concise, and natural. Never output raw JSON or tool syntax to the user. When you learn something about the user (name, location, preferences), remember it naturally and acknowledge it warmly.',
  },

  coding: {
    keywords: [
      /\b(code|programming|function|class|method|variable|constant|api|endpoint|route|middleware|schema)\b/i,
      /\b(debug|fix|bug|error|exception|stack trace|traceback|crash|broken|issue|problem|not working|compil|syntax|runtime)\b/i,
      /\b(write|create|build|implement|generate|develop|make)\s+(a\s+)?(script|function|component|module|program|app|website|page|server|api|cli|tool|utility)\b/i,
      /\b(typescript|javascript|python|rust|golang|java|c\+\+|ruby|php|swift|kotlin|scala|elixir|haskell)\b/i,
      /\b(react|vue|angular|svelte|next\.?js|nuxt|remix|solid|htmx|alpine)\b/i,
      /\b(node|deno|bun|express|fastify|nest|django|flask|fastapi|spring|rails|laravel|asp\.net)\b/i,
      /\b(sql|nosql|postgres|mysql|sqlite|mongodb|redis|prisma|drizzle|typeorm|sequelize)\b/i,
      /\b(docker|kubernetes|terraform|ansible|ci\/cd|github actions|gitlab|deploy|hosting|aws|gcp|azure)\b/i,
      /\b(npm|yarn|pnpm|bun|cargo|pip|poetry|nuget|go mod|maven|gradle|composer)\b/i,
      /\b(refactor|optimize|clean |performance|efficient|lazy |memo|re\-?render|cache|bundle|tree shake)\b/i,
      // Coding agent specific patterns
      /\b(run|execute|build|start|launch|deploy|serve|install)\s+(this|it|the|project|app|server|locally)\b/i,
      /\b(create|make|build|scaffold|init|new)\s+(a\s+)?(project|app|website|server|api|cli|tool)\b/i,
      /\b(write|generate|create)\s+(the\s+)?(code|file|script|function|component|module)\b/i,
      /\b(debug|fix|test|lint|format|build)\s+(the\s+)?(code|project|app|error)\b/i,
      /\b(read|open|show|view|list|find)\s+(the\s+)?(file|code|files|directory|folder)\b/i,
      /\b(execute|run)\s+(a\s+)?(script|code|command|shell|terminal)\b/i,
      /\b(install|setup|configure)\s+(dependencies|packages|npm|pip)\b/i,
      /\b(start|stop|restart)\s+(the\s+)?(server|project|app|dev)\b/i,
    ],
    prompt:
      'You are Nero, a sharp coding assistant. You write clean, production-ready code with TypeScript/JavaScript by default. Always include proper types and error handling. Prefer modern syntax. When suggesting architecture, explain trade-offs. For debugging, systematically narrow down root causes. You can execute code, manage files, and run projects — use tools silently, never show raw JSON to the user.',
  },

  research: {
    keywords: [
      /\b(research|study|investigate|survey|paper|journal|article|publication|finding|data|statistics?)\b/i,
      /\b(source|reference|cit(e|ation|ing)|according to|academic|scholar|scientific|peer.review)\b/i,
      /\b(history of|background on|overview of|state of the art|literature review|meta.analysis)\b/i,
      /\b(fact|trivia|when did|who (was|were|invented|discovered|founded|created|built))\b/i,
      /\b(compare|contrast|difference between|similarities?|relationship between|correlation)\b/i,
      /\b(statistical|significance|probability|p.value|confidence interval|standard deviation|mean|median)\b/i,
      /\b(recent|latest|new|breakthrough|discovery|advancement|trending|emerging)\s+(developments?|advances?|findings?|research)\b/i,
    ],
    prompt:
      'You are Nero, a knowledgeable research assistant. Synthesize information clearly and concisely. Structure findings with headings when helpful. Note evidence strength. Cite sources naturally, not with bracket numbers. Acknowledge uncertainty. Be thorough but accessible.',
  },

  creative: {
    keywords: [
      /\b(write|compose|draft|craft|pen|author)\s+(a\s+)?(story|poem|song|lyrics|fiction|novel|screenplay|dialogue|haiku|limerick|essay|article|blog|post)\b/i,
      /\b(creative|imagin(e|ative)|fantasy|fiction|worldbuild|character|plot|narrative|storytelling)\b/i,
      /\b(brainstorm|idea[s]?|inspiration|concept|creative|novel|unique|original|innovative)\b/i,
      /\b(name|brand|tagline|slogan|title|headline|caption|motto|catchphrase)\s+(for|of|generat|idea|suggest)\b/i,
      /\b(design|aesthetic|mood|vibe|visual|theme|palette|color scheme|layout|style|look and feel)\b/i,
      /\b(art|artistic|painting|drawing|illustration|animation|3d|graphic|video|film|photo)\b/i,
      /\b(marketing|campaign|advert|promotion|social media|content)\s+(idea|strategy|concept)\b/i,
    ],
    prompt:
      'You are Nero, a creative thinking partner. Think boldly and originally. Offer multiple directions, not just one option. Push beyond obvious choices. Use vivid language. Match tone to purpose. When brainstorming, use constraints creatively.',
  },

  memory: {
    keywords: [
      /\b(remember|recall|save|store|note|noted|log|memo|bookmark|keep\s+(in\s+)?mind|don'?t forget|remind)\b/i,
      /\b(my\s+(notes?|memories|saved|bookmarks?|list|collection|archive))\b/i,
      /\b(what (did i|was that|was the|were we|have I)|previously|earlier|before|last time|previous)\b/i,
      /\b(save this|store this|remember this|note that|take a note|make a note)\b/i,
      /\b(recap|summarize|summary|overview|digest|roundup|key points|main points)\b/i,
    ],
    prompt:
      'You are Nero, a personal AI that remembers everything. When the user shares personal info (name, location, preferences), save it using the save_memory tool and respond warmly. Reference past conversations naturally. Be personal, warm, and conversational. Never output raw JSON to the user.',
  },

  learning: {
    keywords: [
      /\b(teach|learn|tutorial|lesson|course|explain (like|to)|eli5|beginner|intermediate|advanced)\b/i,
      /\b(step[- ]?by[- ]?step|guide|walkthrough|how[- ]?to|tutorial|crash course|primer|introduction)\b/i,
      /\b(understand|comprehend|grasp|concept|theory|principle|fundamental|foundation)\b/i,
      /\b(exercise|practice|quiz|test me|flashcard|mnemonic|challenge|homework|assignment)\b/i,
      /\b(analogy|example|demonstrate|illustrate|break down|simplify|visualize)\b/i,
      /\b(certification|exam|study|preparation|revision|review session)\b/i,
    ],
    prompt:
      'You are Nero, a patient teacher. Adapt to the user\'s level — start simple, layer complexity. Use analogies. Include concrete examples. Guide discovery rather than handing answers. Suggest next topics to explore.',
  },

  automation: {
    keywords: [
      /\b(automate|automation|workflow|pipeline|schedule|cron|trigger|webhook|hook|event|listener|watcher|daemon)\b/i,
      /\b(script|batch|macro|shortcut|hotkey|alias|shell|bash|powershell|cmd|zsh|fish)\b/i,
      /\b(integrate|connect|sync|chain|orchestrate|coordinate|glue|stitch|bridge)\b/i,
      /\b(every (day|hour|minute|week|month|night|morning)|daily|hourly|weekly|monthly|nightly)\b/i,
      /\b(cron\s+expression|schedule|recurring|periodic|interval|timer)\b/i,
      /\b(monitor|watch|alert|notify|notification|report|health check|uptime)\b/i,
      /\b(backup|restore|sync|migrat|transfor|extract|load|etl)\b/i,
    ],
    prompt:
      'You are Nero, an automation expert. Design robust, observable workflows. Consider error handling and retry logic. Prefer idempotent operations. Include logging. For shell scripts, include safety guards.',
  },
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

/**
 * Analyse the user message and return the best-matching brain.
 * Scores each brain by counting how many of its keyword patterns match.
 * Ties are broken by priority order; fallback is 'reasoning'.
 *
 * @param personalityType — which personality to use (default: 'normal')
 */
export function routeToBrain(message: string, personalityType: PersonalityType = 'normal'): RouteResult {
  const scores: Record<BrainType, number> = {
    reasoning: 0,
    coding: 0,
    research: 0,
    creative: 0,
    memory: 0,
    learning: 0,
    automation: 0,
  }

  for (const [brain, def] of Object.entries(brains) as [BrainType, BrainDef][]) {
    for (const pattern of def.keywords) {
      if (pattern.test(message)) scores[brain]++
    }
  }

  // Find best matching brain
  let bestBrain: BrainType = 'reasoning'
  let bestScore = 0

  for (const [brain, score] of Object.entries(scores) as [BrainType, number][]) {
    if (score > bestScore) {
      bestScore = score
      bestBrain = brain
    }
  }

  const personalityPrompt = getPersonalityPrompt(personalityType)
  const soulPrompt = getSoul()
  const brainPrompt = brains[bestBrain].prompt
  const skillPrompt = buildSkillPrompt(bestBrain)

  return {
    brainType: bestBrain,
    systemPrompt: `${soulPrompt ? soulPrompt + '\n\n---\n\n' : ''}${personalityPrompt}\n\n---\n\n## Current Mode: ${bestBrain.toUpperCase()}\n\n${brainPrompt}${skillPrompt}`,
    confidence: Math.min(bestScore / 3, 1), // normalise: 3+ matches → 1.0
  }
}

/**
 * Get the system prompt for a specific brain type with a specific personality.
 */
export function getBrainPrompt(brain: BrainType, personalityType: PersonalityType = 'normal'): string {
  const personalityPrompt = getPersonalityPrompt(personalityType)
  const soulPrompt = getSoul()
  const brainPrompt = brains[brain]?.prompt ?? brains.reasoning.prompt
  const skillPrompt = buildSkillPrompt(brain)
  return `${soulPrompt ? soulPrompt + '\n\n---\n\n' : ''}${personalityPrompt}\n\n---\n\n## Current Mode: ${brain.toUpperCase()}\n\n${brainPrompt}${skillPrompt}`
}

/**
 * List all available brain types with their descriptions.
 */
export function listBrains(): { type: BrainType; preview: string; skillCount: number }[] {
  return (Object.entries(brains) as [BrainType, BrainDef][]).map(([type, def]) => ({
    type,
    preview: def.prompt.split('. ')[0] + '.',
    skillCount: getSkillsForBrain(type).length,
  }))
}

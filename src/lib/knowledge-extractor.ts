/**
 * Knowledge Extractor — automatically extracts entities and relationships
 * from conversations and stores them in the knowledge graph.
 * Uses lightweight NLP patterns (no external API calls).
 */

import { createKnowledgeNode, createKnowledgeEdge, getKnowledgeNodes, getKnowledgeEdges } from './db'

/* ------------------------------------------------------------------ */
/*  Entity extraction patterns                                         */
/* ------------------------------------------------------------------ */

interface ExtractedEntity {
  label: string
  type: string
  description: string
}

interface ExtractedRelation {
  source: string
  target: string
  label: string
}

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'dare',
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that',
  'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'about', 'up', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'any', 'also',
  'after', 'before', 'above', 'below', 'between', 'through', 'during',
  'into', 'with', 'from', 'for', 'on', 'at', 'by', 'to', 'of', 'in',
  'it', 'don', 'doesn', 'didn', 'won', 'wouldn', 'couldn', 'shouldn',
  'isn', 'aren', 'wasn', 'weren', 'hasn', 'haven', 'hadn', 'let', 'let\'s',
  'like', 'want', 'need', 'make', 'know', 'think', 'see', 'get', 'go',
  'come', 'take', 'give', 'say', 'tell', 'ask', 'use', 'find', 'work',
  'try', 'keep', 'help', 'show', 'still', 'much', 'many', 'well', 'back',
  'now', 'new', 'way', 'thing', 'things', 'something', 'anything', 'everything',
])

// Technology/tool name patterns (capitalized or known brands)
const TECH_PATTERNS = [
  /\b(Python|JavaScript|TypeScript|Rust|Go|Java|C\+\+|Ruby|PHP|Swift|Kotlin)\b/gi,
  /\b(React|Vue|Angular|Next\.js|Svelte|Node\.js|Django|Flask|FastAPI|Express)\b/gi,
  /\b(Docker|Kubernetes|AWS|Azure|GCP|Vercel|Netlify|Firebase|Supabase)\b/gi,
  /\b(PostgreSQL|MySQL|MongoDB|Redis|SQLite|Elasticsearch|DynamoDB)\b/gi,
  /\b(Git|GitHub|GitLab|VS Code|Vim|Neovim|IntelliJ|Cursor)\b/gi,
  /\b(OpenAI|Anthropic|Gemini|GPT|Claude|Llama|Mistral|Ollama)\b/gi,
  /\b(HTML|CSS|SASS|Tailwind|Bootstrap|GraphQL|REST|gRPC|WebSocket)\b/gi,
  /\b(Linux|Windows|macOS|Android|iOS|Arduino|Raspberry Pi)\b/gi,
]

// Concept/topic patterns
const CONCEPT_PATTERNS = [
  /\b(machine learning|deep learning|neural network|artificial intelligence|natural language processing)\b/gi,
  /\b(web development|frontend|backend|fullstack|full-stack|devops|cloud computing)\b/gi,
  /\b(api|database|server|client|microservice|monolith|serverless)\b/gi,
  /\b(testing|deployment|ci\/cd|automation|monitoring|logging)\b/gi,
  /\b(security|authentication|authorization|encryption|oauth|jwt)\b/gi,
  /\b(design pattern|architecture|algorithm|data structure|optimization)\b/gi,
]

/* ------------------------------------------------------------------ */
/*  Extraction logic                                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract entities from a message (user or assistant).
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  // Extract technology mentions
  for (const pattern of TECH_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const label = match[1].trim()
      const lower = label.toLowerCase()
      if (!seen.has(lower) && label.length > 1) {
        seen.add(lower)
        entities.push({
          label,
          type: 'technology',
          description: `Technology mentioned in conversation: ${label}`,
        })
      }
    }
  }

  // Extract concept mentions
  for (const pattern of CONCEPT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const label = match[1].trim()
      const lower = label.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        entities.push({
          label,
          type: 'concept',
          description: `Concept discussed: ${label}`,
        })
      }
    }
  }

  // Extract capitalized proper nouns (potential project/tool/person names)
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  for (const noun of properNouns) {
    const lower = noun.toLowerCase()
    if (!seen.has(lower) && !STOP_WORDS.has(lower) && noun.length > 2 && noun.length < 30) {
      // Filter out common sentence-starting words
      if (!/^(The|This|That|These|Those|What|When|Where|Which|Who|How|Why|But|And|Or|So|If|Then|Here|There|Now|Just|Also|Very|Some|Many|Much|Each|Every|Both|All|Most|Other|New|First|Last|Next|After|Before)$/.test(noun)) {
        seen.add(lower)
        entities.push({
          label: noun,
          type: 'entity',
          description: `Entity mentioned: ${noun}`,
        })
      }
    }
  }

  return entities.slice(0, 10) // limit to avoid noise
}

/**
 * Extract relationships between entities from text.
 * Looks for patterns like "X uses Y", "X is a Y", "X works with Y".
 */
export function extractRelations(text: string, entities: ExtractedEntity[]): ExtractedRelation[] {
  const relations: ExtractedRelation[] = []
  const entityLabels = entities.map(e => e.label.toLowerCase())

  // Pattern: "X uses/uses Y" or "X is built with Y"
  const usePatterns = [
    /(\b[\w.]+\b)\s+(?:uses?|using|built with|powered by|based on|runs on)\s+(\b[\w.]+\b)/gi,
    /(\b[\w.]+\b)\s+(?:is a|are a|is an|are an)\s+(\b[\w.]+\b)/gi,
    /(\b[\w.]+\b)\s+(?:works with|integrates with|connects to|talks to)\s+(\b[\w.]+\b)/gi,
    /(\b[\w.]+\b)\s+(?:depends on|requires|needs)\s+(\b[\w.]+\b)/gi,
  ]

  for (const pattern of usePatterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const source = match[1].trim()
      const target = match[2].trim()
      const sourceLower = source.toLowerCase()
      const targetLower = target.toLowerCase()

      // Only create relations between known entities
      if (entityLabels.includes(sourceLower) && entityLabels.includes(targetLower) && sourceLower !== targetLower) {
        const relationLabel = match[0].includes('uses') || match[0].includes('built') || match[0].includes('powered')
          ? 'uses'
          : match[0].includes('is a') || match[0].includes('are a')
          ? 'is_a'
          : match[0].includes('works') || match[0].includes('integrates')
          ? 'integrates_with'
          : 'depends_on'

        relations.push({ source, target, label: relationLabel })
      }
    }
  }

  return relations.slice(0, 5)
}

/* ------------------------------------------------------------------ */
/*  Storage logic                                                      */
/* ------------------------------------------------------------------ */

/**
 * Store extracted knowledge in the graph.
 * Deduplicates by checking existing nodes.
 * Returns { nodesAdded, edgesAdded }.
 */
export function storeKnowledge(
  entities: ExtractedEntity[],
  relations: ExtractedRelation[],
  userId?: string
): { nodesAdded: number; edgesAdded: number } {
  const existingNodes = getKnowledgeNodes(500, userId)
  const existingEdges = getKnowledgeEdges(1000, userId)
  const existingNodeMap = new Map(existingNodes.map(n => [n.label.toLowerCase(), n]))

  let nodesAdded = 0
  let edgesAdded = 0

  // Store entities as nodes
  const nodeIdMap = new Map<string, string>()
  for (const entity of entities) {
    const lower = entity.label.toLowerCase()
    const existing = existingNodeMap.get(lower)
    if (existing) {
      nodeIdMap.set(lower, existing.id)
    } else {
      const node = createKnowledgeNode(entity.label, entity.type, entity.description, userId)
      nodeIdMap.set(lower, node.id)
      nodesAdded++
    }
  }

  // Store relations as edges
  for (const rel of relations) {
    const sourceId = nodeIdMap.get(rel.source.toLowerCase())
    const targetId = nodeIdMap.get(rel.target.toLowerCase())
    if (sourceId && targetId) {
      // Check for duplicate edge
      const isDuplicate = existingEdges.some(
        e => e.source_id === sourceId && e.target_id === targetId && e.label === rel.label
      )
      if (!isDuplicate) {
        createKnowledgeEdge(sourceId, targetId, rel.label, userId)
        edgesAdded++
      }
    }
  }

  return { nodesAdded, edgesAdded }
}

/**
 * Full pipeline: extract and store knowledge from a conversation turn.
 */
export function extractAndStoreKnowledge(
  userMessage: string,
  assistantResponse: string,
  userId?: string
): { nodesAdded: number; edgesAdded: number } {
  // Extract from both messages
  const userEntities = extractEntities(userMessage)
  const assistantEntities = extractEntities(assistantResponse)
  const allEntities = [...userEntities, ...assistantEntities]

  // Deduplicate entities
  const seen = new Set<string>()
  const uniqueEntities = allEntities.filter(e => {
    const lower = e.label.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })

  // Extract relations from the assistant's response (usually more informative)
  const relations = extractRelations(assistantResponse, uniqueEntities)

  // Store in graph
  return storeKnowledge(uniqueEntities, relations, userId)
}

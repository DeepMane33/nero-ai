/**
 * Tool Registry — defines available tools that Nero can call.
 * Tools are described in JSON schema format and executed by tool-executor.
 */

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
}

/**
 * All available tools Nero can use.
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_web',
    description: 'Search the internet for current information. Use when the user asks about recent events, facts, or anything that needs up-to-date information.',
    parameters: {
      query: { type: 'string', description: 'The search query', required: true },
    },
  },
  {
    name: 'get_weather',
    description: 'Get current weather for a location. Use when the user asks about weather conditions.',
    parameters: {
      location: { type: 'string', description: 'City name or location', required: true },
    },
  },
  {
    name: 'manage_task',
    description: 'Create, update, or list project tasks. Use when the user wants to manage their to-do list or tasks.',
    parameters: {
      action: { type: 'string', description: 'Action to perform', required: true, enum: ['create', 'list', 'update'] },
      title: { type: 'string', description: 'Task title (for create/update)', required: false },
      description: { type: 'string', description: 'Task description', required: false },
      status: { type: 'string', description: 'Task status (for update)', required: false, enum: ['todo', 'in_progress', 'done'] },
      priority: { type: 'string', description: 'Task priority', required: false, enum: ['low', 'medium', 'high'] },
      project_id: { type: 'string', description: 'Project ID', required: false },
    },
  },
  {
    name: 'save_memory',
    description: 'Explicitly save an important fact or piece of information to memory. Use when the user asks to remember something specific.',
    parameters: {
      category: { type: 'string', description: 'Memory category', required: true, enum: ['identity', 'location', 'work', 'preferences', 'projects', 'notes', 'tools', 'general'] },
      key: { type: 'string', description: 'Short label for this memory', required: true },
      value: { type: 'string', description: 'The information to remember', required: true },
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve stored memories about the user or past conversations. Use when you need context about the user.',
    parameters: {
      query: { type: 'string', description: 'Search query for memories', required: true },
    },
  },
  {
    name: 'knowledge_search',
    description: 'Search the knowledge graph for related concepts and entities. Use when you need to find connections between topics.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
    },
  },
  {
    name: 'read_url',
    description: 'Fetch and read the content of a webpage. Use when you need to get detailed information from a specific URL.',
    parameters: {
      url: { type: 'string', description: 'The URL to read', required: true },
    },
  },
  // ──── Coding Agent Tools ────
  {
    name: 'execute_code',
    description: 'Execute code in a sandboxed environment. Supports JavaScript, TypeScript, Python, and Shell. Use when the user wants to run code, test a snippet, or execute a script.',
    parameters: {
      code: { type: 'string', description: 'The code to execute', required: true },
      language: { type: 'string', description: 'Programming language', required: true, enum: ['javascript', 'typescript', 'python', 'shell'] },
      timeout: { type: 'number', description: 'Execution timeout in seconds (default: 30)', required: false },
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file. Use when you need to see existing code, configuration, or any file content.',
    parameters: {
      path: { type: 'string', description: 'File path relative to project root', required: true },
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it doesn\'t exist. Use when the user wants to create or modify files.',
    parameters: {
      path: { type: 'string', description: 'File path relative to project root', required: true },
      content: { type: 'string', description: 'File content to write', required: true },
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path. Use when you need to see the project structure or find files.',
    parameters: {
      path: { type: 'string', description: 'Directory path (default: current directory)', required: false },
      recursive: { type: 'boolean', description: 'List recursively (default: false)', required: false },
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern. Use when looking for specific files in the project.',
    parameters: {
      path: { type: 'string', description: 'Directory to search in (default: current)', required: false },
      pattern: { type: 'string', description: 'Search pattern (regex supported)', required: true },
    },
  },
  {
    name: 'run_terminal',
    description: 'Execute a terminal/shell command. Use for npm install, git operations, or any system command.',
    parameters: {
      command: { type: 'string', description: 'The command to execute', required: true },
      working_dir: { type: 'string', description: 'Working directory (optional)', required: false },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 30)', required: false },
    },
  },
  {
    name: 'run_project',
    description: 'Start a local development server for a project. Detects project type and runs appropriate start command.',
    parameters: {
      path: { type: 'string', description: 'Path to the project directory', required: true },
      command: { type: 'string', description: 'Custom start command (optional)', required: false },
    },
  },
  {
    name: 'stop_project',
    description: 'Stop a running development server. Use when the user wants to stop a project.',
    parameters: {
      project_id: { type: 'string', description: 'Project ID to stop', required: true },
    },
  },
]

/**
 * Get tool definitions formatted for system prompt injection.
 */
export function getToolDefinitionsForPrompt(): string {
  const toolList = TOOLS.map(tool => {
    const params = Object.entries(tool.parameters)
      .map(([name, p]) => `    - ${name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`)
      .join('\n')

    return `  ${tool.name}: ${tool.description}\n${params}`
  }).join('\n\n')

  return `## Available Tools

You have access to tools for searching the web, getting weather, managing tasks, and saving memories. To use a tool, output a JSON code block:

\`\`\`json
{"tool": "tool_name", "params": {"param1": "value1"}}
\`\`\`

Available tools:
${toolList}

CRITICAL RULES:
- NEVER show tool call JSON to the user. The system handles tools automatically — you just respond normally.
- When you need to use a tool (like saving a memory), output the JSON block AND continue writing your natural response AFTER it.
- Your visible response to the user should ALWAYS be natural conversation — never raw JSON, never tool syntax.
- If the user tells you their name, location, preferences, or any personal fact, IMMEDIATELY save it using save_memory and respond naturally acknowledging it.
- Always interpret short messages in context. If the user says "its deep" after you asked their name, they mean their name is Deep — don't overthink it.`
}

/**
 * Parse tool calls from an LLM response.
 * Looks for JSON blocks with a "tool" field.
 */
export function parseToolCalls(response: string): Array<{ tool: string; params: Record<string, unknown> }> {
  const toolCalls: Array<{ tool: string; params: Record<string, unknown> }> = []

  // Match JSON code blocks
  const jsonBlockRegex = /```(?:json)?\s*\n?(\{[\s\S]*?\})\n?\s*```/g
  let match

  while ((match = jsonBlockRegex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({
          tool: parsed.tool,
          params: parsed.params || {},
        })
      }
    } catch {
      // Skip malformed JSON
    }
  }

  // Also try to find inline JSON tool calls (not in code blocks)
  const inlineRegex = /\{"tool"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*(\{[^}]*\})\s*\}/g
  while ((match = inlineRegex.exec(response)) !== null) {
    try {
      const toolName = match[1]
      const params = JSON.parse(match[2])
      // Avoid duplicates from code blocks
      if (!toolCalls.some(tc => tc.tool === toolName && JSON.stringify(tc.params) === JSON.stringify(params))) {
        toolCalls.push({ tool: toolName, params })
      }
    } catch {
      // Skip malformed
    }
  }

  return toolCalls
}

/**
 * Check if a tool name is valid.
 */
export function isValidTool(toolName: string): boolean {
  return TOOLS.some(t => t.name === toolName)
}

import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/** Safe math expression evaluator — no eval/new Function, just a recursive descent parser. */
function safeMathEval(expr: string): number {
  let pos = 0;
  const s = expr.replace(/\s/g, '');

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    // Unary minus
    if (pos < s.length && s[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    // Unary plus
    if (pos < s.length && s[pos] === '+') {
      pos++;
      return parseFactor();
    }
    // Parentheses
    if (pos < s.length && s[pos] === '(') {
      pos++; // skip '('
      const val = parseExpr();
      if (pos < s.length && s[pos] === ')') pos++; // skip ')'
      return val;
    }
    // Number (int or decimal)
    let numStr = '';
    while (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) {
      numStr += s[pos++];
    }
    if (numStr === '') throw new Error('Unexpected character');
    const val = parseFloat(numStr);
    if (isNaN(val)) throw new Error('Invalid number');
    // Handle ** exponentiation
    if (pos < s.length && s[pos] === '*' && pos + 1 < s.length && s[pos + 1] === '*') {
      pos += 2;
      const exp = parseFactor();
      return Math.pow(val, exp);
    }
    return val;
  }

  const result = parseExpr();
  if (pos !== s.length) throw new Error('Unexpected trailing characters');
  return result;
}

const ALLOWED_FILE_READ_PREFIXES = [
  resolve(process.cwd(), 'src'),
  resolve(process.cwd()),
];

export async function POST(request: NextRequest) {
  try {
    const { tool, params } = await request.json();

    if (!tool) {
      return Response.json({ error: 'tool name is required' }, { status: 400 });
    }

    switch (tool) {
      case 'calculator': {
        const expr = params?.expression;
        if (!expr || typeof expr !== 'string') {
          return Response.json({ tool, error: 'expression is required' }, { status: 400 });
        }
        // Only allow digits, operators, parentheses, dots, spaces, and ** for exponentiation
        const safeExpr = expr.replace(/\s/g, '');
        if (!/^[0-9+\-*/().]+$/.test(safeExpr) && !/^[0-9+\-*/().*]+$/.test(safeExpr)) {
          return Response.json({ tool, error: 'Invalid expression: only numbers and basic math operators (+,-,*,/,**) are allowed' }, { status: 400 });
        }
        try {
          const result = safeMathEval(safeExpr);
          return Response.json({ tool, result: String(result) });
        } catch {
          return Response.json({ tool, error: 'Invalid math expression' }, { status: 400 });
        }
      }

      case 'code_runner': {
        // code_runner is disabled for security — use execute_code (sandboxed) instead
        return Response.json({ tool, error: 'code_runner is disabled for security. Use execute_code instead, which runs in a sandboxed child process.' }, { status: 403 });
      }

      case 'web_search': {
        const query = params?.query;
        if (!query || typeof query !== 'string') {
          return Response.json({ tool, error: 'query is required' }, { status: 400 });
        }
        try {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const response = await fetch(ddgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const html = await response.text();
          // Extract results from DuckDuckGo HTML
          const results: Array<{ title: string; url: string; snippet: string }> = [];
          const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;
          let match;
          while ((match = resultPattern.exec(html)) !== null && results.length < 10) {
            results.push({
              title: match[2].replace(/<[^>]*>/g, '').trim(),
              url: match[1],
              snippet: match[3].replace(/<[^>]*>/g, '').trim(),
            });
          }
          return Response.json({ tool, result: results });
        } catch (e: unknown) {
          return Response.json({ tool, error: e instanceof Error ? e.message : 'Search failed' });
        }
      }

      case 'file_read': {
        const filePath = params?.path;
        if (!filePath || typeof filePath !== 'string') {
          return Response.json({ tool, error: 'path is required' }, { status: 400 });
        }
        // Allowlist approach: only permit reading files within project directories
        const resolved = resolve(filePath);
        const isAllowed = ALLOWED_FILE_READ_PREFIXES.some(prefix => resolved.startsWith(prefix));
        const isBlocked = ['node_modules', '.env', '.git', 'package-lock', 'credentials', 'secrets', 'private_key'].some(
          b => resolved.toLowerCase().includes(b)
        );
        if (!isAllowed || isBlocked) {
          return Response.json({ tool, error: 'Access to this path is not allowed' }, { status: 403 });
        }
        try {
          const content = await readFile(resolved, 'utf-8');
          return Response.json({ tool, result: content });
        } catch (e: unknown) {
          return Response.json({ tool, error: e instanceof Error ? e.message : 'File read failed' });
        }
      }

      default:
        return Response.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Error executing tool:', error);
    return Response.json({ error: 'Failed to execute tool' }, { status: 500 });
  }
}

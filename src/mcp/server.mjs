// Read-only MCP server (stdio) exposing the Json backend data to Claude Code.
import { readFile } from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE = process.env.JSON_BACKEND_URL || 'http://localhost:8000'
const SUMMARY_PATH = new URL('../../data/summary.json', import.meta.url)

const text = (value, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  ...(isError && { isError: true }),
})

async function backend(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return text(`Backend gaf status ${res.status}: ${JSON.stringify(data)}`, true)
    return text(data)
  } catch {
    return text(`Backend niet bereikbaar op ${BASE} (timeout 10s). Start de backend en probeer opnieuw.`, true)
  }
}

const server = new McpServer({ name: 'json-backend', version: '0.1.0' })

server.registerTool(
  'list_companies',
  { description: 'Lijst van bedrijven uit de Json backend.' },
  () => backend('GET', '/api/companies'),
)

server.registerTool(
  'get_readiness',
  {
    description: 'AI-readinessscore en uitleg voor één bedrijf.',
    inputSchema: { companyId: z.string() },
  },
  ({ companyId }) => backend('GET', `/api/companies/${encodeURIComponent(companyId)}/readiness`),
)

server.registerTool(
  'analyze',
  {
    description: 'Analyse (gerangschikte acties) berekend uit de readinessdata van één bedrijf.',
    inputSchema: { companyId: z.string() },
  },
  ({ companyId }) => backend('POST', '/api/analyze', { companyId }),
)

server.registerTool(
  'summary_lookup',
  {
    description: 'Zoekt een waarde in data/summary.json op een gepuntvormd pad, bv. "per_year.2025". Alleen samenvattingen, geen ruwe vacatureteksten.',
    inputSchema: { key: z.string() },
  },
  async ({ key }) => {
    let summary
    try {
      summary = JSON.parse(await readFile(SUMMARY_PATH, 'utf8'))
    } catch {
      return text('data/summary.json is niet leesbaar.', true)
    }
    let value = summary
    for (const part of key.split('.')) {
      if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) {
        return text(`Sleutel "${key}" niet gevonden in data/summary.json.`, true)
      }
      value = value[part]
    }
    return text({ key, value })
  },
)

await server.connect(new StdioServerTransport())

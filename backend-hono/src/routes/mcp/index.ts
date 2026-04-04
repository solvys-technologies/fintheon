// [claude-code 2026-04-03] MCP registry routes — read/write ~/.claude/mcp.json, toggle servers
/**
 * MCP Routes
 * CRUD for MCP server configs backed by ~/.claude/mcp.json.
 * The popover reads live config; toggles write back to the file.
 * Harper can add new MCP servers discovered online.
 */

import { Hono } from 'hono'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('MCP')

const CLAUDE_MCP_PATH = resolve(homedir(), '.claude', 'mcp.json')
const PROJECT_MCP_PATH = resolve(process.cwd(), '.mcp.json')

// ── Types ─────────────────────────────────────────────────────────────────

interface ClaudeMcpConfig {
  mcpServers: Record<string, ClaudeMcpServer>
}

interface ClaudeMcpServer {
  type?: string           // 'sse' | 'url' | undefined (stdio)
  url?: string            // for SSE/URL transport
  command?: string        // for stdio transport
  args?: string[]
  env?: Record<string, string>
}

/** Frontend-facing server representation */
interface McpServerEntry {
  id: string
  name: string
  description: string
  transport: 'stdio' | 'sse' | 'http' | 'url'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
  installed: boolean
  requiresApiKey: boolean
  apiKeyEnvVar?: string
  hasApiKey: boolean
  toolCount?: number
  category: 'data' | 'search' | 'browser' | 'productivity' | 'social' | 'trading' | 'internal'
  locked?: boolean
  source: 'claude' | 'project' | 'internal'  // which config file it came from
}

// ── Disabled list (persisted alongside the config) ────────────────────────

const DISABLED_STORAGE_KEY = 'fintheon:mcp-disabled-servers'
let disabledServers: Set<string> = new Set()

async function loadDisabledList(): Promise<void> {
  try {
    const dataDir = resolve(homedir(), '.fintheon')
    await mkdir(dataDir, { recursive: true })
    const raw = await readFile(resolve(dataDir, 'mcp-disabled.json'), 'utf8')
    disabledServers = new Set(JSON.parse(raw))
  } catch {
    disabledServers = new Set()
  }
}

async function saveDisabledList(): Promise<void> {
  const dataDir = resolve(homedir(), '.fintheon')
  await mkdir(dataDir, { recursive: true })
  await writeFile(
    resolve(dataDir, 'mcp-disabled.json'),
    JSON.stringify(Array.from(disabledServers)),
    'utf8',
  )
}

// Load on module init
loadDisabledList().catch(() => {})

// ── Known server metadata ─────────────────────────────────────────────────

const KNOWN_SERVERS: Record<string, Partial<McpServerEntry>> = {
  'exa':              { name: 'Exa Search', description: 'Neural web search for financial research', category: 'search', toolCount: 3, requiresApiKey: true, apiKeyEnvVar: 'EXA_API_KEY' },
  'notion':           { name: 'Notion', description: 'Trade ideas, daily P&L, and meeting notes', category: 'productivity', toolCount: 8, requiresApiKey: true, apiKeyEnvVar: 'NOTION_API_KEY' },
  'framer':           { name: 'Framer', description: 'Framer website builder and CMS', category: 'productivity', toolCount: 15 },
  'close-crm':        { name: 'Close CRM', description: 'CRM contacts, leads, and pipeline', category: 'productivity', toolCount: 10, requiresApiKey: true, apiKeyEnvVar: 'CLOSE_API_KEY' },
  'qc-mcp':           { name: 'QuantConnect', description: 'Algorithmic trading backtests and live deployment', category: 'trading', toolCount: 12, requiresApiKey: true, apiKeyEnvVar: 'QUANTCONNECT_API_TOKEN' },
  'tradingview':      { name: 'TradingView', description: 'Stock screener, technical analysis, chart data', category: 'trading', toolCount: 6, requiresApiKey: false },
  'yahoo-finance':    { name: 'Yahoo Finance', description: 'Real-time quotes, options chain, fundamentals', category: 'data', toolCount: 12 },
  'unusual-whales':   { name: 'Unusual Whales', description: 'Dark pool flow, congressional trades, options sweeps', category: 'data', toolCount: 15, requiresApiKey: true, apiKeyEnvVar: 'UNUSUAL_WHALES_API_KEY' },
  'playwright':       { name: 'Playwright Browser', description: 'Headless browser for scraping and screenshots', category: 'browser', toolCount: 20, locked: true },
  'figma':            { name: 'Figma', description: 'Design system, components, and mockups', category: 'productivity', toolCount: 18 },
}

// ── Internal Connectors (not MCP — in-app features) ──────────────────────

const INTERNAL_CONNECTORS: McpServerEntry[] = [
  {
    id: 'riskflow',
    name: 'RiskFlow',
    description: 'Cite a catalyst by searching the RiskFlow DB',
    transport: 'stdio',
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    category: 'internal',
    locked: true,
    source: 'internal',
  },
  {
    id: 'aquarium',
    name: 'Aquarium',
    description: 'Discuss the most recent MiroShark simulation run',
    transport: 'stdio',
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    category: 'internal',
    locked: false,
    source: 'internal',
  },
  {
    id: 'boardroom',
    name: 'Boardroom',
    description: 'Desk-wide narrative investigation across all agents',
    transport: 'stdio',
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    category: 'internal',
    locked: false,
    source: 'internal',
  },
]

// ── Config Parsing ────────────────────────────────────────────────────────

async function readClaudeMcpConfig(): Promise<ClaudeMcpConfig> {
  try {
    const raw = await readFile(CLAUDE_MCP_PATH, 'utf8')
    return JSON.parse(raw) as ClaudeMcpConfig
  } catch {
    return { mcpServers: {} }
  }
}

async function writeClaudeMcpConfig(config: ClaudeMcpConfig): Promise<void> {
  await writeFile(CLAUDE_MCP_PATH, JSON.stringify(config, null, 2), 'utf8')
}

async function readProjectMcpConfig(): Promise<ClaudeMcpConfig> {
  try {
    const raw = await readFile(PROJECT_MCP_PATH, 'utf8')
    return JSON.parse(raw) as ClaudeMcpConfig
  } catch {
    return { mcpServers: {} }
  }
}

function claudeServerToEntry(id: string, server: ClaudeMcpServer, source: 'claude' | 'project'): McpServerEntry {
  const known = KNOWN_SERVERS[id] ?? {}
  const transport: McpServerEntry['transport'] =
    server.type === 'sse' ? 'sse' :
    server.type === 'url' ? 'url' :
    server.type === 'http' ? 'http' :
    server.url ? 'sse' :
    'stdio'

  const hasEnvKeys = server.env ? Object.keys(server.env).length > 0 : false
  const envApiKey = known.apiKeyEnvVar ? server.env?.[known.apiKeyEnvVar] : undefined

  return {
    id,
    name: known.name ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: known.description ?? `MCP server: ${id}`,
    transport,
    command: server.command,
    args: server.args,
    url: server.url,
    enabled: !disabledServers.has(id),
    installed: true,
    requiresApiKey: known.requiresApiKey ?? hasEnvKeys,
    apiKeyEnvVar: known.apiKeyEnvVar,
    hasApiKey: known.requiresApiKey ? !!envApiKey : true,
    toolCount: known.toolCount,
    category: known.category ?? 'productivity',
    locked: known.locked,
    source,
  }
}

// ── Routes ────────────────────────────────────────────────────────────────

export function createMcpRoutes() {
  const app = new Hono()

  // List all MCP servers from Claude config + project config + internal connectors
  app.get('/', async (c) => {
    const [claudeConfig, projectConfig] = await Promise.all([
      readClaudeMcpConfig(),
      readProjectMcpConfig(),
    ])

    // Start with internal connectors (shown first)
    const servers: McpServerEntry[] = [...INTERNAL_CONNECTORS]

    for (const [id, server] of Object.entries(claudeConfig.mcpServers)) {
      servers.push(claudeServerToEntry(id, server, 'claude'))
    }
    for (const [id, server] of Object.entries(projectConfig.mcpServers)) {
      // Skip duplicates (claude config takes precedence)
      if (!servers.some(s => s.id === id)) {
        servers.push(claudeServerToEntry(id, server, 'project'))
      }
    }

    return c.json({ servers })
  })

  // Toggle a server on/off
  app.patch('/:id/toggle', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ enabled: boolean }>()

    // Internal connectors are toggled client-side only
    if (INTERNAL_CONNECTORS.some(ic => ic.id === id)) {
      return c.json({ ok: true, id, enabled: body.enabled })
    }

    // Check if server exists
    const [claudeConfig, projectConfig] = await Promise.all([
      readClaudeMcpConfig(),
      readProjectMcpConfig(),
    ])
    const exists = id in claudeConfig.mcpServers || id in projectConfig.mcpServers
    if (!exists) {
      return c.json({ error: `Server '${id}' not found` }, 404)
    }

    if (body.enabled) {
      disabledServers.delete(id)
    } else {
      disabledServers.add(id)
    }
    await saveDisabledList()

    log.info(`MCP server toggled: ${id} → ${body.enabled ? 'enabled' : 'disabled'}`)
    return c.json({ ok: true, id, enabled: body.enabled })
  })

  // Add a new MCP server to ~/.claude/mcp.json
  app.post('/', async (c) => {
    const body = await c.req.json<{
      id: string
      server: ClaudeMcpServer
    }>()

    if (!body.id || !body.server) {
      return c.json({ error: 'id and server config required' }, 400)
    }

    const config = await readClaudeMcpConfig()
    config.mcpServers[body.id] = body.server
    await writeClaudeMcpConfig(config)

    log.info(`MCP server added: ${body.id}`)
    return c.json({ ok: true, id: body.id })
  })

  // Update an existing MCP server
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ server: ClaudeMcpServer }>()

    const config = await readClaudeMcpConfig()
    if (!(id in config.mcpServers)) {
      return c.json({ error: `Server '${id}' not found in Claude config` }, 404)
    }

    config.mcpServers[id] = body.server
    await writeClaudeMcpConfig(config)

    log.info(`MCP server updated: ${id}`)
    return c.json({ ok: true, id })
  })

  // Delete a server from ~/.claude/mcp.json
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const config = await readClaudeMcpConfig()

    if (!(id in config.mcpServers)) {
      return c.json({ error: `Server '${id}' not found` }, 404)
    }

    delete config.mcpServers[id]
    await writeClaudeMcpConfig(config)
    disabledServers.delete(id)
    await saveDisabledList()

    log.info(`MCP server deleted: ${id}`)
    return c.json({ ok: true, id })
  })

  return app
}

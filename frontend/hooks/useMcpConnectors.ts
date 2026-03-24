// [claude-code 2026-03-23] T3: Hook for MCP connector state — removed alpha-vantage, twitter-cli→riskflow, playwright always-on
import { useState, useEffect, useCallback } from 'react';
import type { McpServerConfig, McpServerId, McpServerListResponse } from '../types/mcp';
import { API_BASE_URL } from '../components/chat/constants';

const STORAGE_KEY = 'fintheon:mcp-active-connectors';

/** Static fallback when T1 backend routes are not yet available */
const DEFAULT_SERVERS: McpServerConfig[] = [
  {
    id: 'exa',
    name: 'Exa Search',
    description: 'Neural web search for financial research',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-exa'],
    enabled: true,
    installed: true,
    requiresApiKey: true,
    apiKeyEnvVar: 'EXA_API_KEY',
    hasApiKey: true,
    toolCount: 3,
    category: 'search',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Trade ideas, daily P&L, and meeting notes',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-notion'],
    enabled: true,
    installed: true,
    requiresApiKey: true,
    apiKeyEnvVar: 'NOTION_API_KEY',
    hasApiKey: true,
    toolCount: 8,
    category: 'productivity',
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    description: 'Real-time quotes, options chain, fundamentals',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-yahoo-finance'],
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    toolCount: 12,
    category: 'data',
  },
  {
    id: 'unusual-whales',
    name: 'Unusual Whales',
    description: 'Dark pool flow, congressional trades, options sweeps',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-unusual-whales'],
    enabled: true,
    installed: true,
    requiresApiKey: true,
    apiKeyEnvVar: 'UNUSUAL_WHALES_API_KEY',
    hasApiKey: false,
    toolCount: 15,
    category: 'data',
  },
  {
    id: 'riskflow',
    name: 'RiskFlow',
    description: 'Live news headlines, macro events, and sentiment from the RiskFlow feed',
    transport: 'stdio',
    command: 'internal',
    args: [],
    enabled: false,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    toolCount: 4,
    category: 'data',
  },
  {
    id: 'playwright',
    name: 'Playwright Browser',
    description: 'Headless browser for scraping and screenshots',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    toolCount: 20,
    category: 'browser',
    locked: true,
  },
];

export function useMcpConnectors() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [activeIds, setActiveIds] = useState<McpServerId[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as McpServerId[]) : [];
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    /** Ensure locked connectors are always in the active set */
    const ensureLocked = (list: McpServerConfig[], ids: McpServerId[]): McpServerId[] => {
      const lockedIds = list.filter((s) => s.locked && s.enabled).map((s) => s.id);
      const merged = new Set(ids);
      for (const id of lockedIds) merged.add(id);
      return Array.from(merged);
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/mcp`);
        if (!res.ok) throw new Error('mcp endpoint unavailable');
        const data: McpServerListResponse = await res.json();
        const list = data.servers ?? (data as unknown as McpServerConfig[]);
        if (cancelled) return;
        setServers(list);
        if (!localStorage.getItem(STORAGE_KEY)) {
          setActiveIds(ensureLocked(list, list.filter((s) => s.enabled).map((s) => s.id)));
        } else {
          setActiveIds((prev) => ensureLocked(list, prev));
        }
      } catch {
        // T1 backend not yet deployed — use static defaults
        if (cancelled) return;
        setServers(DEFAULT_SERVERS);
        if (!localStorage.getItem(STORAGE_KEY)) {
          setActiveIds(ensureLocked(DEFAULT_SERVERS, DEFAULT_SERVERS.filter((s) => s.enabled).map((s) => s.id)));
        } else {
          setActiveIds((prev) => ensureLocked(DEFAULT_SERVERS, prev));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((id: McpServerId, enabled: boolean) => {
    // Locked connectors can't be toggled
    const server = servers.find((s) => s.id === id);
    if (server?.locked) return;

    setActiveIds((prev) => {
      const next = enabled ? [...prev, id] : prev.filter((x) => x !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    // Best-effort backend sync — no-op if T1 routes not available
    fetch(`${API_BASE_URL}/api/mcp/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).catch(() => {/* T1 not deployed yet */});
  }, []);

  return { servers, activeIds, toggle, loading };
}

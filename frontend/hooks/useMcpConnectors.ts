// [claude-code 2026-03-10] T3: Hook for MCP connector state — localStorage-persisted, backend-synced
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
    id: 'alpha-vantage',
    name: 'Alpha Vantage',
    description: 'Technical indicators, forex, crypto',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-alpha-vantage'],
    enabled: false,
    installed: false,
    requiresApiKey: true,
    apiKeyEnvVar: 'ALPHA_VANTAGE_API_KEY',
    hasApiKey: false,
    toolCount: 50,
    category: 'data',
  },
  {
    id: 'twitter-cli',
    name: 'Twitter / X',
    description: 'Trending tickers, analyst tweets, sentiment',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-twitter-cli'],
    enabled: false,
    installed: false,
    requiresApiKey: true,
    apiKeyEnvVar: 'TWITTER_BEARER_TOKEN',
    hasApiKey: false,
    toolCount: 6,
    category: 'social',
  },
  {
    id: 'playwright',
    name: 'Playwright Browser',
    description: 'Headless browser for scraping and screenshots',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    enabled: false,
    installed: false,
    requiresApiKey: false,
    hasApiKey: true,
    toolCount: 20,
    category: 'browser',
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

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/mcp`);
        if (!res.ok) throw new Error('mcp endpoint unavailable');
        const data: McpServerListResponse = await res.json();
        const list = data.servers ?? (data as unknown as McpServerConfig[]);
        if (cancelled) return;
        setServers(list);
        if (!localStorage.getItem(STORAGE_KEY)) {
          setActiveIds(list.filter((s) => s.enabled).map((s) => s.id));
        }
      } catch {
        // T1 backend not yet deployed — use static defaults
        if (cancelled) return;
        setServers(DEFAULT_SERVERS);
        if (!localStorage.getItem(STORAGE_KEY)) {
          setActiveIds(DEFAULT_SERVERS.filter((s) => s.enabled).map((s) => s.id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((id: McpServerId, enabled: boolean) => {
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

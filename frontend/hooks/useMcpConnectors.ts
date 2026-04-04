// [claude-code 2026-04-03] Rewritten: fetch live MCP config from backend (reads ~/.claude/mcp.json)
import { useState, useEffect, useCallback } from 'react';
import type { McpServerConfig, McpServerId } from '../types/mcp';
import { API_BASE_URL } from '../components/chat/constants';

const STORAGE_KEY = 'fintheon:mcp-active-connectors';

export function useMcpConnectors() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [activeIds, setActiveIds] = useState<McpServerId[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as McpServerId[]) : [];
  });
  const [loading, setLoading] = useState(true);

  // Fetch live config from backend
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mcp`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { servers: McpServerConfig[] };
      const fetched = data.servers ?? [];
      setServers(fetched);

      // Sync activeIds with server enabled state (backend is source of truth)
      const enabledIds = fetched.filter(s => s.enabled).map(s => s.id);
      // Ensure locked servers are always active
      const lockedIds = fetched.filter(s => s.locked && s.enabled).map(s => s.id);
      const merged = new Set([...enabledIds, ...lockedIds]);
      const next = Array.from(merged) as McpServerId[];
      setActiveIds(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Backend unavailable — keep whatever we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const toggle = useCallback(async (id: McpServerId, enabled: boolean) => {
    // Locked connectors can't be toggled
    const server = servers.find((s) => s.id === id);
    if (server?.locked) return;

    // Optimistic UI update
    setActiveIds((prev) => {
      const next = enabled ? [...new Set([...prev, id])] : prev.filter((x) => x !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    );

    // Persist to backend
    try {
      await fetch(`${API_BASE_URL}/api/mcp/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      // Revert on failure
      setActiveIds((prev) => {
        const reverted = enabled ? prev.filter((x) => x !== id) : [...prev, id];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reverted));
        return reverted;
      });
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
      );
    }
  }, [servers]);

  return { servers, activeIds, toggle, loading, refetch: fetchServers };
}

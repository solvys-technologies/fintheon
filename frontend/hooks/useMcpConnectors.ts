// [claude-code 2026-04-04] Rewritten: fetch live MCP config from backend + merge internal connectors
// [claude-code 2026-04-28] T4: filter dead connectors — Omi, env-gated, 404-prone
import { useState, useEffect, useCallback } from "react";
import type { McpServerConfig, McpServerId } from "../types/mcp";
import { API_BASE_URL } from "../components/chat/constants";
import { INTERNAL_CONNECTORS } from "../lib/internalConnectors";

const STORAGE_KEY = "fintheon:mcp-active-connectors";
const INTERNAL_DISABLED_KEY = "fintheon:internal-connectors-disabled";

/** Connectors known to be dead or gated by missing env vars — filtered from all lists. */
const DEAD_CONNECTOR_IDS = new Set<string>(["omi"]);

function getInternalDisabled(): Set<string> {
  try {
    const raw = localStorage.getItem(INTERNAL_DISABLED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function useMcpConnectors() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [activeIds, setActiveIds] = useState<McpServerId[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as McpServerId[]) : [];
  });
  const [loading, setLoading] = useState(true);

  // Fetch live config from backend + merge internal connectors
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mcp`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { servers: McpServerConfig[] };
      const mcpServers = data.servers ?? [];

      // Merge internal connectors (prepend so they appear first)
      const internalDisabled = getInternalDisabled();
      const internals = INTERNAL_CONNECTORS.map((c) => ({
        ...c,
        enabled: c.locked ? true : !internalDisabled.has(c.id),
      }));
      const allServers = [...internals, ...mcpServers].filter(
        (s) => !DEAD_CONNECTOR_IDS.has(s.id),
      );
      setServers(allServers);

      // Sync activeIds with server enabled state (backend is source of truth for MCP)
      const enabledIds = allServers.filter((s) => s.enabled).map((s) => s.id);
      const lockedIds = allServers
        .filter((s) => s.locked && s.enabled)
        .map((s) => s.id);
      const merged = new Set([...enabledIds, ...lockedIds]);
      const next = Array.from(merged) as McpServerId[];
      setActiveIds(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Backend unavailable — show internal connectors at minimum
      const internalDisabled = getInternalDisabled();
      const internals = INTERNAL_CONNECTORS.map((c) => ({
        ...c,
        enabled: c.locked ? true : !internalDisabled.has(c.id),
      }));
      setServers(internals);
      const enabledIds = internals.filter((s) => s.enabled).map((s) => s.id);
      setActiveIds(enabledIds as McpServerId[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const toggle = useCallback(
    async (id: McpServerId, enabled: boolean) => {
      // Locked connectors can't be toggled
      const server = servers.find((s) => s.id === id);
      if (server?.locked) return;

      // Optimistic UI update
      setActiveIds((prev) => {
        const next = enabled
          ? [...new Set([...prev, id])]
          : prev.filter((x) => x !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
      );

      // Internal connectors: persist toggle to localStorage only
      if (server?.source === "internal") {
        const disabled = getInternalDisabled();
        if (enabled) disabled.delete(id);
        else disabled.add(id);
        localStorage.setItem(
          INTERNAL_DISABLED_KEY,
          JSON.stringify(Array.from(disabled)),
        );
        return;
      }

      // MCP connectors: persist to backend
      try {
        await fetch(`${API_BASE_URL}/api/mcp/${id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      } catch {
        // Revert on failure
        setActiveIds((prev) => {
          const reverted = enabled
            ? prev.filter((x) => x !== id)
            : [...prev, id];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reverted));
          return reverted;
        });
        setServers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s)),
        );
      }
    },
    [servers],
  );

  return { servers, activeIds, toggle, loading, refetch: fetchServers };
}

// [claude-code 2026-04-04] T1: Internal connectors — in-app features that appear in the Connectors list
import type { McpServerConfig } from "../types/mcp";

/**
 * Internal connectors are NOT MCP servers. They are in-app features routed
 * through Harper chat that appear alongside MCP connectors in the ToolsDropdown.
 * When active, they inject context into Harper's system prompt or trigger backend endpoints.
 */
export const INTERNAL_CONNECTORS: McpServerConfig[] = [
  {
    id: "riskflow",
    name: "RiskFlow",
    description: "Cite a catalyst by searching the RiskFlow DB",
    transport: "stdio",
    command: "",
    args: [],
    enabled: true,
    installed: true,
    requiresApiKey: false,
    hasApiKey: true,
    category: "internal",
    locked: true,
    source: "internal",
  },
];

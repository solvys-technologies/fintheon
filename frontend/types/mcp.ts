// [claude-code 2026-03-10] MCP registry frontend types — mirror of backend types/mcp.ts

export type McpServerId =
  | 'playwright'
  | 'fmp'
  | 'exa'
  | 'notion'
  | 'unusual-whales'
  | 'yahoo-finance'
  | 'twitter-cli'
  | 'alpha-vantage';

export type McpTransport = 'stdio' | 'sse' | 'http';

export interface McpServerConfig {
  id: McpServerId;
  name: string;
  description: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  installed: boolean;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  hasApiKey: boolean;
  toolCount?: number;
  category: 'data' | 'search' | 'browser' | 'productivity' | 'social';
}

export interface McpRegistryState {
  servers: McpServerConfig[];
  lastCheckedAt: string;
}

export interface McpSessionConfig {
  enabledServers: McpServerId[];
}

export interface McpServerListResponse {
  servers: McpServerConfig[];
}

export interface McpToggleRequest {
  serverId: McpServerId;
  enabled: boolean;
}

export interface McpToggleResponse {
  success: boolean;
  server: McpServerConfig;
}

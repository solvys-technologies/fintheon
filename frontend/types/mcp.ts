// [claude-code 2026-04-04] MCP registry frontend types — mirror of backend types/mcp.ts + internal connectors

export type McpServerId =
  | 'playwright'
  | 'fmp'
  | 'exa'
  | 'notion'
  | 'unusual-whales'
  | 'yahoo-finance'
  | 'riskflow'
  | 'framer'
  | 'close-crm'
  | 'qc-mcp'
  | 'tradingview'
  | 'figma'
  | 'aquarium'
  | 'boardroom'
  | (string & {});

export type McpTransport = 'stdio' | 'sse' | 'http';

export type ConnectorSource = 'claude' | 'project' | 'internal';

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
  category: 'data' | 'search' | 'browser' | 'productivity' | 'social' | 'trading' | 'internal';
  locked?: boolean;
  source?: ConnectorSource;
  url?: string;
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

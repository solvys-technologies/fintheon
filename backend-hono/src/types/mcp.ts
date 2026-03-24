// [claude-code 2026-03-23] MCP registry shared types — T1 foundation (removed alpha-vantage, twitter-cli→riskflow)

export type McpServerId =
  | 'playwright'
  | 'exa'
  | 'notion'
  | 'unusual-whales'
  | 'yahoo-finance'
  | 'riskflow';

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
  locked?: boolean;
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

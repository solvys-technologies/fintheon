// [claude-code 2026-03-10] Frontend MCP service — wraps /api/mcp endpoints

import type ApiClient from './apiClient';
import type { McpServerId, McpServerConfig } from '../types/mcp';

export class McpService {
  constructor(private client: ApiClient) {}

  async listServers(): Promise<McpServerConfig[]> {
    try {
      const res = await this.client.get<{ servers: McpServerConfig[] }>('/api/mcp');
      return res.servers ?? [];
    } catch {
      return [];
    }
  }

  async toggleServer(id: McpServerId, enabled: boolean): Promise<McpServerConfig | null> {
    try {
      const res = await this.client.patch<{ success: boolean; server: McpServerConfig }>(
        `/api/mcp/${id}/toggle`,
        { enabled }
      );
      return res.server ?? null;
    } catch {
      return null;
    }
  }

  async checkHealth(id: McpServerId): Promise<{ ok: boolean }> {
    try {
      return await this.client.get<{ ok: boolean }>(`/api/mcp/${id}/health`);
    } catch {
      return { ok: false };
    }
  }
}

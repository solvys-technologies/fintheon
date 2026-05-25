// [claude-code 2026-05-07] SoulService — read/write agent SOUL.md files from the Fileroom.
import ApiClient from "../apiClient";

export interface SoulMeta {
  agent_id: string;
  name: string;
  role: string;
  model_prefer?: string;
}

export interface SoulContent {
  agent_id: string;
  content: string;
}

export class SoulService {
  constructor(private client: ApiClient) {}

  async list(): Promise<{ souls: SoulMeta[] }> {
    return this.client.get<{ souls: SoulMeta[] }>("/api/soul");
  }

  async get(agentId: string): Promise<SoulContent> {
    return this.client.get<SoulContent>(`/api/soul/${agentId}`);
  }

  async update(
    agentId: string,
    content: string,
  ): Promise<{ ok: boolean; agent_id: string }> {
    return this.client.put<{ ok: boolean; agent_id: string }>(
      `/api/soul/${agentId}`,
      { content },
    );
  }
}

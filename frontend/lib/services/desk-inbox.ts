import ApiClient from "../apiClient";

export type DeskInboxStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "dismissed";

export interface DeskInboxItem {
  id: string;
  deskId: string;
  type: "agentic_memo" | "chart_capture" | "approval";
  status: DeskInboxStatus;
  title: string;
  authorAgent: "harper";
  summary: string;
  body: string;
  confidence: number;
  tickers: string[];
  sourceRefs: string[];
  catalystDriftSessions: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoDraftInput {
  deskId?: string;
  title: string;
  summary?: string;
  body: string;
  confidence?: number;
  tickers?: string[];
  sourceRefs?: string[];
  catalystDriftSessions?: number;
}

export class DeskInboxService {
  constructor(private client: ApiClient) {}

  async list(deskId = "priced-in-capital"): Promise<DeskInboxItem[]> {
    const json = await this.client.get<{ items: DeskInboxItem[] }>(
      `/api/desk-inbox?deskId=${encodeURIComponent(deskId)}`,
    );
    return json.items ?? [];
  }

  async createMemoDraft(input: MemoDraftInput): Promise<DeskInboxItem> {
    const json = await this.client.post<{ item: DeskInboxItem }>(
      "/api/desk-inbox/memo-drafts",
      input,
    );
    return json.item;
  }

  async approve(id: string, deskId = "priced-in-capital"): Promise<DeskInboxItem> {
    return this.decide(id, "approve", deskId);
  }

  async requestChanges(
    id: string,
    note: string,
    deskId = "priced-in-capital",
  ): Promise<DeskInboxItem> {
    return this.decide(id, "request-changes", deskId, note);
  }

  async dismiss(id: string, deskId = "priced-in-capital"): Promise<DeskInboxItem> {
    return this.decide(id, "dismiss", deskId);
  }

  private async decide(
    id: string,
    action: "approve" | "request-changes" | "dismiss",
    deskId: string,
    note?: string,
  ): Promise<DeskInboxItem> {
    const json = await this.client.post<{ item: DeskInboxItem }>(
      `/api/desk-inbox/${encodeURIComponent(id)}/${action}`,
      { deskId, note },
    );
    return json.item;
  }
}

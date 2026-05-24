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

export interface InboxDecision {
  id: string;
  note?: string;
}

export interface ChartEvidenceRequest {
  ticker: string;
  timeframe?: string;
  source?: string;
  requestedBy?: string;
  memoId?: string;
  deskId?: string;
}

export interface ChartArtifact {
  id: string;
  ticker: string;
  timeframe: string;
  source: string;
  capturedAt: string | null;
  path: string | null;
  url: string | null;
  status: "captured" | "pending" | "unavailable";
  memoId: string | null;
  deskId: string;
  createdAt: string;
  updatedAt: string;
}

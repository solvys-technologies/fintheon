// [claude-code 2026-04-25] S42-T4: ArtifactPayload discriminated union for ArtifactPane / ArtifactSheet
// Backend agents emit one of these via BridgeStreamEvent { type: "artifact" } (T1 wires the
// SSE relay); the frontend also dispatches the same shape via window CustomEvent
// "fintheon:artifact" when a CitationChip (T3) is clicked. Both paths funnel into
// ArtifactPane (web) / ArtifactSheet (mobile).

export type ArtifactKind = "tradingview" | "browserbase" | "report" | "citation";

export interface TradingViewArtifact {
  kind: "tradingview";
  payload: {
    symbol: string;
    interval?: string;
  };
}

export interface BrowserbaseArtifact {
  kind: "browserbase";
  payload: {
    sessionUrl: string;
    sessionId?: string;
  };
}

export interface ReportArtifact {
  kind: "report";
  payload: {
    html: string;
    title?: string;
  };
}

export interface CitationArtifact {
  kind: "citation";
  payload: {
    title: string;
    snippet?: string;
    source?: string;
    url?: string;
  };
}

export type ArtifactPayload =
  | TradingViewArtifact
  | BrowserbaseArtifact
  | ReportArtifact
  | CitationArtifact;

export const ARTIFACT_EVENT = "fintheon:artifact" as const;

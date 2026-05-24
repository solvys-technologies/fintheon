# Sprint Brief: S83-T4 -- Chart Evidence Capture

## Context

Agentic memos should be chart-heavy. Futures chart embeds are not reliable inside chat, so chart evidence should prefer screenshot artifacts captured by a local automation path.

## Scope

- Use `@sprint-md/S83-T4-chart-evidence-capture.md` in Linear issue descriptions.
- Branch target: `sprint/S83`.
- Add a chart evidence request contract for memo drafts.
- Prefer embedded chart screenshots for futures contracts.
- Allow generated mini charts only as a fallback when screenshot capture is unavailable.
- Design the capture runner so a Codex CLI/computer-use sub-agent can open the chart, take the screenshot, and return the artifact path/metadata.
- Store chart artifacts as File Room attachments linked to the memo draft.

## Files

- Owned: `backend-hono/src/services/chart-evidence/*`, `backend-hono/src/routes/chart-evidence/*`, `scripts/chart-evidence-*`.
- Reference: `scripts/chart-proposal.ts`, `backend-hono/src/routes/proposals/handlers.ts`, `frontend/components/chat/slots/TVChartSlot.tsx`, `frontend/components/chat/slots/VisionInsightSlot.tsx`.
- Avoid: relying on TradingView embeds for futures chart display inside chat.

## Acceptance

- A memo draft can request chart evidence for one or more tickers.
- Screenshot artifact metadata includes ticker, timeframe, source, capturedAt, path/url, and capture status.
- Capture failure degrades to a clear pending/unavailable state without blocking the memo draft.
- Published File Room memo can show chart evidence attachments.
- `cd backend-hono && bun run build` passes if backend files changed.

# Sprint Brief: S31-T8 — Browser-Harness Integration + Voice Orb Wiring + Omi Sidebar Chat Takeover

## Context

Sprint 2 (Harper 2.1). Three related integrations, all bound by "how Harper interfaces with the world":

1. **Browser-harness** — Harper gets access to the `browser-harness` tool for web search, web exploration, quick facts, pro tips. Also used for UI/UX testing sweeps and RiskFlow feed debugging. Critical addition — Harper can't browse today.
2. **Voice orb wiring** — the existing orb in the heading toolbar becomes the master switch for voice chat (Omi sessions). Click = toggle on/off. Replaces any separate toggle.
3. **Sidebar chat takeover** — when the sidebar chat opens, it **replaces the Omi quick-chat interface** (the small floating Omi chat popup). User sees one chat, not two.

## Branch Target

`s31-harper-2-1`

## Scope — Included

### Browser-harness tool exposure to Harper

- [ ] Grep for the existing `browser-harness` integration. Candidates: `backend-hono/src/services/browser/*`, `services/browse_task/*`, or an Electron preload bridge. Report what's actually installed.
- [ ] Wire `browser-harness` as a **Harper-callable tool** via the Strands agent tool registry:
  - Tool name: `browser_harness`
  - Description (for Harper's system prompt addendum): "Open, navigate, and observe web pages. Use for web search, fact checks, documentation lookup, UI/UX testing, and RiskFlow feed debugging."
  - Exposed methods: `search(query)`, `open(url)`, `read(selector?)`, `click(selector)`, `fill(selector, text)`, `screenshot()`, `close()`
  - Auth: Harper-only; tool unavailable to desk agents (Oracle/Feucht/Consul/Herald unless explicitly needed later)
- [ ] Safety: rate-limit `browser_harness` invocations per user — max 20 actions per minute. Prevents runaway loops.
- [ ] Log every invocation to a new `browser_harness_audit` table:
  ```sql
  CREATE TABLE IF NOT EXISTS browser_harness_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    tool TEXT NOT NULL,             -- 'search' | 'open' | 'read' | 'click' | ...
    input JSONB,
    result_summary TEXT,
    duration_ms INT
  );
  ```
  Migration file: `backend-hono/migrations/038_browser_harness_audit.sql`.

### Voice orb as voice-chat toggle

- [ ] Find the existing voice orb in the heading toolbar (grep `VoiceOrb`, `Orb.tsx`, or similar — likely in `frontend/components/chat/` or `frontend/components/layout/`)
- [ ] Wire single-click behavior:
  - Orb state: `idle` / `listening` / `muted`
  - Click when `idle` → starts Omi voice session → orb pulses Solvys Gold
  - Click when `listening` → stops Omi voice session → orb returns to idle
  - No separate mic-toggle elsewhere — this is the single control
- [ ] Remove any duplicate voice-toggle UI (grep and delete)
- [ ] Disabled state: when backend reports Omi/Hermes sidecar unavailable, orb dims + tooltip "Voice unavailable"

### Sidebar chat takeover of Omi quick-chat

- [ ] Find the Omi quick-chat floating UI (grep `OmiQuickChat`, `QuickChat`, `FloatingChat`, or references to Omi chat mounted outside the sidebar)
- [ ] When sidebar chat is open (or becomes open): Omi quick-chat UI hides entirely
- [ ] Omi voice transcript stream continues but feeds into the sidebar chat instead of the floating popup — user sees a single unified chat
- [ ] When sidebar closes: the quick-chat floater returns (optional — confirm with TP whether we keep it at all or delete outright). **Default: delete the floater entirely, sidebar is the only chat surface.**
- [ ] On mobile PWA: the sidebar IS the chat; no floater anyway

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S31-T8 browser-harness + voice orb + sidebar takeover`

## Scope — Excluded (DO NOT TOUCH)

- Harper Vision perception — T2
- Provider chain / Ollama fallback — T3
- Consul Control corners — T4
- Streamdown + TV charts — T5
- Blindspots + ER monitor — T6
- Advisory + calendar pill + autopilot guardian — T7
- Predictive feature knowledge graph — T9
- The `browser-harness` binary/service itself — assume it exists and is a callable tool

## Known Issues to Preserve

- Memory: `feedback_send_button_style.md` — circular ArrowUp, don't change.
- Memory: `feedback_no_glass_effects.md` — no `backdrop-blur` on the orb or sidebar.
- The voice orb's existing visual design stays; only click behavior + single-source-of-truth changes.
- Omi STT pipeline (`voice-service.ts` → Hermes sidecar `/v1/voice/stt`) is unchanged. This track wires UX, not the STT path.
- If `browser-harness` is not actually installed in this repo, build a thin wrapper around `page.goto` via `playwright` (already in Consul Control's stack per T4) and call that the browser-harness — document the decision in the track PR.

## Implementation Steps

1. Grep for `browser-harness` / `BrowserHarness` / `browse_task`; report findings. If missing, bootstrap via Playwright.
2. Register the tool in the Strands agent-factory tool list for Harper only. System-prompt addendum for Harper: "You have browser_harness; use it for web search, fact checks, UI/UX sweeps, RiskFlow debug."
3. Migration `038_browser_harness_audit.sql`; hand to TP.
4. Build audit-write hook around tool invocation.
5. Voice orb: wire single-click toggle to Omi start/stop. Remove duplicate toggles.
6. Sidebar takeover: hide/delete quick-chat floater when sidebar mounts. Confirm deletion with TP if uncertain.
7. Smoke: toggle voice orb, verify Omi session starts + sidebar chat receives transcripts.
8. Changelog + headers.

## Acceptance Criteria

- [ ] Harper can call `browser_harness` tool in chat and receive results
- [ ] Every `browser_harness` call writes to `browser_harness_audit`
- [ ] Rate limit enforced: 21st call within 60s → 429
- [ ] Voice orb toggle starts/stops Omi session on single click; orb visual state matches
- [ ] No duplicate voice toggle exists anywhere in the UI
- [ ] Sidebar chat open → Omi floater is hidden (or deleted); transcripts appear in sidebar
- [ ] Mobile PWA sidebar chat works identically
- [ ] `bun run build` + `vite build` pass
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Audit table check after first tool call
curl -s http://localhost:8080/api/diagnostics | jq '.tools.browser_harness'

# Confirm no duplicate voice toggles
grep -rn "startVoice\|toggleVoice\|MicToggle" frontend/ | grep -v VoiceOrb | head
```

## Commit Format

```
[v5.23.0] feat: S31-T8 browser-harness tool + voice orb toggle + Omi sidebar takeover
```

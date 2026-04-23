# Sprint Brief: S32-T8 — Browser-Harness for Harper + Voice-Orb Toggle + Sidebar Chat Takeover (single-agent)

## Intent

Harper gains first-party access to a browser for web search, fact-checks, UI/UX sweeps and RiskFlow debugging; the voice orb in the header becomes the single source of truth for starting and stopping a voice session (no other mic toggles anywhere); and the sidebar chat absorbs the Fintheon floating chat entirely — one conversation surface, not two. This is the S32 re-run of S31-T8, which was planned in `sprint-md/S31-T8-browser-harness-voice-orb-sidebar-chat.md` but never executed (audit: no migration, no Harper tool registration, `FintheonFloatingChat` still mounted). S32-T8 closes it with concrete file targets derived from the current tree.

## Branch Target

`feature/s32-t8-harness-orb-sidebar` (branch off `v5.22` — do NOT branch off `feature/s31-t2-alt-skills`, which is unrelated alt-skills work).

## Scope — Included

- [ ] Promote `backend-hono/src/workers/news-worker/sources/browser-harness.ts` (or a sibling under `backend-hono/src/services/browser/`) into a shared `BrowserHarness` surface that Harper can call as a tool — `search`, `open`, `read`, `click`, `fill`, `screenshot`, `close`
- [ ] Register `browser_harness` in Harper's Strands tool list at `backend-hono/src/services/strands/agents/harper.ts` (Harper only — Oracle/Feucht/Consul/Herald do NOT get it this sprint)
- [ ] Add Harper system-prompt addendum (in the same file or in `backend-hono/src/services/ai/soul/harper.md` instruction section) explaining when to reach for the tool: web search, fact-checks, UI/UX sweeps, RiskFlow debug
- [ ] Per-user rate limit: 20 `browser_harness` actions per 60s window → 21st call returns a structured `RATE_LIMITED` tool result (NOT an HTTP 429; Harper must see a tool error it can reason about)
- [ ] New Supabase migration `backend-hono/migrations/031_browser_harness_audit.sql` (next number after `030_harper_vision.sql`) creating `browser_harness_audit (id, user_id, ts, tool, input jsonb, result_summary, duration_ms)` with RLS so users only read their own rows; service role writes
- [ ] Audit-write wrapper around every tool invocation — tool name, input, 200-char result summary, duration; never block the response on the audit write (fire-and-forget with `console.error` on failure)
- [ ] Voice orb (`frontend/components/voice/VoiceAuroraOrb.tsx` + `HeaderVoiceControl.tsx`) becomes the **only** voice-session toggle. Single click: `idle → listening` starts an Omi/Hermes session; `listening → idle` stops it. Reuse existing `resolveVoiceOrbState` state machine
- [ ] Grep and delete every other mic/voice toggle affordance in `frontend/` (mic icons outside the orb, any `MicToggle`, `startVoice`/`toggleVoice` buttons in panels). Leave the orb as the sole entry point
- [ ] Disabled state: when `/api/voice/health` or Hermes sidecar is unreachable, orb dims + tooltip "Voice unavailable". Do NOT hide the orb
- [ ] Delete `frontend/components/chat/FintheonFloatingChat.tsx` and its mount site(s). The sidebar chat (`frontend/components/chat/ChatSidebar.tsx`) is now the single chat surface on desktop AND mobile
- [ ] Route the Omi voice transcript stream into `ChatSidebar.tsx` as message bubbles (reuse `FintheonStreamingBubble` for in-flight text). No second transcript UI
- [ ] Changelog entry in `src/lib/changelog.ts`
- [ ] File header `// [claude-code 2026-04-23] S32-T8 browser-harness tool + voice orb + sidebar takeover` on every substantially modified file

## Scope — Excluded (OUT OF BOUNDS)

- Desk agents (Oracle, Feucht, Consul, Herald) getting `browser_harness` — future track
- The `browser_harness` / Playwright binary/service itself — treat what's already in `news-worker/sources/browser-harness.ts` as the implementation to surface
- Voice STT/TTS pipeline changes (Hermes `/v1/voice/*` stays as-is — S31-T3 territory)
- The voice orb's visual design — only its click behavior + exclusivity changes
- Sidebar chat redesign/layout — only absorbing the floater and transcript routing
- Predictive feature knowledge graph — S31-T9 / future
- Harper Vision perception, Consul Control corners, Streamdown/TV, Blindspots, Advisory pill — all other S31 tracks

## Known Issues to Preserve

- `feedback_send_button_style.md` — circular ArrowUp send button. Do NOT swap for a paper-plane/send icon while touching the composer
- `feedback_no_glass_effects.md` — no `backdrop-blur`, no `box-shadow`, no glass surfaces on orb, sidebar, or anything adjacent. Flat + thin `#c79f4a` border only
- `feedback_fuses_are_sacred.md` — do NOT touch NothingFuse/RiskFlowCard fuse UI or any agent-spinner icon bank while grepping for voice toggles
- `feedback_supabase_migration_filenames.md` — write the migration file locally and hand to TP for `supabase db push`. Do NOT run `mcp__claude_ai_Supabase__apply_migration` or `execute_sql` for DDL
- `feedback_launchd_backend_desktop_checkout.md` — launchd reads from `~/Desktop/Codebases/fintheon`; after backend changes, TP must sync Desktop before localhost serves the new routes
- `feedback_no_key_caution_lectures.md` — if TP shares any secrets while debugging, wire them silently
- Existing `HeaderVoiceControl` already calls `resolveVoiceOrbState`; reuse the state machine, don't fork

## Design Pass

### Layout / Interaction — Voice Orb

- Location unchanged (header toolbar, existing mount point)
- States (existing): `idle` (dim Solvys Gold), `listening` (gentle pulse, 2s cycle 0.6→1.0→0.6), `muted` (50% opacity), `speaking` (if already wired — keep)
- New: `disabled` (30% opacity, pointer-events: none, tooltip "Voice unavailable") when `/api/voice/health` returns degraded
- Click handler: pure toggle against `useVoice()` session state. No second click target anywhere in the app
- No ripple, no glow, no shimmer — existing aurora style is the ceiling; do not add ornament

### Layout / Interaction — Sidebar Chat Takeover

- `ChatSidebar.tsx` stays as the chat surface. Width, accent border, and composer unchanged
- Voice transcripts arrive as message bubbles with `role: 'user'` (STT) and `role: 'assistant'` (TTS text). Use `FintheonStreamingBubble` while a response is in-flight; collapse to `ChatMessageBubble` when done
- A subtle status line above the composer ("Listening…" or "Harper is speaking…") sourced from `useVoice()` — one line, `#c79f4a` at 70%, no animation beyond text change
- Floater removal is total: delete file, delete import, delete mount. If a stale mount point references it, the build surfaces the error; fix inline

### API / Service Shape — Browser Harness

- Harper tool declaration (registered in `backend-hono/src/services/strands/agents/harper.ts`):
  ```ts
  {
    name: 'browser_harness',
    description: 'Open, navigate, and observe web pages. Use for web search, fact-checks, documentation lookup, UI/UX sweeps, and RiskFlow feed debugging. Rate-limited to 20 actions per minute.',
    input_schema: z.object({
      action: z.enum(['search', 'open', 'read', 'click', 'fill', 'screenshot', 'close']),
      url: z.string().url().optional(),
      selector: z.string().optional(),
      value: z.string().optional(),
      query: z.string().optional(),
    }),
  }
  ```
- Service surface in `backend-hono/src/services/browser/harness.ts` (promoted/shared from the news-worker harness): each action is a pure function returning `{ ok: true, data } | { ok: false, error: 'RATE_LIMITED' | 'NAV_FAILED' | 'TIMEOUT', hint?: string }`
- Fallback behavior: if Playwright binary missing in the environment, the tool returns `{ ok: false, error: 'HARNESS_UNAVAILABLE', hint: 'install playwright' }` — never crashes Harper
- Rate limiter: in-memory Map keyed by `user_id`, 60s sliding window, ejected on process restart (acceptable — this is a courtesy rail, not a security boundary)

### Data Shape — Audit Table

```sql
-- backend-hono/migrations/031_browser_harness_audit.sql
CREATE TABLE IF NOT EXISTS browser_harness_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  tool TEXT NOT NULL,
  input JSONB,
  result_summary TEXT,
  duration_ms INT
);

CREATE INDEX browser_harness_audit_user_ts_idx
  ON browser_harness_audit (user_id, ts DESC);

ALTER TABLE browser_harness_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own audit"
  ON browser_harness_audit FOR SELECT
  USING (auth.uid() = user_id);

-- writes via service role only; no insert policy for authenticated
```

### Aesthetic Rules

- Flat surfaces, thin `#c79f4a` border where separation is needed
- No gradients, no emojis, no glass blur, no Kanban borders, no box-shadows
- Send button stays circular ArrowUp
- Typography and spacing per `/solvys-feels`

## Development Flow

1. **Recon** — grep `browser-harness`, `BrowserHarness`, `FloatingChat`, `MicToggle`, `startVoice`, `toggleVoice`. Write down every file touched before editing anything
2. **Data layer** — write `031_browser_harness_audit.sql` migration, hand to TP. Do NOT apply via MCP. Define TypeScript types for rows in `backend-hono/src/types/browser-harness.ts`
3. **Service layer** — extract `backend-hono/src/services/browser/harness.ts` from news-worker version (keep news-worker importing the new shared module). Zod schemas, pure functions, early-return errors. In-memory rate limiter module co-located
4. **Tool registration** — add `browser_harness` to Harper's tool list in `backend-hono/src/services/strands/agents/harper.ts`. System-prompt addendum in the same file or in `services/ai/soul/harper.md`. Audit-write wrapper runs before returning the tool result, fire-and-forget on error
5. **Voice orb wiring** — confirm `HeaderVoiceControl.tsx` already owns the toggle. Add `disabled` state when `/api/voice/health` is degraded. Delete every other mic/voice affordance found in step 1
6. **Sidebar takeover** — delete `frontend/components/chat/FintheonFloatingChat.tsx`, delete its import, delete its mount. Route transcript events from `useVoice()` into `ChatSidebar.tsx` as bubbles. Add the one-line status row above the composer
7. **Validation** — `bun run build`, `tsc --noEmit`, `rm -rf dist && vite build`. Live curl the diagnostics endpoint. Manually exercise orb → transcript → sidebar path
8. **Changelog + headers** — `src/lib/changelog.ts` entry; `// [claude-code 2026-04-23]` header on every modified file

## Acceptance Criteria

- [ ] Harper, in a chat session, can invoke `browser_harness` and receive structured results for `search`/`open`/`read`/`click`/`fill`/`screenshot`/`close`
- [ ] 21st invocation inside a 60s window returns `{ ok: false, error: 'RATE_LIMITED' }` — Harper continues the turn without crashing
- [ ] Every successful invocation writes a row to `browser_harness_audit`; a `SELECT` as the caller returns only that user's rows
- [ ] Oracle/Feucht/Consul/Herald do NOT see `browser_harness` in their tool list
- [ ] Clicking the voice orb when idle starts a voice session; clicking again stops it. Orb state visibly matches `idle`/`listening`/`speaking`/`muted`/`disabled`
- [ ] `grep -rn "startVoice\|toggleVoice\|MicToggle\|mic-toggle" frontend/ | grep -v VoiceOrb | grep -v useVoice` returns zero matches
- [ ] `FintheonFloatingChat.tsx` is deleted; no references remain in the repo
- [ ] Voice transcripts appear in `ChatSidebar.tsx` as bubbles, not in a separate popup
- [ ] Mobile PWA sidebar chat works identically (build + manual smoke)
- [ ] When the Hermes sidecar is down, orb is dimmed + tooltip reads "Voice unavailable"; clicks are no-ops
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] Changelog entry in `src/lib/changelog.ts`
- [ ] `// [claude-code 2026-04-23]` header on every substantially modified file

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build (stale-bundle prevention)
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build && cd ..

# Live endpoint smoke (backend must be running locally)
curl -s http://localhost:8080/api/harper/tools | jq '.[] | select(.name=="browser_harness")'
curl -s http://localhost:8080/api/diagnostics | jq '.tools.browser_harness // "not reported"'

# Prove no duplicate voice toggles remain
grep -rn "startVoice\|toggleVoice\|MicToggle\|mic-toggle" frontend/ | grep -v VoiceOrb | grep -v useVoice

# Prove the floater is gone
rg -n "FintheonFloatingChat" frontend/ src/ electron/ && echo "FAIL: references remain" || echo "OK"
```

## Commit Format

```
[v5.23.0] feat: S32-T8 browser-harness tool for Harper + voice-orb single-source toggle + sidebar chat takeover
```

## Assumptions Worth Flagging to TP Before Start

- **Branch naming** — used `feature/s32-t8-harness-orb-sidebar` off `v5.22`. If TP wants this on `s32-harper-2-1` (that ref exists in `.git/refs/heads/`), rebase
- **Harness source** — assumed `news-worker/sources/browser-harness.ts` is the canonical implementation to factor. If a newer Playwright wrapper exists under `services/browser/` (`operator.ts`/`pool.ts` are there from S27-T6), use that instead and delete this assumption
- **Floater total delete** — S31-T8 allowed "keep it when sidebar is closed" as a fallback. This brief commits to total deletion per the "Default: delete the floater entirely" line in S31-T8. If TP wants the conditional fallback, add it back before step 6
- **Rate limit response shape** — tool-level error, not HTTP 429, so Harper can reason about it conversationally. Flip to 429 only if Harper must hard-stop

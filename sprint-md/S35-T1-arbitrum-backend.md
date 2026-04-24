# Sprint Brief: T1 — Arbitrum Backend (Engine + Hermes Adapter + Event Trigger + 17:00 Scheduler + Commentator Helper)

## AMENDMENT 2026-04-24 — BACKEND-SAFETY FIXES (read first)

Two backend-safety rules were tightened after initial brief:

1. **Event-trigger is fire-and-forget.** Insertion in `central-scorer.ts` at post-upsert sites (around lines 543, 560 where `.from("scored_riskflow_items")` writes happen) must be `void eventTrigger.checkAndFire(row).catch(err => log.error({err}, "arbitrum event-trigger failed"))` — NEVER `await`. If Ollama/DashScope is down, the chamber call can take 20s+; the riskflow scorer cannot block on it.
2. **`resolveProvider(modelId)` defaults to `'openrouter'`** for any model id not in the arbitrum seat map. This preserves harper-cao's existing Claude-Opus path verbatim. Regression test: `POST /api/harper/chat` must still return a valid Claude response after T1 ships.

Both rules are codified in the plan file under "Build-never-breaks policy."

## Context

Arbitrum is Fintheon's new multi-agent deliberation engine, replacing MiroShark. Five Qwen-family seats debate via Hermes (NOT OpenRouter — that path is reserved for harper-cao), produce a signal landscape with explicit dissent surfacing, and persist a verdict. This track builds the entire backend: chamber orchestration, per-seat MoA, facilitator synthesis, Hermes provider-routing abstraction, commentator top-N helper, event trigger (iv_score ≥ 8.5 + priority filter), session cron (17:00 ET weekdays), and API routes. Output shape: signal digest only — NO `decision` field, NO `recommended_action`, NO auto-trade gates. Human-in-the-loop.

## Branch Target

`s35-t1-arbitrum-backend` (off `s34-unified`)

## Scope — Included

- [ ] `backend-hono/src/services/arbitrum/chamber.ts` (NEW) — orchestrates 5-seat debate, 2-3 rounds
- [ ] `backend-hono/src/services/arbitrum/seats.ts` (NEW) — per-seat MoA invocation, 2-layer distillation using sibling Qwens
- [ ] `backend-hono/src/services/arbitrum/facilitator.ts` (NEW) — Lead Analyst synthesis, weighted consensus, dissent detection
- [ ] `backend-hono/src/services/arbitrum/gates.ts` (NEW) — consensus spread / category quality / calibration watermark as SIGNALS on digest (not vetoes)
- [ ] `backend-hono/src/services/arbitrum/verdict-store.ts` (NEW) — Supabase writes to `arbitrum_verdicts` + `getLatestChamberRead()` helper for T11
- [ ] `backend-hono/src/services/arbitrum/event-trigger.ts` (NEW) — hook into riskflow scorer; iv_score ≥ 8.5 + priority filter (speaker top-10 commentator OR party-of-interest) fires chamber
- [ ] `backend-hono/src/services/cron/arbitrum-session-scheduler.ts` (NEW) — node-cron at `00 21 * * 1-5` UTC (17:00 ET) that triggers a session deliberation; exports `startArbitrumSessionScheduler()` / `stopArbitrumSessionScheduler()`
- [ ] `backend-hono/src/routes/arbitrum/index.ts` (NEW) — routes: `POST /deliberate`, `GET /verdicts/:id`, `GET /latest`
- [ ] `backend-hono/src/routes/index.ts` (EDIT) — mount `app.route("/api/arbitrum", arbitrumRoutes)` after existing routes block
- [ ] `backend-hono/src/services/hermes-service.ts` (EDIT lines 135-148) — extend `HERMES_TASK_MODEL_MAP` with seat task keys: `"arbitrum-seat-lead"`, `"arbitrum-seat-forecaster"`, `"arbitrum-seat-risk"`, `"arbitrum-seat-quant"`, `"arbitrum-seat-bear"`
- [ ] `backend-hono/src/services/hermes-service.ts` (EDIT) — add provider-routing abstraction: `resolveProvider(modelId): 'ollama' | 'dashscope' | 'groq' | 'openrouter'` so seats route correctly without forcing OpenRouter
- [ ] `backend-hono/src/services/hermes-handler.ts` (EDIT lines 712-721) — extend `selectModel()` to accept a task key and return `{modelId, provider}` from the new abstraction; preserve harper-cao's OpenRouter path (lines 940-951) untouched
- [ ] `backend-hono/src/services/commentator/commentator-service.ts` (EDIT) — add `getTopNCommentators(n: number): CommentatorEntry[]` sorting `getRegistry()` output by `weightMultiplier` descending

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/boot/services.ts` — T12 unification wires `startArbitrumSessionScheduler()` here; export it from your service but DO NOT add the call yourself
- `supabase/migrations/` — T2 owns the migration file. You assume `arbitrum_verdicts` schema as defined in T2's brief
- `frontend/components/arbitrum/` — T3 owns the frontend
- `backend-hono/src/services/brief-generator.ts` — T11 owns the PMDB Chamber Read injection; you only export the `getLatestChamberRead()` helper from `verdict-store.ts`
- Any `services/agent-desk/` or `miroshark_deliberations` references — T9 owns the tear-out; leave the legacy code alone in this track
- Any file touched by T4/T5/T6/T7/T8 (CAO copy, TOTT, legacy names, econ-enricher rename, CLAUDE.md)

## Reuse Inventory (existing code to call, not reinvent)

- `createLogger(name)` from `../lib/logger.js` — use `createLogger("Arbitrum")` etc for each service file
- Supabase client from `../services/supabase-service.ts` — use the existing `getSupabase()` export for all writes
- `fuzzyMatchSpeaker()` at `services/commentator/commentator-service.ts:97-121` — use in event-trigger to match riskflow row's `SubScoreBreakdown.speaker` against commentator registry
- Existing Hermes streaming path at `hermes-handler.ts:940-951` — DO NOT modify; mirror its shape for Ollama + DashScope + Groq adapters
- `FeedItem.ivScore` at `backend-hono/src/types/riskflow.ts:59` — event trigger reads this
- `SubScoreBreakdown.speaker` at `backend-hono/src/types/riskflow.ts:44` (approximately — verify at line ~44)
- node-cron pattern: look at `services/cron/dispatch-scheduler.ts` for the existing cron registration pattern — copy it
- `getCurrentBriefType()` at `brief-generator.ts:33-46` — Arbitrum at 17:00 ET precedes PMDB window start (17:30 ET), so no overlap

## Seat config (canonical)

```ts
// backend-hono/src/services/arbitrum/seats.ts
export const ARBITRUM_SEATS = [
  {
    id: "lead",
    role: "Lead Analyst",
    model: "qwen3-235b-a22b",
    provider: "dashscope",
    weight: 0.3,
    persona: "harper",
  },
  {
    id: "forecaster",
    role: "Forecaster",
    model: "qwen2.5-72b-instruct",
    provider: "ollama",
    weight: 0.3,
    persona: "oracle",
  },
  {
    id: "risk",
    role: "Risk Manager",
    model: "qwq-32b-preview",
    provider: "ollama",
    weight: 0.2,
    persona: "feucht",
  },
  {
    id: "quant",
    role: "Quantitative",
    model: "qwen2.5-coder-32b",
    provider: "ollama",
    weight: 0.1,
    persona: "consul",
  },
  {
    id: "bear",
    role: "Bear Case",
    model: "qwen3-14b",
    provider: "ollama",
    weight: 0.1,
    persona: "feucht-alt",
    fallback: { model: "llama3.3-70b", provider: "ollama" },
  }, // non-Qwen for structural divergence
] as const;
```

Env vars (add to `.env.example` with empty defaults):

- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `DASHSCOPE_API_KEY` (optional; free-tier)
- `GROQ_API_KEY` (optional; free-tier fallback for DashScope)

## Chamber flow (pseudocode spec)

```
POST /api/arbitrum/deliberate { question, context, category, trigger_type: 'event'|'session' }
  |
  +-> chamber.run(input)
        for each seat in ARBITRUM_SEATS:
          draft = seats.invokeMoA(seat, input)   // 2-layer MoA, sibling Qwens
        round1 = all drafts
        round2 = each seat revises after seeing peer drafts
        if max-min consensus spread > 25pp: round3 = one more revision
        digest = facilitator.synthesize(rounds, weights)
        dissent = detect dissent (any seat > 18pp from weighted mean)
        gates = gates.compute(rounds, category, calibration_history)  // SIGNALS only
        verdict = { verdict_id, created_at, trigger_type, question, category,
                    seats: [...transcripts], consensus_probability, confidence,
                    dissent, gates_surfaced: gates, digest_text,
                    iv_simulation: context.iv_sim }
        verdict-store.save(verdict)
        return verdict
```

## Known Issues to Preserve

- harper-cao uses OpenRouter (hermes-handler.ts lines 940-951). That path stays. Arbitrum seats use a separate provider abstraction.
- Fintheon runs in-process node-cron, NOT Anthropic Routines (memory: feedback_no_claude_routines).
- Launchd backend reads `dist/index.js` from `~/Desktop/Codebases/fintheon`. Any new route / cron lands locally only after Desktop sync + launchd restart (T12 handles).
- Commentator registry is in-memory cached — `getTopNCommentators(n)` sorts the cached list on each call; O(N log N) where N is small, fine without memoization.
- Wave 1 backend boot/services.ts edits belong to T12. Export your scheduler's `startArbitrumSessionScheduler` and `stopArbitrumSessionScheduler` — do NOT import them into boot here.

## Implementation Steps

1. Scaffold `services/arbitrum/` directory with empty stubs for each file; add `createLogger("Arbitrum")` in each
2. Define the `ArbitrumVerdict` type matching T2's migration schema (see T2 brief for columns)
3. Implement `verdict-store.ts` first — `saveVerdict()`, `getVerdict(id)`, `getLatestByTrigger(trigger_type)`, and `getLatestChamberRead(): Promise<string | null>` which returns the latest `trigger_type='session'` verdict's `digest_text` or null
4. Implement the Hermes provider-routing abstraction in `hermes-service.ts`:
   - Add `resolveProvider(modelId)` function
   - Extend `HERMES_TASK_MODEL_MAP` with the 5 arbitrum-seat-\* keys
   - Add Ollama adapter (HTTP call to `${OLLAMA_BASE_URL}/api/chat`)
   - Add DashScope adapter (OpenAI-compatible endpoint at `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`)
   - Add Groq adapter (OpenAI-compatible endpoint at `https://api.groq.com/openai/v1/chat/completions`) as DashScope fallback
5. Extend `hermes-handler.ts::selectModel()` to return `{modelId, provider, adapter}`
6. Implement `seats.ts::invokeMoA(seat, input)` — 2-layer MoA:
   - Layer 1: 2 sibling Qwens (smaller size) generate drafts
   - Layer 2: seat's primary model takes the 2 drafts + system prompt and distills a refined position
7. Implement `chamber.ts::run(input)` — round-by-round orchestration per the pseudocode spec
8. Implement `facilitator.ts::synthesize(rounds, weights)` — weighted-average consensus probability, generate `digest_text` (2-3 paragraph human-readable brief), detect dissent (> 18pp from weighted mean)
9. Implement `gates.ts::compute()` — returns `{consensus_spread_pp, category_quality, calibration_watermark}`; these are SURFACED on the verdict, not action gates
10. Implement `event-trigger.ts::checkAndFire(riskflowItem)`:
    - Read `ivScore` + `subScores.speaker`
    - If `ivScore >= 8.5` AND (`fuzzyMatchSpeaker(speaker)` in top-10 commentators OR speaker matches party-of-interest list)
    - Enqueue a chamber.run() with `trigger_type: 'event'`
    - Party-of-interest list (hardcoded for now): `["Powell", "Yellen", "Musk", "Fed Chair", "Treasury Secretary", "SEC Chair", "Draghi", "Lagarde"]`
11. Implement `cron/arbitrum-session-scheduler.ts` — register node-cron `00 21 * * 1-5` UTC (= 17:00 ET weekdays); fires `chamber.run({question: "End-of-session risk landscape", category: "session-digest", trigger_type: 'session', context: {iv_sim: ..., upcoming_catalysts: ...}})`. Export start/stop.
12. Implement `routes/arbitrum/index.ts` with the 3 endpoints; require auth on `POST /deliberate`, public on GET endpoints
13. Mount `/api/arbitrum` in `routes/index.ts` — locate the existing mount block (e.g., `app.route("/api/riskflow", ...)`) and add alongside
14. Export from every arbitrum service file via a barrel `services/arbitrum/index.ts`: `export * from './chamber.js'; export * from './verdict-store.js'; export { startArbitrumSessionScheduler, stopArbitrumSessionScheduler } from '../cron/arbitrum-session-scheduler.js';`
15. Add the riskflow scorer hook — find where scored items are written (services/riskflow/feed-service.ts or similar) and call `event-trigger.checkAndFire(newRow)` after successful insert. This is the ONE cross-service edit; keep it minimal (2-3 lines).

## Acceptance Criteria

- [ ] `cd backend-hono && bun run build` clean
- [ ] `POST /api/arbitrum/deliberate` with `{question, category, trigger_type: 'event'}` returns a valid verdict object within 30s
- [ ] `GET /api/arbitrum/latest` returns 200 with empty body if no runs, or the latest verdict
- [ ] `GET /api/arbitrum/verdicts/:id` returns the specified verdict
- [ ] `getLatestChamberRead()` returns the latest `trigger_type='session'` digest text (or null)
- [ ] `hermes-service.ts` `HERMES_TASK_MODEL_MAP` contains the 5 arbitrum-seat-\* entries
- [ ] `resolveProvider()` correctly maps each seat's model to its provider
- [ ] harper-cao chat still works (regression check: POST /api/harper/chat with any prompt returns a Claude Opus response via OpenRouter path)
- [ ] Event trigger fires chamber when a row with `iv_score >= 8.5` and Powell/Fed speaker lands
- [ ] `getTopNCommentators(10)` returns 10 entries sorted by `weightMultiplier` desc
- [ ] Cron registration logs `ArbitrumSessionScheduler registered` on boot (visible in launchd logs after T12 wires it)

## Validation Commands

```bash
cd backend-hono && bun run build
cd backend-hono && bun run test 2>/dev/null || echo "No test suite"

# With local Ollama + env vars set, smoke-test the chamber:
curl -X POST http://localhost:8080/api/arbitrum/deliberate \
  -H "Content-Type: application/json" \
  -d '{"question":"Will Fed cut 50bps in June?","category":"macro","trigger_type":"event"}' \
  | jq '.verdict_id, .consensus_probability, .dissent.seat'
```

## Commit Format

```
[v5.25.0-S35-T1] feat: Arbitrum backend — 5-seat chamber + Hermes provider routing + event/session triggers

Adds backend-hono/src/services/arbitrum/ (chamber, seats, facilitator,
gates, verdict-store, event-trigger), routes/arbitrum/, cron session
scheduler, Hermes provider abstraction for Ollama+DashScope+Groq, and
getTopNCommentators helper. Exports startArbitrumSessionScheduler for
T12 to wire into boot/services.ts. No OpenRouter for Arbitrum seats;
harper-cao Claude-Opus path preserved.
```

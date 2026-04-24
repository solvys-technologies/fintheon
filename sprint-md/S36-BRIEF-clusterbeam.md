# Sprint Brief: S36 — ClusterBeam (single-agent)

## Intent

A Fintheon user opens a dense NarrativeFlow cluster — one of those 25+ headline pile-ups tied to a narrative thread — and instead of a cramped inline expander they get **ClusterBeam**: a right-docked panel that slides in with the same gesture as Timeline, leads with an AI summary of what the cluster _means_, lets them scrub a mini-timeline of every headline in the group, and fires a gold pulse back along the rope to the parent narrative hub the moment it opens. The cluster stops being a dead-end node and starts feeling wired to the rest of the canvas — hover a headline on the right, the cluster blooms on the left; a fresh news item lands during live trading and the pulse shoots _into_ the cluster instead of silently appending. This is the kind of update users feel, and it re-establishes NarrativeFlow as the Solvys surface with the most alive interaction model in the product.

## Branch Target

`s36-clusterbeam`

> **Sprint numbering note:** the user's original scope said `s35-clusterbeam`, but S35 is already fully claimed by the Arbitrum / CAO-copy / TWT / canonical-naming sweep (8 tracks in `sprint-md/`). Per the `feedback_sprint_number_collision_check.md` memory, this brief is renumbered to **S36** and the branch to `s36-clusterbeam`. No scope change.

## Scope — Included

- [ ] Right-docked **ClusterBeamPanel** (420px, mirrors TimelineOverlay init transition: `-translate-x-full` swapped for `translate-x-full` → `translate-x-0`, 300ms ease-in-out, `z-40` scrim + `z-50` panel)
- [ ] Collapsed **AggregateCardNode** loses its inline expansion entirely — click now dispatches `openClusterBeam(groupId)` via a new narrative context slice
- [ ] **AI summary** per cluster: `POST /api/narrative/cluster-summary` → `{ one_liner, bullets[3-5], dominant_sentiment, notable_tickers[], confidence }` from Hermes/OpenRouter, cheap Haiku-tier model
- [ ] Summary cache: sha1(sorted cardIds) key → in-memory 10-min TTL → Supabase `cluster_summaries` fallback so re-opens are instant
- [ ] **ShockLayer** SVG overlay + new `rope-shock` keyframe (extension of existing `timeline-pulse`) — fires a 4px gold dot along the cluster → narrative-hub edge path on panel open, 600ms
- [ ] Hub "absorb" flash on shock arrival (reuse `agent-border-pulse`)
- [ ] **Timeline scrubber** at top of ClusterBeam — 40px sentiment-colored dot strip for every headline; drag → auto-scroll the card list to that moment
- [ ] **Density meter** ("pressure gauge"): 3-bar sparkline of cards-per-hour over the cluster's lifetime, in the collapsed cluster header (client-side computed, zero backend cost)
- [ ] **Hover-echo**: hovering a card in ClusterBeam pulses the matching cluster node on the canvas (reuse `catalyst-pulse`)
- [ ] **Shock-on-arrival**: when the news-worker writes a new card into a cluster that is currently open on screen, fire the shock pulse hub → cluster and slide the new card row in with `card-enter`
- [ ] Changelog entry + file-header comments on every substantially modified file

## Scope — Excluded (OUT OF BOUNDS)

- Mobile PWA port of ClusterBeam (desktop-first; mobile gets its own brief later)
- RiskFlow card anatomy changes (sacred — see `feedback_riskflow_card_anatomy.md`)
- Cluster _creation_ / clustering algorithm changes — we render whatever `narrative-hierarchy.ts` already produces, we don't re-cluster
- Timeline overlay itself — untouched; we only borrow the init-transition pattern
- Agent-instructions rewrites for Harper/Oracle — cluster summary is a pure service call, not a Harper tool
- RLS policy changes beyond the new `cluster_summaries` table

## Known Issues to Preserve

- `feedback_no_glass_effects.md` — **no** `backdrop-blur`, **no** `box-shadow`, **no** gradients. ClusterBeam uses flat `var(--fintheon-bg)` with a thin `var(--fintheon-accent)/15` left border. Same rule for the scrubber and density meter.
- `feedback_fuses_are_sacred.md` — **do not touch** the fuse-shimmer strip at `AggregateCardNode.tsx:113-124` (the `fuse-shimmer 2s ease-in-out infinite` animation). The collapsed cluster header stays visually identical — only the click handler changes.
- `feedback_send_button_style.md` — not in scope here, but if any button gets added to the panel header (e.g. a close X), use a circular ArrowUp-style affordance pattern, never an airplane/Send icon.
- `feedback_supabase_migration_filenames.md` — migration filename is 14-digit timestamped (`YYYYMMDDHHMMSS_cluster_summaries.sql`). Run `supabase db push` from the linked main worktree. **Never** use Supabase MCP `apply_migration`.
- `feedback_trades_table_migration.md` — not relevant here (no trades-table ALTERs).
- `feedback_launchd_backend_desktop_checkout.md` — `io.solvys.fintheon-backend` reads from `~/Desktop/Codebases/fintheon`, not Documents. After backend changes, rsync to Desktop checkout OR remind TP to sync before expecting localhost hits.
- `feedback_launchd_node_env_development.md` — plist `NODE_ENV=development` only. Don't touch the plist in this sprint.
- `src/lib/changelog.ts` — read the last ~10 entries before committing, per `CLAUDE.md`.

## Design Pass

### Layout / Interaction

**Collapsed cluster node** (already rendered, minor additive change):

- Same 260px width, same label + item count + dateRange + IV score + chevron
- **Additive:** a 3-bar density sparkline under the IV score (micro, 24×10px, tabular-nums Doto)
- **Behavior change:** click now fires `openClusterBeam(groupId)` via context; no local expanded state

**ClusterBeamPanel** (right-docked, 420px wide, full height):

```
┌────────────────────────────────────────────┐
│ ◼ NARRATIVE SLUG (color bar) · 32 items    │  ← header, 48px
│ Mar 18 → Apr 24 · avg IV 6.4               │
├────────────────────────────────────────────┤
│ AI Summary                                  │  ← heading caps
│ ──────────────────────────────              │
│ One-liner in body font, ~2 lines.          │
│ • bullet 1                                  │
│ • bullet 2                                  │
│ • bullet 3                                  │
│ [BULLISH 73%]  NVDA · TSM · AMD             │  ← sentiment chip + tickers
├────────────────────────────────────────────┤
│ ▰▰▰▱▰▰▰▰▱▱▰▰▰▰▰▰▰▰▰▱▰▰▰▰▰▰▰▰▰▰  ← scrubber  │  ← 40px, dots colored by sentiment
│                          ▲ playhead         │
├────────────────────────────────────────────┤
│ [card 1]                                    │
│ [card 2]                                    │  ← scroll region, fills remaining height
│ [card 3]                                    │
│ ...                                         │
└────────────────────────────────────────────┘
```

- **Init transition:** identical to `TimelineOverlay` — panel mounts with `translate-x-full`, flips to `translate-x-0` on open, `transition-transform duration-300 ease-in-out`. Scrim on the left half intercepts outside clicks.
- **Dismissal:** Esc, scrim click, or same-cluster click toggles closed.
- **Summary loading:** 400ms skeleton shimmer on the summary block (reuse RiskFlow skeleton recipe — flat grey block, no shimmer gradient). If the backend streams tokens, render into the one-liner live.
- **Scrubber:** dragging the playhead scrolls the card list via `scrollIntoView({ block: 'nearest' })`. Hover on a dot shows the headline title in a small tooltip. Release of drag returns playhead to top.
- **Card rows:** reuse the existing expanded-card row markup from `AggregateCardNode.tsx:254-375` (title + IV chip + sentiment chip + cyclicality chip + date), but full-width now since the panel is 420px.
- **Hover-echo:** `onMouseEnter` of a card row dispatches `narrative:echo` with `cardId` → the canvas listens and pulses the containing cluster node for 900ms via `catalyst-pulse`.

**ShockLayer overlay:**

- Sibling of React Flow viewport, position absolute, pointer-events none, full size of the canvas
- On `narrative:shock` event (`{ from: clusterNodeId, to: narrativeSlug }`):
  1. Look up the React Flow edge path from cluster → hub (iterate `edges` state, find matching `{source: clusterNodeId, target: hubNodeIdForSlug}`; if React Flow doesn't expose the SVG path ref directly, recompute with the same bezier math React Flow uses, or walk `document.querySelector('[data-id="edge-id"] path')` and grab its `d` attribute)
  2. Animate a `<circle r=4>` along the path using Web Animations API `animate(path, { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })` (or `offsetPath: path('...')` + `offsetDistance: 0→100%` via CSS)
  3. On complete: dispatch `narrative:shock-arrived` with `{ slug }` → hub node briefly `agent-border-pulse`s
  4. Remove the circle from DOM

**Shock-on-arrival:**

- News worker already writes cards. Add a narrow websocket/SSE frame (or poll delta on existing narrative store) that tells the frontend "card X was added to cluster Y".
- If the `ClusterBeamPanel` has `activeClusterId === Y`, fire `narrative:shock` in reverse direction (hub → cluster), then slide the new card into the panel with `card-enter`.
- Non-goal: inventing a new realtime channel. Use whatever narrative store already polls/subscribes.

### API / Service Shape

**Route:** `POST /api/narrative/cluster-summary`

Attaches to a new file `backend-hono/src/routes/narrative/cluster-summary.ts`, registered in `backend-hono/src/boot/routes.ts` (or wherever narrative routes mount — grep first).

**Request (Zod):**

```ts
const RequestSchema = z.object({
  groupId: z.string().min(1),
  cards: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        date: z.string().optional(),
        ivScore: z.number().optional(),
      }),
    )
    .min(1)
    .max(100),
});
```

**Response:**

```ts
const ResponseSchema = z.object({
  one_liner: z.string(),
  bullets: z.array(z.string()).min(2).max(5),
  dominant_sentiment: z.enum(["bullish", "bearish", "mixed"]),
  dominant_sentiment_confidence: z.number().min(0).max(1),
  notable_tickers: z.array(z.string()).max(6),
  cached: z.boolean(),
  ts: z.string(),
});
```

**Service:** `backend-hono/src/services/narrative/cluster-summarizer.ts`

- `async function summarizeCluster(input): Promise<Summary>`
- Hash input: `sha1(sortedCardIds.join(','))`
- Cache hierarchy: in-memory `Map<string, { summary, expiresAt }>` (10-min TTL) → Supabase `cluster_summaries` → Hermes call
- Hermes prompt lives in a sibling file `backend-hono/src/services/ai/agent-instructions/cluster-summarizer.md` (Markdown prompt that includes the card list inline — no agent persona, this is a utility summarizer, not a desk agent)
- Model routing: route through existing Hermes/OpenRouter helper. Prefer the cheapest capable model (Haiku 4.5 via OpenRouter if available, else Sonnet 4.6). Must respect the existing provider-selection util.
- **Fallback behavior when OPENROUTER_API_KEY is missing:** return a deterministic non-AI summary: `one_liner = "{N} items about {narrativeTitle} between {dateStart} and {dateEnd}"`, bullets = top 3 card titles, dominant_sentiment = majority vote, confidence = 0. This honors the "every service works when its env var is missing" rule in `backend-hono/CLAUDE.md`.
- **Fallback when Supabase is missing:** in-memory cache only, no persistence. The service still returns a live summary.
- **Auth:** route is Supabase-JWT enforced (same middleware as other narrative routes). Nothing bypasses auth.
- **Rate limit:** per-user 30 summaries per minute (simple in-memory window; match `browser-harness` style from `harness-tool.ts`).

### Data / Agent Shape

**Table:** `cluster_summaries`

```sql
CREATE TABLE IF NOT EXISTS public.cluster_summaries (
  group_hash       text        PRIMARY KEY,  -- sha1(sorted cardIds)
  group_id         text        NOT NULL,     -- narrative/theme groupId for debugging
  narrative_slug   text,
  summary_json     jsonb       NOT NULL,
  ts               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cluster_summaries_ts_idx
  ON public.cluster_summaries (ts DESC);

-- RLS: read is broad (any authed user gets a warm cache hit),
-- write is service-role only since summaries are produced server-side
ALTER TABLE public.cluster_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY cluster_summaries_read_authed
  ON public.cluster_summaries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY cluster_summaries_write_service
  ON public.cluster_summaries FOR INSERT
  TO service_role
  WITH CHECK (true);
```

Migration filename: `supabase/migrations/20260424180000_cluster_summaries.sql` (14-digit timestamp per `feedback_supabase_migration_filenames.md`). Push via `supabase db push` from the linked main worktree. **Do not** use MCP `apply_migration`.

**Agent ownership:** none — summarizer is a utility service. No persona. No chain-of-thought. Structured output only.

### Aesthetic Rules

- Flat surfaces. `ClusterBeamPanel` background = `var(--fintheon-bg)`. Left border = `1px solid var(--fintheon-accent)/15` (mirrors TimelineOverlay's right border).
- **No** `backdrop-blur`, **no** `box-shadow` on the panel, scrubber, or any new chrome. (`AggregateCardNode`'s existing `boxShadow: '0 4px 24px ${narrativeColor}08'` stays — don't regress it, don't extend it.)
- **No** gradients in new code. The existing fuse-shimmer gradient on the cluster header is sacred and stays.
- **No** colored emojis anywhere. Use `lucide-react` glyphs at opacity ≤ 0.6 if iconography is needed (e.g. Clock for the scrubber, ChevronRight for close — matching TimelineOverlay).
- Typography: heading font for the panel title + "AI Summary" caps header, body font for the one-liner and bullets, mono for tickers + IV + dates + scrubber time labels.
- Accent `#c79f4a` for the shock-pulse dot + the scrubber playhead + the "absorb" hub flash. Shock dot recipe: 4px gold circle, no shadow (we're intentionally _not_ using the `box-shadow: 0 0 8px / 16px` glow from `timeline-line::after` to avoid the glass feel — the pulse reads because it's _moving along the rope_, not because it's blooming).
- Sentiment chips: flat `{color}/15` background, `{color}/80` text, no border-radius above 4px. Match existing RiskFlow card chip aesthetic.

## Development Flow

1. **Data layer**
   - Write migration `supabase/migrations/20260424180000_cluster_summaries.sql` with the table + RLS policies above
   - Run `supabase db push` from the linked main worktree (do NOT use MCP). Verify with `psql` or `supabase db remote commit` (read-only confirm)
   - Add TypeScript type in `backend-hono/src/types/cluster-summary.ts` mirroring the Zod response shape

2. **Service layer** (`backend-hono/src/services/narrative/cluster-summarizer.ts`)
   - `hashCards(cards): string` — sha1 of sorted cardIds
   - `getCachedSummary(hash)` — check in-memory, then Supabase
   - `storeSummary(hash, groupId, narrativeSlug, summary)` — write both caches
   - `summarizeViaHermes(cards, narrativeTitle)` — OpenRouter call with the system prompt
   - `summarizeDeterministic(cards, narrativeTitle)` — the no-key fallback
   - `summarizeCluster(input)` — orchestrator
   - Unit-testable — no framework coupling

3. **Prompt file** (`backend-hono/src/services/ai/agent-instructions/cluster-summarizer.md`)
   - System role: "You summarize a cluster of headlines tied to a single narrative thread. Output JSON matching the schema. No prose, no preamble."
   - Include the response schema in the prompt verbatim (Hermes handles structured output)

4. **API layer** (`backend-hono/src/routes/narrative/cluster-summary.ts`)
   - Hono POST handler, Zod-validate, JWT-guard (reuse existing middleware pattern from other narrative routes), rate-limit, call service, return response
   - Register in `backend-hono/src/boot/routes.ts` (or wherever narrative routes mount — grep for `/api/narrative`)
   - Early-return error handling, happy path last

5. **Frontend data hook** (`frontend/hooks/useClusterSummary.ts`)
   - `useClusterSummary(groupId, cards)` — returns `{ summary, loading, error }`
   - Debounce so rapid cluster clicks don't hammer the endpoint
   - Stale-while-revalidate pattern: show cached summary immediately, refresh silently

6. **Frontend state — narrative context slice**
   - Extend `frontend/contexts/NarrativeContext.tsx` with `activeClusterId: string | null`, `openClusterBeam(id)`, `closeClusterBeam()`
   - Remove the local `expandedGroups` state from `NarrativeForceCanvas.tsx` (lines ~536, 647-654, 783)
   - `AggregateCardNode.tsx` onClick → `openClusterBeam(groupId)` from context

7. **Frontend UI — panel**
   - `frontend/components/narrative/ClusterBeamPanel.tsx` — 420px right dock, `translate-x-full` pattern, scrim, header, summary block, scrubber, card list
   - `frontend/components/narrative/ClusterScrubber.tsx` — 40px dot strip, drag-to-scrub
   - Mount in `frontend/components/narrative/NarrativeForceCanvas.tsx` as a sibling of the `<ReactFlow>` component, not inside the viewport (so panel sits above the canvas, not inside a node)

8. **Frontend UI — effects**
   - `frontend/components/narrative/ShockLayer.tsx` — SVG overlay, listens for `narrative:shock` events on `window`, animates circle along edge path, removes on complete
   - `frontend/index.css` — add `@keyframes rope-shock` (fallback for browsers without WAAPI `animate` on SVG), add `.rope-shock-dot` class, add `.hub-absorb-flash` helper
   - Wire `ClusterBeamPanel` mount → dispatch `narrative:shock`
   - Wire `ClusterBeamPanel` card hover → dispatch `narrative:echo` → canvas listens and applies `catalyst-pulse` to the matching node ref

9. **Frontend UI — additive collapsed-node density meter**
   - `frontend/components/narrative/DensityMeter.tsx` — 3-bar sparkline, computes `cardsPerHour` from `data.cards[].date`, maps to bar heights
   - Add to `AggregateCardNode.tsx` inside the right-column IV block, below the "IV" label, without touching the fuse-shimmer strip

10. **Shock-on-arrival wiring**
    - Find where the narrative store receives fresh cards (grep `narrative-store.ts`, `narrative-seed-loader.ts`)
    - When a card lands with a `groupId` matching `activeClusterId`, dispatch `narrative:shock` in reverse (hub → cluster) and append to the panel's card list with `card-enter`

11. **Validation**
    - `npx tsc --noEmit --project frontend/tsconfig.json` passes
    - `rm -rf dist && npx vite build` passes
    - `cd backend-hono && bun run build` passes
    - Backend restarted from dist (`launchctl unload` + `launchctl load` on the plist)
    - `curl -s http://localhost:8080/api/narrative/cluster-summary -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${TEST_JWT}" -d '{"groupId":"test","cards":[{"id":"a","title":"test headline","sentiment":"bullish"}]}' | jq` returns the full response shape
    - Manual: open a 25+ headline cluster on localhost, verify panel slides in from right, summary populates within 2s, scrubber drags smoothly, close on Esc works, shock fires on open, hover-echo works
    - Fly deploy + re-curl on `https://fintheon.fly.dev/api/narrative/cluster-summary`
    - Per `feedback_backend_restore_to_prod.md`: confirm prod endpoint returns JSON, not 404/HTML, before declaring done

12. **Changelog + headers**
    - `src/lib/changelog.ts` entry: date, agent `claude-code`, summary, files
    - File header `// [claude-code 2026-04-24] S36 ClusterBeam — {one-line description}` on every substantially modified file
    - Commit format: `[v5.24.1] feat: S36 ClusterBeam — right-docked cluster panel, AI summary, shock-circuit, scrubber`

## Acceptance Criteria

- [ ] Clicking any AggregateCardNode opens `ClusterBeamPanel` from the right in 300ms, not the inline expansion
- [ ] AI summary renders within 2s on first open; re-opens feel instant (cache hit)
- [ ] Cluster with 25+ headlines is fully scrollable in the panel's card list, no 400px ceiling
- [ ] Gold shock-pulse travels from the cluster node to the parent narrative hub on panel open, 600ms; hub "absorbs" with a one-shot border pulse
- [ ] Timeline scrubber at the top of the panel drags smoothly and auto-scrolls the card list
- [ ] Hovering a card row in the panel pulses the matching cluster node on the canvas
- [ ] If the news-worker adds a new card to the currently-open cluster, a reverse shock fires hub → cluster and the card slides in at the right insertion point
- [ ] Density-meter sparkline visible on every cluster header, correctly reflects cards-per-hour
- [ ] With `OPENROUTER_API_KEY` unset, the endpoint returns the deterministic fallback summary (not a 500)
- [ ] With Supabase unavailable, the endpoint still returns a live summary (in-memory cache only)
- [ ] RLS: unauthenticated request to `/api/narrative/cluster-summary` is rejected
- [ ] Rate limit: 31st request in a minute from the same user returns 429
- [ ] No `backdrop-blur`, no `box-shadow`, no gradient introduced in any new file
- [ ] Fuse-shimmer on the cluster header is visually identical to pre-change (pixel-compare two screenshots)
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] Live prod endpoint `https://fintheon.fly.dev/api/narrative/cluster-summary` returns valid JSON
- [ ] Changelog entry added to `src/lib/changelog.ts`
- [ ] File headers `// [claude-code 2026-04-24]` added on every substantially modified file

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke the new endpoint (requires TEST_JWT env; bypass if BYPASS_AUTH=true in dev plist)
curl -s -X POST http://localhost:8080/api/narrative/cluster-summary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TEST_JWT}" \
  -d '{"groupId":"test","cards":[{"id":"a","title":"Iran hits Israeli base","sentiment":"bearish","severity":"high"},{"id":"b","title":"Oil +3% on supply fears","sentiment":"bullish"}]}' \
  | jq

# Supabase migration push (from linked main worktree — NOT via MCP)
cd ~/Documents/Codebases/fintheon && supabase db push

# Prod smoke after fly deploy
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/narrative/cluster-summary
```

## Commit Format

```
[v5.24.1] feat: S36 ClusterBeam — right-docked cluster panel, AI summary, shock-circuit, scrubber
```

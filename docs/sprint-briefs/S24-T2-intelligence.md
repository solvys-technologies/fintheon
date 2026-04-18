# Sprint Brief: S24-T2 — RiskFlow V4 Intelligence (Novelty + Narrative-Aware + Walk-Back)

## Context

Three concrete scoring failures diagnosed from live DB on 2026-04-18:

- **Speaker repetition has no filter.** `commentator-service.ts:80–121` `getMultiplierForSpeaker()` returns the same tier multiplier every time. Powell saying "restrictive" for the 50th time scores identically to the 1st. Live evidence: "🔴 Trump on Iran: maybe will not extend ceasefire..." appeared 3x in 1 hour, each time scoring 10 or 7 with zero memory of prior occurrences.
- **Geopolitical sentiment is undirected.** `headline-parser.ts:68–70` groups `invasion|missile|nuclear|strait of hormuz|ceasefire` into one keyword: `"geopolitical escalation"`. Ceasefire (bullish for risk) and invasion (bearish) route identically through `determineSentiment()` at `iv-scorer.ts:451–497`. Live evidence: "Trump: Iran will never have nuclear weapon" (de-escalation, bullish) scored the same as "IRGC attacked 3 commercial ships" (bearish).
- **No walk-back pairing.** When "ceasefire confirmed" hits at 10:00 AM and "ceasefire collapses" hits at 2:00 PM, the engine scores both independently at L10. No pairing, no fading, no auto-revert. Regime gets whipsawed and stays whipsawed.

This track builds the scoring intelligence layer. It depends on T1's migrations (`speaker_utterance_cache`, `classification_matrix`, `lexicon_keywords`) landing first. It does NOT touch the admin UI, DB schema, or `feed-service.ts` L9/L10 gating (T3 owns that).

## Branch Target

`s24-t2-intelligence` — create as a worktree. Wait for T1 to land its migration, then branch off T1's HEAD:

```bash
# After T1 signals "migrations applied":
git fetch origin s24-t1-foundation
git worktree add ../fintheon-s24-t2 -b s24-t2-intelligence s24-t1-foundation
cd ../fintheon-s24-t2
```

If T1 hasn't landed yet, branch off `s20-agent-swarm-platform-ops` and stub the migration dependencies locally (coordinate with T1 instance).

## Scope — Included

### Speaker Novelty Engine (new file)

- `backend-hono/src/services/scoring/speaker-novelty.ts` (<300 lines)
  - `recordUtterance(speaker, headline)` — inserts into `speaker_utterance_cache`
  - `computeNoveltyFactor(speaker, headline): Promise<number>` — returns 0.3 (highly repetitive) → 1.0 (novel). Uses one of:
    - **Preferred**: `embedding` column with pgvector cosine similarity against last 7 days
    - **Fallback**: Jaccard similarity on tokenized `headline_text` (no pgvector dependency)
  - Decay curve: `1.0` if similarity < 0.3 (novel), linear to `0.4` at similarity 0.9, floor `0.3` above.
- Integrate in `iv-scorer.ts` line ~305 where commentator multiplier is currently applied. New computation:
  ```
  effectiveCommentatorBoost = 1 + 0.5 * (commentatorMultiplier - 1) * noveltyFactor
  ```
  (commentator damped 0.5×, further reduced by novelty factor on repeats)

### Narrative-Aware Sentiment (modify existing)

- `backend-hono/src/services/scoring/narrative-sentiment.ts` (new, <200 lines)
  - `interpretSentimentThroughNarratives(parsed, activeNarratives): "bullish" | "bearish" | "neutral"`
  - Reads `active_narratives` table (already exists per diagnosis)
  - Applies rules: if speaker statement references an active narrative, use that narrative's current stance to tint sentiment.
  - Example: speaker says "rate cuts appropriate". If `price_stability` and `max_employment` narratives both have `stance='bearish'`, rate cuts are interpreted bearish (cutting amid a breakdown). If narratives are bullish, rate cuts are bullish.
  - Fall back to existing `determineSentiment()` if no narrative match.
- Edit `iv-scorer.ts:451–497` `determineSentiment()` — wrap existing logic. Before the existing keyword passes, check narrative-aware interpretation for speaker-attributed events.

### Geopolitical Sentiment Lexicon (modify `headline-parser.ts`)

- Split the `geopolitical escalation` regex at `headline-parser.ts:68–70` into directional patterns:
  - `bullishRisk`: `ceasefire confirmed|agreement signed|de-escalation|reopens|halted|withdrawal`
  - `bearishRisk`: `attack|strike|blockade|escalation|missile|invasion|seized`
  - `neutralRisk`: `talks|negotiations|warning|threat|may|maybe|considering`
- Emit distinct eventTypes (`geopoliticalBullish`, `geopoliticalBearish`, `geopoliticalNeutral`) that `determineSentiment()` reads directly.

### Walk-Back Pairer (new file, real-time)

- `backend-hono/src/services/scoring/walk-back-pairer.ts` (<250 lines)
  - `detectWalkBack(newItem: FeedItem): Promise<{pairsWith: string | null; action: 'fade' | 'ignore'}>`
  - When a new item scores L9/L10 (matrix-flip candidate), scan last 24h of L9/L10 items for semantic opposition:
    - Match on shared tickers/narratives (same narrative thread)
    - Opposite sentiment on the same subject (e.g. "ceasefire confirmed" → bullish, "ceasefire collapses" → bearish, both tagged `geopolitical`)
    - Hash or embedding proximity on subject (but opposite direction)
  - If matched: return `pairsWith=originalId`, `action='fade'`. Caller fades the original item's score by 0.5× and flips the regime back via `proposeRegimeChange()` with `proposed_by='walk-back-pairer'`, severity `critical` (bypasses quiet hours).
- Wire into `central-scorer.ts` after the new L9/L10 item is scored, before push emit. Real-time — do not wait for maintenance cycle.

### Lexicon Proposer (new routine)

- `backend-hono/src/services/scoring/lexicon-proposer.ts` (<250 lines)
  - Scheduled via the 2-hour monitoring cron (T4 will wire the cron; this file just exports the function).
  - `proposeLexiconUpdates()`:
    1. Reads last-24h scored items tagged `geopolitical` or `commentator`
    2. Identifies clusters of repeated phrases not yet in `lexicon_keywords`
    3. For each cluster, infers sentiment (bullish/bearish/neutral) via narrative check
    4. Creates a row in `lexicon_proposals` with evidence (top 5 matching headlines)
    5. Fires `emitPushAndLog` with category `lexiconProposals`, severity `medium` (digest-friendly)

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/notifications/*` — T1 owns emit + categories
- `backend-hono/src/routes/regime/*`, `lexicon/*`, `classification-matrix/*` — T1 owns
- `backend-hono/src/services/brief-generator.ts` — T1 owns the regime-lock edit
- `backend-hono/src/services/riskflow/feed-service.ts` `assignMacroLevel()` — T3 owns the L9/L10 gate
- Rescore-all job — T3 owns
- All frontend/mobile UI — T4 owns
- `supabase/migrations/20260419_v4_foundation.sql` — T1 owns
- Classification matrix route handlers — T1 owns

## Known Issues to Preserve

- `iv-scorer.ts` is the **V3 regime-aware scorer**. Preserve all existing behavior behind `process.env.SCORING_V4 === 'true'` feature flag. V3 path must remain callable for rollback.
- `MAJOR_MACRO_PRINTS` list at `iv-scorer.ts` — do not modify (T3 owns scarcity gate integration).
- Commentator-service cache has 5-min TTL. When you bump tiers during T2 dev, wait 5 minutes or call `clearRegistryCache()` to see effects.

## Implementation Steps

1. Wait for T1 migrations. Verify `speaker_utterance_cache`, `active_narratives`, `classification_matrix`, `lexicon_keywords`, `lexicon_proposals` exist.
2. Build `speaker-novelty.ts` with pgvector-or-fallback similarity. Add unit sanity script at `backend-hono/scripts/novelty-sanity.ts` — feed 3 near-dupe Trump headlines, assert factors descend 1.0 → 0.4 → 0.3.
3. Build `narrative-sentiment.ts`. Test against a stub active narrative row.
4. Modify `headline-parser.ts:68–70` — split geopolitical into 3 directional patterns. Add unit tests if jest/vitest is configured; otherwise inline asserts.
5. Wrap `iv-scorer.ts:calculateIVScore` behind `SCORING_V4` env flag. V4 path calls novelty + narrative-aware sentiment. V3 path unchanged.
6. Build `walk-back-pairer.ts`. Integrate into `central-scorer.ts:386-395` (after scoring, before push).
7. Build `lexicon-proposer.ts`. Export the function; T4 wires the cron.
8. Changelog entry per commit.

## Acceptance Criteria

- [ ] Running `SCORING_V4=true` re-scores the same Trump-repeat headline 3 times with descending scores (novelty factor applied).
- [ ] "Ceasefire confirmed" and "Missile strike launched" — both `eventType=geopolitical` — score with opposite `sentiment` fields.
- [ ] A synthetic L10 "ceasefire confirmed" followed 10 min later by a synthetic L10 "ceasefire collapses" — pairer detects, fades original, fires a `walkBackReverts` push.
- [ ] `SCORING_V4=false` produces byte-identical output to current V3 scoring. Feature flag must be clean.
- [ ] `lexicon-proposer.ts` when run manually (`bun run scripts/run-lexicon-proposer.ts` or equivalent) inserts at least one row into `lexicon_proposals` given the current FJ feed state.
- [ ] No direct writes to `market_regimes` — all regime flips via `proposeRegimeChange()` from T1.

## Validation Commands

```bash
# Backend type check + build
cd backend-hono && bun run build

# Restart local
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# V4 scoring sanity
SCORING_V4=true bun run backend-hono/scripts/novelty-sanity.ts

# V3 regression — V4 flag off, compare diagnostic output
SCORING_V4=false curl -s http://localhost:8080/api/riskflow/feed | head -c 1000

# Walk-back smoke (requires synthetic L10 injection helper)
bun run backend-hono/scripts/walk-back-sanity.ts

# Frontend unaffected
npx tsc --noEmit --project frontend/tsconfig.json
```

## Commit Format

```
[v.04.19.T2] feat: S24-T2 {component}: {description}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

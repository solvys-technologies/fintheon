# S7-T2: Narrative Reclassification + Seed Event Rewrite

## Context
The NarrativeFlow seed data currently has placeholder narrative categories (geopolitical, monetary, macroeconomic, etc.) that don't match the real-world narrative threads TP tracks. This track reclassifies all 612 seed events into the 10 real narrative threads defined in the `narrative_threads` Supabase table (migration 027).

## Prerequisites
- Migration 027 (`narrative_threads` + `narrative_card_links`) must be applied to Supabase
- Backend running on port 8080

## Files to Read First
- `frontend/data/narrative-seed-events.json` — the 612 seed events to reclassify
- `backend-hono/migrations/027_narrative_threads.sql` — the 10 narrative thread definitions with keyword patterns
- `frontend/lib/narrative-seed-loader.ts` — how seed events get loaded
- `frontend/lib/narrative-types.ts` — CatalystCard type definition

## Task: Reclassify Seed Events

### 1. Write a classification script
Create `backend-hono/scripts/reclassify-seeds.ts` that:
- Reads `frontend/data/narrative-seed-events.json`
- For each event, matches its title + description + tags against the `keywords` array of each narrative thread
- Assigns the event a `narrative` field (the thread slug) based on best match
- Events can match multiple narratives — pick the strongest match as primary `narrative`, store others in `narrativeThreads: string[]`
- Writes the updated JSON back to `narrative-seed-events.json`

### 2. Keyword matching rules (from migration 027)
```
middle-east-conflict: iran, israel, houthi, hezbollah, middle east, gaza, lebanon, syria, yemen, red sea, strait of hormuz
liquidity-credit-contraction: liquidity, credit, blue owl, lending, tightening, spread, high yield, default, bankruptcy
ai-singularity: ai, artificial intelligence, anthropic, openai, nvidia, gpu, semiconductor, chip, claude, gpt, deepseek
usd-jpy-carry-trade: yen, jpy, boj, bank of japan, carry trade, ueda, usdjpy, japan
trade-war: tariff, trade war, liberation day, reciprocal, import tax, retaliation
us-china-relations: china, beijing, xi jinping, cnh, yuan, pboc, delegation, huawei, tiktok, chip ban, smic
rate-cut-cycle: rate cut, traders price in, cuts priced, basis points, recession, fed cut, powell, fomc, dovish, warsh
trump-presidency: trump, white house, executive order, maga, bessent, lutnick, vance, doge, musk
price-stability: cpi, ppi, pce, inflation, deflation, disinflation, price stability, consumer price, producer price
maximum-employment: nfp, jobs, unemployment, payroll, jobless claims, labor, employment, hiring, layoff, jolts
```

### 3. Update the CatalystCard type
In `frontend/lib/narrative-types.ts`, ensure `CatalystCard` has:
```typescript
narrativeThreads?: string[]; // slugs from narrative_threads table
```

### 4. Update the seed loader
In `frontend/lib/narrative-seed-loader.ts`, map `e.narrativeThreads` through to the CatalystCard.

### 5. Bump seed version
Change `SEED_FLAG` from `v4` to `v5` so existing users re-seed.

## Verification
- Run: `bun run backend-hono/scripts/reclassify-seeds.ts`
- Check: Every event in the JSON has a non-empty `narrative` field
- Check: `narrativeThreads` array has 1-3 entries per event
- Check: `npx vite build` passes

## DO NOT
- Modify the React Flow canvas (NarrativeForceCanvas.tsx) — that's a separate track
- Modify the ConsiliumHub tab structure
- Touch backend routes or services
- Add any new frontend components

## Changelog
```
[v.8.25.4] chore(narrative): reclassify 612 seed events into 10 real narrative threads
```

# Sprint Brief: T2 — X Account Monitor with Chart Image Extraction

## Context

Monitor specific X/Twitter accounts for the Agent Lounge research pipeline. Target accounts: @infraa, @monetaryguy589, @macroedgeres. These accounts frequently post macro charts and analysis. The service must pull posts since last check and extract/analyze chart images (using vision model or OCR). This is critical infrastructure — without it, the lounge misses a key intelligence source.

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/x-monitor/types.ts` [NEW] — Post, ImageAnalysis, MonitorResult types
- [ ] `backend-hono/src/services/x-monitor/scraper.ts` [NEW] — X post scraping logic
- [ ] `backend-hono/src/services/x-monitor/image-analyzer.ts` [NEW] — Chart image analysis via vision model
- [ ] `backend-hono/src/services/x-monitor/accounts.ts` [NEW] — Account definitions and state tracking
- [ ] `backend-hono/src/services/x-monitor/index.ts` [NEW] — Service export
- [ ] `backend-hono/src/routes/x-monitor/` [NEW] — API endpoints

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/youtube-transcripts/` — owned by T1
- `backend-hono/src/services/lounge/` — owned by T4
- `backend-hono/src/services/hermes/` — owned by T3

## Reuse Inventory

- `backend-hono/src/services/commentary/` — existing Exa-powered X scraper, pattern to follow
- `backend-hono/src/services/xactions/` — self-hostable Puppeteer X scraper (Fly.io deployment)
- `backend-hono/src/services/ai/` — AI provider abstraction for vision model calls
- `backend-hono/src/services/riskflow/feed-service.ts` — caching pattern
- `TwitterCli` service — existing but being phased out, reference for account handling

## Known Issues to Preserve

- X has aggressive rate limiting — use existing xactions service or Exa commentary scraper
- Image analysis requires a vision-capable model (GPT-4o, Claude, or Gemini vision)
- @macroedgeres posts often include charts — image extraction is critical, not optional
- Follow Solvys constraints: no emojis, no banned ornaments
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/x-monitor/types.ts`:
   - `MonitoredAccount`: handle, displayName, lastChecked, enabled
   - `XPost`: id, accountHandle, text, timestamp, mediaUrls (array), hasImage, likes, retweets
   - `ImageAnalysis`: imageUrl, extractedText, chartType, keyInsights, confidence
   - `MonitorResult`: account, posts (array), newPostsCount, imagesAnalyzed

2. Create `backend-hono/src/services/x-monitor/accounts.ts`:
   - Define target accounts: @infraa, @monetaryguy589, @macroedgeres
   - Track lastChecked timestamp per account (in-memory, persisted to Supabase later)
   - Function to get accounts needing refresh

3. Create `backend-hono/src/services/x-monitor/scraper.ts`:
   - Use existing `xactions` service or `commentary` Exa scraper as the data source
   - Pull posts since `lastChecked` for each monitored account
   - Extract media URLs from posts
   - Return structured `XPost[]` with metadata
   - Handle rate limits with exponential backoff

4. Create `backend-hono/src/services/x-monitor/image-analyzer.ts`:
   - For each post with images, call vision model (use existing AI provider abstraction)
   - Prompt: "Analyze this financial chart. Extract: chart type, key data points, trend direction, notable levels, and any text/labels visible."
   - Return `ImageAnalysis` with extracted insights
   - Cache image analysis results (same image doesn't need re-analysis)

5. Create `backend-hono/src/services/x-monitor/index.ts`:
   - Export `monitorAccounts(since?)` function
   - Export `analyzePostImages(posts)` function
   - Export account definitions

6. Create `backend-hono/src/routes/x-monitor/index.ts`:
   - `GET /api/x-monitor/posts?account=all` — Fetch all monitored posts
   - `GET /api/x-monitor/posts?account=infraa` — Fetch specific account
   - `GET /api/x-monitor/accounts` — List monitored accounts
   - `POST /api/x-monitor/refresh` — Force refresh all accounts

## Acceptance Criteria

- [ ] Posts pulled from all 3 target accounts since last check
- [ ] Image URLs extracted from posts correctly
- [ ] Chart images analyzed with vision model, insights extracted
- [ ] LastChecked state persisted between calls
- [ ] Rate limiting handled gracefully
- [ ] API endpoints return valid JSON
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Smoke test
curl -s http://localhost:8080/api/x-monitor/accounts | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T2 x account monitor with chart image extraction
```

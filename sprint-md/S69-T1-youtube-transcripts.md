# Sprint Brief: T1 — YouTube Transcript Ingestion Service

## Context

Build a service that pulls transcripts from specific YouTube channels for the Agent Lounge research pipeline. Target channels: Bloomberg Originals, Bravos Research, Maxinomics. Transcripts are digested by Herald into structured briefs for agent deliberation.

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/youtube-transcripts/types.ts` [NEW] — Transcript, Video, Channel types
- [ ] `backend-hono/src/services/youtube-transcripts/fetcher.ts` [NEW] — Transcript fetching logic
- [ ] `backend-hono/src/services/youtube-transcripts/channels.ts` [NEW] — Channel definitions and video discovery
- [ ] `backend-hono/src/services/youtube-transcripts/index.ts` [NEW] — Service export
- [ ] `backend-hono/src/routes/youtube/` [NEW] — API endpoints for transcript access

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/lounge/` — owned by T4
- `backend-hono/src/services/x-monitor/` — owned by T2
- `backend-hono/src/services/hermes/` — owned by T3 (model scout)

## Reuse Inventory

- `backend-hono/src/services/fiscal-sources/` — pattern for external data source services
- `backend-hono/src/services/commentary/` — Exa-powered X scraper, pattern for external content ingestion
- `backend-hono/src/services/riskflow/feed-service.ts` — pattern for cached data service
- `backend-hono/src/services/narrative/cluster-summarizer.ts` — LLM-powered summarization pattern

## Known Issues to Preserve

- YouTube has no official free transcript API — use `youtube-transcript` npm package or similar
- Rate limits apply — cache transcripts, don't re-fetch on every lounge cycle
- Follow Solvys constraints: no emojis, no banned ornaments
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/youtube-transcripts/types.ts`:
   - `Channel`: id, name, youtubeChannelId, url, lastChecked
   - `Video`: id, channelId, title, publishedAt, duration, transcriptText, transcriptSegments (with timestamps)
   - `TranscriptResult`: channel, videos (array), fetchedAt, error

2. Create `backend-hono/src/services/youtube-transcripts/channels.ts`:
   - Define target channels: Bloomberg Originals, Bravos Research, Maxinomics
   - Store YouTube channel IDs or URLs
   - Function to discover recent videos (last N days or since last check)

3. Create `backend-hono/src/services/youtube-transcripts/fetcher.ts`:
   - Use `youtube-transcript` npm package (or equivalent) to fetch transcripts
   - Handle errors: no transcript available, rate limited, video unavailable
   - Return structured transcript with timestamps
   - Cache results in-memory with TTL (30 min)

4. Create `backend-hono/src/services/youtube-transcripts/index.ts`:
   - Export `fetchChannelTranscripts(channelId, since?)` function
   - Export `fetchAllTargetChannels(since?)` function
   - Export channel definitions

5. Create `backend-hono/src/routes/youtube/index.ts`:
   - `GET /api/youtube/transcripts?channel=all` — Fetch all channel transcripts
   - `GET /api/youtube/transcripts?channel=bloomberg` — Fetch specific channel
   - `GET /api/youtube/channels` — List monitored channels

6. Add `youtube-transcript` dependency to `backend-hono/package.json`

## Acceptance Criteria

- [ ] Transcripts fetched from all 3 target channels
- [ ] Transcript text includes timestamps/segments
- [ ] Graceful handling when transcript unavailable (video has no captions)
- [ ] In-memory caching prevents redundant fetches
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
curl -s http://localhost:8080/api/youtube/channels | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T1 youtube transcript ingestion service
```

# S14-T3: Feed Pipeline Hardening — Force Refresh + Source Polling

## Goal

Every force refresh polls ALL non-Twitter scrapers. X polling runs without interruption. Agent Reach fires aggressively when rate limited. Per-user X auth tokens via OAuth.

## Current State

- Feed pipeline works but goes stale (16+ hours old items) due to Rettiwt rate limiting
- Agent Reach exists as fallback but only fires after Rettiwt returns 0 items
- `feed-health.log` shows `rateLimited=True` for hours with no new items flowing
- No per-user token rotation — single hardcoded Rettiwt auth token

## What to Do

1. **Force refresh fires ALL scrapers every time**:
   - @backend-hono/src/services/riskflow/feed-poller.ts — on manual refresh, always trigger Agent Reach scraping alongside Rettiwt (not just as fallback). Hit: FinancialJuice, ZeroHedge, Reuters, CNBC, WSJ, MacENews
   - @backend-hono/src/routes/riskflow/handlers.ts — refresh handler must trigger all scrapers, not just Rettiwt

2. **Agent Reach fires aggressively**:
   - @backend-hono/src/services/agent-reach-service.ts — already built and wired. Make it fire on EVERY poll cycle when Rettiwt is rate limited, not just after consecutive empty polls
   - @backend-hono/src/services/riskflow/econ-rettiwt-poller.ts — if rate limited, reduce interval but never stop polling

3. **Reduce cache staleness**:
   - @backend-hono/src/services/riskflow/feed-service.ts:146 — reduce CACHE_REFRESH_INTERVAL_MS from 120s to 30s

4. **Per-user X auth tokens**:
   - @backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts — extend to pull tokens from team_members table instead of hardcoded list
   - @frontend/components/team/TeamOnboarding.tsx — add X OAuth step: auto-open CLI terminal script to login, token captured automatically
   - Auto-enroll active users into polling rotation queue
   - Token also editable in Settings

## Key Context

- @backend-hono/src/services/riskflow/feed-poller.ts — main polling engine, runs every 60-180s
- @backend-hono/src/services/riskflow/commentary-scraper.ts — scrapes commentary/analysis
- @.claude/feed-health.log — health log showing rate limiting pattern

## Verify

- Hit force refresh, confirm items from multiple non-Twitter sources appear within 30s
- Check feed-health.log shows `rateLimited=True` but fresh items still flowing via Agent Reach
- New user onboarding includes X OAuth step

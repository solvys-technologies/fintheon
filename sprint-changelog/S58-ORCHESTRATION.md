# S58 Orchestration — DeepSeek Primary Provider Migration

**Sprint:** S58
**Date:** 2026-05-03
**Branch:** `s58-deepseek-primary` (shared)
**Tracks:** 3 (2 parallel + 1 sequential)
**Breakage tolerance:** Agent personas & tool access must not regress. Everything else is fair game for refactor.
**Model naming:** Use the existing app model name `deepseek-reasoner` for DeepSeek v4 Pro.
**User chat provider options:** `DeepSeek (Direct)` and `DeepSeek (OC API)`.

## Track Summary

| Track | Title | Complexity | Est. Files | Depends On |
|-------|-------|-----------|------------|------------|
| T1 | Backend Provider Pipeline + API Key Infrastructure | High | ~14 files | None |
| T2 | Client SDK + Frontend Chat Overhaul | High | ~12 files | T1 |
| T3 | Unification & Cross-Platform Validation | Medium | merge-only | T1, T2 |

## Wave 1 — T1 solo (backend must land first)

T1 creates the API key endpoints and Supabase migration that T2 depends on. T2 cannot start until:
- `POST/GET/DELETE /api/settings/ai-keys` routes exist
- `user_api_keys` table migration is created
- The backend build passes
- The OpenCode Go/Hermes API settings contract is defined for `DeepSeek (OC API)`

T1 runs solo first. Once the backend is built and the API key endpoints are verified working (even if the full provider pipeline isn't done yet), T2 can start.

## Wave 2 — T2 (after T1's API key endpoints land)

T2 builds the client SDK and updates chat surfaces. Uses T1's endpoints to fetch/store API keys.

## Wave 3 — T3 unification (after T1 + T2)

T3 merges, resolves conflicts, runs full validation suite.

## Execution Sequence

### Wave 1 (T1 only)

```
@sprint-md/S58-T1-backend-pipeline.md
```

### Wave 2 (after T1 API key endpoints are working)

```
@sprint-md/S58-T2-client-sdk.md
```

### Wave 3 (after T1 + T2)

```
@sprint-md/S58-T3-unify.md
```

## Conflict Prevention

- **No file overlap between T1 and T2.** T1 owns `backend-hono/` and `supabase/`. T2 owns `frontend/`, `mobile/`, `electron/`.
- **Shared files** (only `src/lib/changelog.ts`): both tracks will add entries. T3 resolves the merge.
- **T1's API contract** must be stable before T2 starts. The route paths and response shapes in T1's brief are the spec T2 codes against.

## Post-Sprint

After T3 validation passes, run `/solvys-deploy` to ship to all 3 targets (Fly.io backend, Vercel desktop, Vercel mobile).

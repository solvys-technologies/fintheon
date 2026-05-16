# Sprint Brief: T3 — Free LLM Model Scout for Hermes

## Context

Search for new free-to-use LLM models that can be added to Hermes for promotional use. This is a lighter track (3 pts) that runs alongside T1 and T2. The scout checks HuggingFace, GitHub, and provider APIs for newly released open-weight or free-tier models, assesses their capabilities, licensing, and compatibility with the existing Hermes runtime.

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/lounge/model-scout.ts` [NEW] — Model discovery and assessment
- [ ] `backend-hono/src/services/lounge/model-types.ts` [NEW] — ModelCard, Assessment types
- [ ] `backend-hono/src/routes/lounge/models.ts` [NEW] — API endpoints for model listings

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/hermes/runtime.ts` — do not modify runtime yet, only scout
- `backend-hono/src/services/ai/` — provider abstraction, leave alone
- `backend-hono/src/services/youtube-transcripts/` — owned by T1
- `backend-hono/src/services/x-monitor/` — owned by T2

## Reuse Inventory

- `backend-hono/src/services/ai/agent-factory.ts` — existing provider/model configuration
- `backend-hono/src/services/ai/provider.ts` — provider abstraction layer
- `strands/agent-factory.ts` — agent instantiation with provider selection
- `backend-hono/src/services/riskflow/feed-service.ts` — caching pattern

## Known Issues to Preserve

- Hermes currently uses: DeepSeek direct, DeepSeek OC API, Nous Research (Hermes-4 405B/70B), Grok 4.20, Ollama fallback
- "Free for promotional use" means: open-weight, free tier with generous limits, or completely free API
- Do not modify existing provider config — only scout and report
- Follow Solvys constraints: no emojis, no banned ornaments

## Implementation Steps

1. Create `backend-hono/src/services/lounge/model-types.ts`:
   - `ModelCard`: name, provider, parameters, contextLength, license, costTier, capabilities, releaseDate, huggingFaceUrl
   - `Assessment`: modelCard, compatibilityScore, recommendedUse, risks, notes

2. Create `backend-hono/src/services/lounge/model-scout.ts`:
   - `scoutModels()`: checks multiple sources for new free models
   - Sources to check:
     - HuggingFace trending/open models API
     - GitHub repos with "LLM" + "open-weight" + recent activity
     - Known provider release pages (DeepSeek, Nous, Groq, Together, OpenRouter)
   - `assessModel(modelCard)`: evaluates compatibility with Hermes runtime
     - Check if provider API matches existing patterns
     - Assess context length, capabilities, licensing
     - Return compatibility score (0-1) and recommended use case
   - Cache results with 6-hour TTL (model landscape doesn't change hourly)

3. Create `backend-hono/src/routes/lounge/models.ts`:
   - `GET /api/lounge/models/scout` — Run fresh model scout
   - `GET /api/lounge/models/recommendations` — Get cached recommendations
   - `GET /api/lounge/models/assessments` — Get compatibility assessments

4. Add to `backend-hono/src/routes/lounge/index.ts` (created by T4, but register here if T4 hasn't landed yet — coordinate with T4)

## Acceptance Criteria

- [ ] Model scout checks at least 3 sources (HuggingFace, GitHub, provider pages)
- [ ] Returns structured model cards with licensing and capabilities
- [ ] Compatibility assessment scores models against Hermes runtime
- [ ] Results cached with appropriate TTL
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
curl -s http://localhost:8080/api/lounge/models/recommendations | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T3 free llm model scout for hermes
```

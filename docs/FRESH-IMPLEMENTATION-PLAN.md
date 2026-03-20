# Pulse v3.0 Fresh Implementation Plan
## Clean Slate Backend Rebuild

> **Created**: 2026-01-10
> **Status**: Active
> **Domain**: `app.pricedinresearch.io`
> **Backend**: `pulse-api-withered-dust-1394.fly.dev`

---

## Executive Summary

This plan strips the existing backend of bloated/broken code and rebuilds with:
- **300-line maximum per file** (non-negotiable)
- **AI-agent-friendly file structure**
- **Phased delivery** with working deployments at each phase
- **Test-driven approach** - verify before moving forward

---

## Current State Assessment

### ✅ What Works
- Fly.io deployment pipeline
- Neon PostgreSQL connection
- CORS configuration (including `app.pricedinresearch.io`)
- Basic health endpoint
- Clerk auth middleware (needs testing)

### ❌ What's Broken/Missing
- `/api/account` - 404 Not Found
- `/api/market/vix` - 404 Not Found
- `/api/notifications` - 404 Not Found
- `/api/projectx/accounts` - 404 Not Found
- `/api/trading/*` - 404 Not Found
- `/api/riskflow/*` - 404 Not Found
- AI services have files > 600 lines (violates rules)

### 🔴 Files Violating 300-Line Rule
| File | Lines | Action |
|------|-------|--------|
| `ai-model-service.ts` | 622 | Strip & rebuild |
| `chat-service.ts` | 459 | Strip & rebuild |
| `provider-health.ts` | 392 | Strip & rebuild |
| `ai-cost-tracker.ts` | 345 | Strip & rebuild |
| `conversation-manager.ts` | 312 | Split |

---

## Target File Structure

```
backend-hono/src/
├── index.ts                          # App bootstrap (< 100 lines)
│
├── config/
│   ├── cors.ts                       # CORS settings (< 50 lines)
│   ├── database.ts                   # DB connection (< 50 lines)
│   └── env.ts                        # Environment validation (< 50 lines)
│
├── middleware/
│   ├── auth.ts                       # Clerk JWT verification (< 80 lines)
│   ├── error-handler.ts              # Global error handling (< 60 lines)
│   └── rate-limit.ts                 # Rate limiting (< 80 lines)
│
├── routes/
│   ├── index.ts                      # Route aggregation (< 50 lines)
│   │
│   ├── account/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   ├── handlers.ts               # GET/POST/PATCH handlers (< 200 lines)
│   │   └── schemas.ts                # Zod validation (< 80 lines)
│   │
│   ├── market/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   └── handlers.ts               # VIX, quotes handlers (< 150 lines)
│   │
│   ├── notifications/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   └── handlers.ts               # List, mark read (< 100 lines)
│   │
│   ├── projectx/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   ├── handlers.ts               # Account sync handlers (< 150 lines)
│   │   └── schemas.ts                # Validation (< 50 lines)
│   │
│   ├── trading/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   ├── handlers.ts               # Positions, orders (< 200 lines)
│   │   └── schemas.ts                # Validation (< 80 lines)
│   │
│   ├── riskflow/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   ├── handlers.ts               # Feed, watchlist (< 200 lines)
│   │   └── schemas.ts                # Validation (< 80 lines)
│   │
│   ├── ai/
│   │   ├── index.ts                  # Route registration (< 50 lines)
│   │   ├── handlers/
│   │   │   ├── chat.ts               # Chat handler (< 150 lines)
│   │   │   ├── conversations.ts      # Conversation CRUD (< 150 lines)
│   │   │   └── analysis.ts           # Quick analysis (< 150 lines)
│   │   └── schemas.ts                # Validation (< 80 lines)
│   │
│   └── psych/
│       ├── index.ts                  # Route registration (< 50 lines)
│       └── handlers.ts               # Profile handlers (< 150 lines)
│
├── services/
│   ├── account-service.ts            # Account CRUD (< 200 lines)
│   ├── market-service.ts             # VIX fetching (< 150 lines)
│   ├── notification-service.ts       # Notifications (< 150 lines)
│   │
│   ├── projectx/
│   │   ├── client.ts                 # API client (< 200 lines)
│   │   └── auth.ts                   # Token management (< 100 lines)
│   │
│   ├── riskflow/
│   │   ├── feed-service.ts           # Feed aggregation (< 200 lines)
│   │   ├── x-client.ts               # X API client (< 150 lines)
│   │   └── watchlist-service.ts      # User watchlists (< 100 lines)
│   │
│   ├── ai/
│   │   ├── model-selector.ts         # Model routing (< 150 lines)
│   │   ├── streaming.ts              # Stream handling (< 100 lines)
│   │   ├── context-builder.ts        # Context prep (< 150 lines)
│   │   └── conversation-store.ts     # Conversation CRUD (< 150 lines)
│   │
│   ├── analysis/
│   │   ├── grok-analyzer.ts          # Grok news analysis (< 200 lines)
│   │   ├── iv-scorer.ts              # IV impact scoring (< 150 lines)
│   │   └── headline-parser.ts        # Parse headlines (< 150 lines)
│   │
│   └── health-service.ts             # Health checks (< 100 lines)
│
├── db/
│   ├── index.ts                      # Connection pool (< 80 lines)
│   └── queries/
│       ├── account.ts                # Account queries (< 100 lines)
│       ├── conversations.ts          # AI conversation queries (< 100 lines)
│       ├── news.ts                   # News article queries (< 100 lines)
│       └── notifications.ts          # Notification queries (< 80 lines)
│
├── types/
│   ├── account.ts                    # Account types (< 80 lines)
│   ├── ai.ts                         # AI types (< 100 lines)
│   ├── news.ts                       # News/RiskFlow types (< 100 lines)
│   ├── projectx.ts                   # ProjectX types (< 80 lines)
│   └── trading.ts                    # Trading types (< 80 lines)
│
└── utils/
    ├── response.ts                   # Standard responses (< 50 lines)
    ├── validators.ts                 # Common validators (< 80 lines)
    └── logger.ts                     # Logging utility (< 50 lines)
```

**Total files: ~45 | Average lines: ~100 | Max lines: 200**

---

## Phase Breakdown

### Phase 1: Foundation (Days 1-3)
**Goal**: Core infrastructure that everything else depends on

#### Day 1: Strip & Scaffold
- [ ] Delete all files in `routes/` (except keep `psych-assist.ts` as reference)
- [ ] Delete violating files in `services/` (> 300 lines)
- [ ] Create new folder structure per target above
- [ ] Create `config/` files (cors, database, env)
- [ ] Update `index.ts` to new modular structure

#### Day 2: Account Routes
- [ ] Create `routes/account/index.ts`
- [ ] Create `routes/account/handlers.ts`:
  - `GET /api/account` - Get current user account
  - `POST /api/account` - Create account
  - `PATCH /api/account/settings` - Update settings
  - `GET /api/account/tier` - Get user tier
  - `POST /api/account/select-tier` - Select tier
- [ ] Create `services/account-service.ts`
- [ ] Create `db/queries/account.ts`
- [ ] Test all endpoints locally

#### Day 3: Deploy & Verify Foundation
- [ ] Run `npx tsc` - fix any TypeScript errors
- [ ] Deploy to Fly.io
- [ ] Verify endpoints work from `app.pricedinresearch.io`:
  ```bash
  curl https://pulse-api-withered-dust-1394.fly.dev/api/account
  ```
- [ ] Commit: `[v.5.10.1] feat: Phase 1 - Account routes foundation`

**Phase 1 Deliverables**:
- ✅ `/api/account` - 200 OK
- ✅ `/api/account/tier` - 200 OK
- ✅ `/health` - 200 OK

---

### Phase 2: Core Data Routes (Days 4-6)
**Goal**: Market data, notifications, basic trading

#### Day 4: Market Routes
- [ ] Create `routes/market/index.ts`
- [ ] Create `routes/market/handlers.ts`:
  - `GET /api/market/vix` - Get current VIX
  - `GET /api/market/quotes/:symbol` - Get quote (future)
- [ ] Create `services/market-service.ts` (fetch VIX from external API or mock)
- [ ] Test VIX endpoint

#### Day 5: Notifications Routes
- [ ] Create `routes/notifications/index.ts`
- [ ] Create `routes/notifications/handlers.ts`:
  - `GET /api/notifications` - List user notifications
  - `POST /api/notifications/:id/read` - Mark as read
- [ ] Create `services/notification-service.ts`
- [ ] Create `db/queries/notifications.ts`

#### Day 6: Trading Routes (Basic)
- [ ] Create `routes/trading/index.ts`
- [ ] Create `routes/trading/handlers.ts`:
  - `GET /api/trading/positions` - List positions
  - `POST /api/trading/toggle-algo` - Toggle algo (stub)
- [ ] Deploy & verify all Phase 2 endpoints
- [ ] Commit: `[v.5.10.2] feat: Phase 2 - Market, Notifications, Trading routes`

**Phase 2 Deliverables**:
- ✅ `/api/market/vix` - 200 OK
- ✅ `/api/notifications` - 200 OK
- ✅ `/api/trading/positions` - 200 OK

---

### Phase 3: ProjectX Integration (Days 7-9)
**Goal**: Connect to TopStepX for real account data

#### Day 7: ProjectX Client
- [ ] Create `services/projectx/client.ts`:
  - Token authentication
  - Account fetching
  - Error handling
- [ ] Create `services/projectx/auth.ts`:
  - Token refresh logic
  - Credential storage

#### Day 8: ProjectX Routes
- [ ] Create `routes/projectx/index.ts`
- [ ] Create `routes/projectx/handlers.ts`:
  - `GET /api/projectx/accounts` - List linked accounts
  - `POST /api/projectx/sync` - Sync credentials
- [ ] Test with real ProjectX API

#### Day 9: Deploy & Verify
- [ ] Verify ProjectX connection works
- [ ] Test account sync flow
- [ ] Commit: `[v.5.10.3] feat: Phase 3 - ProjectX integration`

**Phase 3 Deliverables**:
- ✅ `/api/projectx/accounts` - Returns real accounts
- ✅ ProjectX auth flow working

---

### Phase 4: RiskFlow Feed (Days 10-14)
**Goal**: News feed with X API integration

#### Day 10: RiskFlow Infrastructure
- [ ] Create `routes/riskflow/index.ts`
- [ ] Create `routes/riskflow/handlers.ts`:
  - `GET /api/riskflow/feed` - Get news feed
  - `POST /api/riskflow/watchlist` - Update watchlist
- [ ] Create database tables for news articles

#### Day 11: X API Client
- [ ] Create `services/riskflow/x-client.ts`:
  - Rate limiting (300 req/15min)
  - Fetch from @FinancialJuice
  - Fetch from @InsiderWire
  - Tweet parsing

#### Day 12: Feed Service
- [ ] Create `services/riskflow/feed-service.ts`:
  - Aggregate news from sources
  - Apply user watchlist filter
  - Pagination support (max 50 items)

#### Day 13-14: Testing & Deploy
- [ ] Test with real X API
- [ ] Verify feed pagination works
- [ ] Commit: `[v.5.10.4] feat: Phase 4 - RiskFlow feed with X API`

**Phase 4 Deliverables**:
- ✅ `/api/riskflow/feed` - Returns paginated news
- ✅ X API integration working
- ✅ User watchlist filtering

---

### Phase 5: AI Analysis Layer (Days 15-19)
**Goal**: Grok analysis for news, IV scoring

#### Day 15: AI Model Selector
- [ ] Create `services/ai/model-selector.ts`:
  - Vercel AI Gateway integration
  - Model routing (Grok for news, Claude for chat)
  - Fallback logic

#### Day 16: News Analysis
- [ ] Create `services/analysis/grok-analyzer.ts`:
  - Parse financial headlines
  - Extract symbols, events
  - Detect breaking news
- [ ] Create `services/analysis/iv-scorer.ts`:
  - Calculate IV impact (0-10 scale)
  - Classify macro level

#### Day 17: Integrate with RiskFlow
- [ ] Update `feed-service.ts` to call Grok analysis
- [ ] Store analyzed articles in database
- [ ] Add sentiment/IV to feed response

#### Day 18-19: AI Chat Routes
- [ ] Create `routes/ai/handlers/chat.ts`
- [ ] Create `routes/ai/handlers/conversations.ts`
- [ ] Create `services/ai/conversation-store.ts`
- [ ] Deploy & verify
- [ ] Commit: `[v.5.10.5] feat: Phase 5 - AI analysis layer`

**Phase 5 Deliverables**:
- ✅ News analyzed by Grok
- ✅ IV scores calculated
- ✅ `/api/ai/chat` working
- ✅ Conversation history persisted

---

### Phase 6: Collaborative AI Agents (Days 20-25)
**Goal**: Multi-agent system per architecture docs

#### Day 20-21: Analyst Agents
- [ ] Create Market Data Analyst
- [ ] Create News & Sentiment Analyst  
- [ ] Create Technical Analyst
- [ ] Store reports in database

#### Day 22-23: Researcher Agents
- [ ] Create Bullish Researcher
- [ ] Create Bearish Researcher
- [ ] Implement debate protocol

#### Day 24-25: Trader & Risk Manager
- [ ] Create Trader Agent
- [ ] Create Risk Manager Agent
- [ ] Wire up full pipeline
- [ ] Commit: `[v.5.10.6] feat: Phase 6 - Collaborative AI agents`

**Phase 6 Deliverables**:
- ✅ Analyst reports generating
- ✅ Researcher debate working
- ✅ Trading proposals from agents

---

## Verification Checklist

After each phase, verify:

```bash
# Health check
curl https://pulse-api-withered-dust-1394.fly.dev/health

# CORS check
curl -I -X OPTIONS https://pulse-api-withered-dust-1394.fly.dev/api/account \
  -H "Origin: https://app.pricedinresearch.io"

# Auth check (replace TOKEN)
curl https://pulse-api-withered-dust-1394.fly.dev/api/account \
  -H "Authorization: Bearer TOKEN"
```

---

## File Line Count Enforcement

Before every commit, run:
```bash
find src -name "*.ts" -exec wc -l {} + | awk '$1 > 300 {print "❌ OVER 300:", $0}'
```

If any file is over 300 lines, **do not commit**. Split first.

---

## Environment Variables Required

```bash
# Fly.io Secrets (fly secrets set)
DATABASE_URL=               # Neon PostgreSQL
CLERK_SECRET_KEY=           # From Clerk dashboard
VERCEL_AI_GATEWAY_API_KEY=  # Vercel AI Gateway
X_API_BEARER_TOKEN=         # X API v2 bearer token
PROJECTX_USERNAME=          # TopStepX username
PROJECTX_API_KEY=           # TopStepX API key
FMP_API_KEY=                # Financial Modeling Prep (optional)
```

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Account routes working | 100% |
| 2 | Core data routes working | 100% |
| 3 | ProjectX accounts loading | Real data |
| 4 | RiskFlow feed loading | < 50 items, paginated |
| 5 | AI analysis running | < 500ms per item |
| 6 | Agent pipeline complete | < 60s end-to-end |

---

## Rollback Strategy

Each phase is deployed independently. If a phase fails:

1. Revert to previous deployment:
   ```bash
   fly releases -a pulse-api-withered-dust-1394
   fly deploy --image <previous-image>
   ```

2. Keep previous branch as fallback

3. Never force-push to main

---

## Ready to Execute

**Start with Phase 1, Day 1: Strip & Scaffold**

Command to strip violating files:
```bash
cd /Users/tifos/Desktop/Pulse/Developer/Pulse/pulse/backend-hono/src

# Remove files over 300 lines
rm services/ai-model-service.ts
rm services/chat-service.ts
rm services/provider-health.ts
rm utils/ai-cost-tracker.ts
rm services/conversation-manager.ts

# Keep psych-assist as reference, remove other routes
rm routes/ai-chat.ts
rm routes/analysts.ts
```

**Ready when you are!**

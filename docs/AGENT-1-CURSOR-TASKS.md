# Agent 1 Tasks: Cursor (Backend Infrastructure & Trading Logic)


## Non-Negotiable Scope & UI Directives (Chief Override)

- **Pulse-only scope**: All implementation in this plan targets **Pulse** exclusively. **Do not implement anything in ClawSpace** (deprecated).
- **UI source standard**: Any new or updated chat UI elements/components must be sourced from **21st.dev** patterns/components first, then adapted to Pulse.
- **No blank assistant bubble while thinking**: When the agent is working/thinking and not yet streaming tokens, do **not** render an empty assistant message bubble. Only render assistant bubble once stream/output begins.
- **Sticky bottom chat behavior**: Chat view must stay pinned to the bottom during active conversation/streaming (with robust auto-scroll + bottom-lock behavior) unless the user intentionally scrolls up.


> **Agent**: Cursor
> **Focus**: Backend infrastructure, trading strategies, ProjectX integration
> **Timeline**: 8 weeks (parallel with Agent 2)

---

## Week 1: Foundation & Critical Fixes

### Priority 1: Fix Authentication (401 Errors)
- [ ] Debug `backend-hono/src/middleware/auth.ts` Clerk JWT verification
- [ ] Verify `CLERK_SECRET_KEY` in Fly.io matches Clerk dashboard
- [ ] Add proper error logging to identify exact JWT validation failure
- [ ] Implement retry backoff logic (exponential: 1s, 2s, 4s, 8s, stop)
- [ ] Add rate limiting middleware to prevent error cascades
- [ ] Test with real Clerk tokens from frontend
- [ ] Verify CORS headers include Authorization

### Priority 2: Stabilize RiskFlow Feed
- [ ] Fix mock data generator to limit to 50 items max
- [ ] Implement pagination in `/api/riskflow/feed` endpoint
  - Add `limit` parameter (default: 50, max: 100)
  - Add `offset` parameter for cursor pagination
  - Add `after` parameter for timestamp-based pagination
- [ ] Add database indexes for performance:
  ```sql
  CREATE INDEX idx_news_articles_published ON news_articles(published_at DESC);
  CREATE INDEX idx_news_articles_breaking ON news_articles(is_breaking);
  CREATE INDEX idx_news_articles_symbols ON news_articles USING GIN(symbols);
  ```
- [ ] Implement proper X API rate limit handling
- [ ] Add caching layer (60 second TTL) for feed queries
- [ ] Test with real X API integration

### Priority 3: Database Schema Preparation
- [ ] Create migration for agent system tables:
  ```sql
  -- Agent reports storage
  CREATE TABLE agent_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    report_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    CONSTRAINT check_agent_type CHECK (agent_type IN ('market_data', 'news_sentiment', 'technical', 'bullish', 'bearish', 'trader', 'risk_manager'))
  );

  -- Trading proposals with agent integration
  CREATE TABLE trading_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(10) NOT NULL,
    contracts INTEGER NOT NULL,
    entry_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    take_profit DECIMAL(10,2),
    agent_reports JSONB,
    reasoning TEXT,
    confidence_score DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  -- Risk assessments
  CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES trading_proposals(id),
    risk_score DECIMAL(3,2),
    decision VARCHAR(20) NOT NULL,
    rejection_reason TEXT,
    modifications JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

---

## Week 2: Trading Strategy Engine Implementation

### Implement Core Trading Strategies
- [ ] Create `backend-hono/src/services/strategies/` directory structure
- [ ] Implement strategy base class:
  ```typescript
  interface TradingStrategy {
    name: string;
    evaluate(marketData: MarketData): StrategySignal | null;
    getRequiredIndicators(): string[];
    getTimeWindows(): TimeWindow[];
  }
  ```

### Strategy 1: 40/40 Club (Bread & Butter)
- [ ] Create `forty-forty-club.ts` strategy implementation
- [ ] Implement opening range break detection (5/10 min candles)
- [ ] Add ES/NQ correlation check (both must break)
- [ ] Implement EMA cross/retest/fakeout detection
- [ ] Add antilag detection logic:
  - Monitor tick surge in secondary instrument
  - Check price synchronization within 90 seconds
  - Calculate tick velocity threshold
- [ ] Set stop loss logic (5pts outside range)
- [ ] Set target logic (40pts or 3RR, whichever closer)

### Strategy 2: Print Charged Ripper
- [ ] Create `print-charged-ripper.ts` strategy
- [ ] Implement hot economic print detection
- [ ] Add Fibonacci retracement calculator
- [ ] Check EMA confluence at Fib levels
- [ ] Implement antilag confirmation
- [ ] Set entry on 21 MA (1000T)

### Strategy 3: Morning Flush
- [ ] Create `morning-flush.ts` strategy
- [ ] Define time windows (8:00-9:20, 11:30-1:30)
- [ ] Implement exhaustion detection (15-20min parabolic)
- [ ] Add HTF liquidity level identification
- [ ] Implement RSI divergence in neutral zone check
- [ ] Add sweep detection logic
- [ ] Set max trade duration (1hr 15min)

### Strategy 4: Lunch/Power Hour Flush
- [ ] Create `lunch-power-flush.ts` strategy
- [ ] Define time windows (11:00/12:03, 2:40-4:00)
- [ ] Implement overbought/oversold detection
- [ ] Add RSI divergence from early session
- [ ] Implement exhaustion after 15-20min check
- [ ] Set entry on 20 MA (1000T)

### Strategy 5: 22 VIX Fixer
- [ ] Create `vix-fixer.ts` strategy
- [ ] Implement VIX panic zone detection (22+)
- [ ] Add "large drop not traded" logic (track user trades)
- [ ] Implement bounce exhaustion detection
- [ ] Set ES convergence exit logic

---

## Week 3: Antilag Detection System

### Core Antilag Implementation
- [ ] Create `backend-hono/src/services/antilag-detector.ts`
- [ ] Implement tick surge detection algorithm:
  ```typescript
  interface AntilagSignal {
    detected: boolean;
    primarySymbol: string;
    secondarySymbol: string;
    tickSurge: number;
    timeWindow: number;
    priceSync: boolean;
    confidence: number;
  }
  ```
- [ ] Add 90-second rolling window for tick analysis
- [ ] Implement price trajectory synchronization check
- [ ] Create correlation coefficient calculator
- [ ] Add configurable thresholds per instrument pair

### Real-time Tick Processing
- [ ] Integrate with ProjectX SignalR for tick data
- [ ] Create tick aggregation service (1000 tick bars)
- [ ] Implement tick velocity calculator
- [ ] Add tick surge alerting system
- [ ] Store tick data for backtesting

---

## Week 4: Autopilot Proposal System

### Proposal Generation Engine
- [ ] Create `backend-hono/src/services/autopilot/proposal-generator.ts`
- [ ] Implement proposal creation from strategy signals
- [ ] Add position sizing calculator based on:
  - Account balance
  - Strategy confidence
  - Current exposure
  - Risk parameters
- [ ] Create proposal expiration logic (5 min default)
- [ ] Add proposal modification support

### Proposal API Endpoints
- [ ] Implement `POST /api/autopilot/propose`
- [ ] Implement `GET /api/autopilot/proposals`
- [ ] Implement `GET /api/autopilot/proposals/:id`
- [ ] Implement `POST /api/autopilot/acknowledge`
- [ ] Implement `POST /api/autopilot/execute`
- [ ] Add WebSocket support for real-time proposal updates

### Semi-Autopilot Mode
- [ ] Create instrument watchlist management:
  ```typescript
  interface WatchlistConfig {
    userId: string;
    instruments: string[];
    strategies: string[];
    autoPropose: boolean;
    requireApproval: boolean;
  }
  ```
- [ ] Implement proposal queue for user approval
- [ ] Add proposal filtering by instrument/strategy
- [ ] Create proposal history tracking

---

## Week 5: ProjectX Integration & Execution

### Order Execution System
- [ ] Update `backend/projectx/projectx_client.ts` for order placement
- [ ] Implement bracket order creation:
  ```typescript
  interface BracketOrder {
    entry: OrderRequest;
    stopLoss: StopLossOrder;
    takeProfit: TakeProfitOrder;
  }
  ```
- [ ] Add order status tracking via SignalR
- [ ] Implement order modification logic
- [ ] Create execution retry mechanism

### ProjectX API Compliance
- [ ] Verify all endpoint URLs match documentation exactly
- [ ] Ensure field names are case-sensitive correct
- [ ] Use numeric enum values (not strings)
- [ ] Test with exact contract ID format: `CON.F.US.{SYMBOL}.{EXPIRATION}`
- [ ] Implement proper error handling for all status codes

### Position Management
- [ ] Create position tracking service
- [ ] Implement P&L calculation
- [ ] Add position modification support
- [ ] Create emergency flatten positions function
- [ ] Implement trailing stop logic per strategy

---

## Week 6: Risk Validation Framework

### Risk Rules Engine
- [ ] Create `backend-hono/src/services/risk/risk-validator.ts`
- [ ] Implement hard risk checks:
  - Daily loss limit validation
  - Position size limits
  - Account balance verification
  - Trade count limits (max 5/day)
  - Correlated position checks
- [ ] Add time window restrictions per strategy
- [ ] Create breaking news pause detection (5-10 min)

### Risk Monitoring
- [ ] Implement real-time P&L tracking
- [ ] Add drawdown monitoring
- [ ] Create risk exposure dashboard data
- [ ] Implement circuit breakers for:
  - Consecutive losses
  - Rapid drawdown
  - System errors
- [ ] Add risk event logging

---

## Week 7: Performance & Optimization

### Backend Performance
- [ ] Add Redis caching for:
  - Market data (5 second TTL)
  - Strategy evaluations (1 second TTL)
  - Agent reports (60 second TTL)
- [ ] Optimize database queries with proper indexes
- [ ] Implement connection pooling for ProjectX API
- [ ] Add request batching for tick data
- [ ] Profile and optimize hot code paths

### Error Handling & Recovery
- [ ] Implement comprehensive error handling
- [ ] Add circuit breakers for external APIs
- [ ] Create fallback mechanisms for:
  - ProjectX API failures
  - Market data interruptions
  - Database connection issues
- [ ] Add error recovery workflows
- [ ] Implement audit logging for all trades

---

## Week 8: Testing & Production Deployment

### Comprehensive Testing
- [ ] Unit tests for all strategy implementations
- [ ] Integration tests for ProjectX API
- [ ] Test antilag detection with real tick data
- [ ] Verify proposal → execution workflow
- [ ] Load testing with multiple concurrent users
- [ ] Test all error scenarios

### Production Deployment
- [ ] Update Fly.io deployment configuration
- [ ] Configure production environment variables:
  ```bash
  DATABASE_URL=
  CLERK_SECRET_KEY=
  PROJECTX_API_KEY=
  PROJECTX_USERNAME=
  X_API_BEARER_TOKEN=
  X_API_BASE_URL=https://api.twitter.com/2
  REDIS_URL=
  ```
- [ ] Run database migrations
- [ ] Deploy to Fly.io production
- [ ] Monitor for errors and performance
- [ ] Create rollback plan

### Documentation
- [ ] Document all API endpoints
- [ ] Create strategy configuration guide
- [ ] Write antilag detection documentation
- [ ] Document risk rules and limits
- [ ] Create troubleshooting guide
- [ ] Write handoff documentation

---

## Success Criteria

### Week 1
- ✅ Zero authentication errors
- ✅ RiskFlow feed stable (< 50 items)
- ✅ Database schema ready

### Week 2
- ✅ All 5 trading strategies implemented
- ✅ Strategy signals generating correctly
- ✅ Time windows enforced

### Week 3
- ✅ Antilag detection working
- ✅ Tick surge alerts functional
- ✅ Price synchronization validated

### Week 4
- ✅ Proposals generating from strategies
- ✅ User approval workflow working
- ✅ Watchlist management functional

### Week 5
- ✅ ProjectX orders executing
- ✅ Bracket orders working
- ✅ Position tracking accurate

### Week 6
- ✅ Risk rules enforced
- ✅ Breaking news pauses working
- ✅ Circuit breakers functional

### Week 7
- ✅ Response times < 1 second
- ✅ Caching working properly
- ✅ Error recovery tested

### Week 8
- ✅ All tests passing
- ✅ Deployed to production
- ✅ Documentation complete

---

## Dependencies & Blockers

### Required from User
- [ ] Exact antilag thresholds (tick surge amount)
- [ ] Position sizing rules per strategy
- [ ] Risk parameters (managed in TopStepX)

### Required from Agent 2 (Claude Code)
- [ ] Agent report schemas for integration
- [ ] AI model response formats
- [ ] Chat interface API contracts

### External Dependencies
- [ ] ProjectX API access and credentials
- [ ] X API rate limits sufficient
- [ ] Clerk authentication working
- [ ] Fly.io deployment pipeline ready

---

## Communication Points with Agent 2

### Week 2
- Share strategy signal formats for Trader Agent

### Week 3
- Provide antilag detection data for Technical Analyst

### Week 4
- Share proposal schema for Risk Manager integration

### Week 5
- Coordinate execution confirmation for chat interface

### Week 6
- Share risk validation rules for Risk Manager Agent

---

## Notes

1. **Priority Order**: Auth → RiskFlow → Strategies → Antilag → Proposals → Execution
2. **Testing**: Each component must be tested before moving to next
3. **Rollback Plan**: Keep previous version ready for quick revert
4. **Monitoring**: Set up error tracking from day 1
5. **Documentation**: Document as you build, not after

---

**Agent 1 Ready to Execute** ✅
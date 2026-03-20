# Agent 2 Tasks: Claude Code (AI & Chat Systems)


## Non-Negotiable Scope & UI Directives (Chief Override)

- **Pulse-only scope**: All implementation in this plan targets **Pulse** exclusively. **Do not implement anything in ClawSpace** (deprecated).
- **UI source standard**: Any new or updated chat UI elements/components must be sourced from **21st.dev** patterns/components first, then adapted to Pulse.
- **No blank assistant bubble while thinking**: When the agent is working/thinking and not yet streaming tokens, do **not** render an empty assistant message bubble. Only render assistant bubble once stream/output begins.
- **Sticky bottom chat behavior**: Chat view must stay pinned to the bottom during active conversation/streaming (with robust auto-scroll + bottom-lock behavior) unless the user intentionally scrolls up.


> **Agent**: Claude Code
> **Focus**: Vercel AI SDK, Collaborative Agent Pipeline, Chat Interface
> **Timeline**: 8 weeks (parallel with Agent 1)

> **Environment Update (Jan 2026):** All backend AI calls now route through the Vercel AI Gateway using `VERCEL_AI_GATEWAY_API_KEY`. Legacy provider-specific keys (`ANTHROPIC_API_KEY`, `GROK_API_KEY`, `CLAUDE_*`) are deprecated and can be removed once the gateway is configured.

---

## Week 1: AI Infrastructure Setup

### Priority 1: Vercel AI SDK Integration
- [ ] Install required packages:
  ```json
  {
    "ai": "^latest",
    "@ai-sdk/anthropic": "^latest",
    "@ai-sdk/openai": "^latest"
  }
  ```
- [ ] Create AI client configuration service:
  ```typescript
  // backend-hono/src/services/ai-client-service.ts
  interface AIModelConfig {
    claude_opus: AnthropicConfig;
    claude_haiku: AnthropicConfig;
    grok: OpenAICompatibleConfig;
  }
  ```
- [ ] Set up environment variables in Fly.io:
  - `ANTHROPIC_API_KEY` for Claude models
  - `GROK_API_KEY` for Grok access
  - `VERCEL_AI_GATEWAY_URL` (if using gateway)
- [ ] Test basic text generation with each model
- [ ] Implement streaming response support
- [ ] Create model selection logic based on task type

### Priority 2: Agent Orchestration Framework
- [ ] Create `backend-hono/src/agents/` directory structure:
  ```
  agents/
  ├── core/
  │   ├── agent-base.ts
  │   ├── agent-registry.ts
  │   ├── agent-runner.ts
  │   └── report-aggregator.ts
  ├── analysts/
  │   ├── market-data-analyst.ts
  │   ├── news-sentiment-analyst.ts
  │   └── technical-analyst.ts
  ├── researchers/
  │   ├── bullish-researcher.ts
  │   ├── bearish-researcher.ts
  │   └── debate-protocol.ts
  ├── decision/
  │   ├── trader-agent.ts
  │   └── risk-manager-agent.ts
  └── prompts/
      └── [agent-prompts].ts
  ```

- [ ] Implement base agent class:
  ```typescript
  abstract class BaseAgent {
    abstract name: string;
    abstract model: 'opus' | 'haiku' | 'grok';
    abstract async analyze(context: AgentContext): Promise<AgentReport>;
    abstract validateReport(report: AgentReport): boolean;
  }
  ```

- [ ] Create agent communication protocol:
  ```typescript
  interface AgentMessage {
    from: string;
    to: string;
    type: 'request' | 'report' | 'debate';
    data: any;
    timestamp: Date;
  }
  ```

### Priority 3: Fix AI Chat Backend
- [ ] Update `/api/ai/chat` endpoint to actually work
- [ ] Implement conversation management:
  ```sql
  CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    model VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_conversations(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Add message persistence
- [ ] Implement streaming responses
- [ ] Test with frontend ChatInterface

---

## Week 2: Analyst Agents Implementation

### Market Data Analyst (Claude Haiku 4.5)
- [ ] Create `market-data-analyst.ts` implementation
- [ ] Implement market regime classification logic
- [ ] Add volatility state assessment
- [ ] Create support/resistance level detection
- [ ] Implement antilag detection integration (from Agent 1)
- [ ] Add EMA cross/retest/fakeout detection
- [ ] Set up 5-second response time target
- [ ] Create caching for 60-second reports

### News & Sentiment Analyst (Grok)
- [ ] Create `news-sentiment-analyst.ts` implementation
- [ ] Integrate with RiskFlow feed data
- [ ] Implement "tape checking" logic
- [ ] Add IV impact scoring (0-10 scale)
- [ ] Detect "hot prints" (economic data)
- [ ] Create NTN (Note to Trader) generation
- [ ] Implement breaking news detection
- [ ] Add sentiment classification logic

### Technical Analyst (Claude Haiku 4.5)
- [ ] Create `technical-analyst.ts` implementation
- [ ] Integrate with 1000 tick chart data
- [ ] Implement RSI divergence detection
- [ ] Add opening range break detection
- [ ] Create liquidity sweep identification
- [ ] Implement Fibonacci level calculations
- [ ] Add volume convergence/divergence analysis
- [ ] Set up pattern recognition for playbook strategies

### Report Aggregation System
- [ ] Create `report-aggregator.ts` service
- [ ] Design unified report schema:
  ```typescript
  interface AggregatedReport {
    timestamp: Date;
    analysts: {
      marketData: MarketDataReport;
      newsSentiment: NewsSentimentReport;
      technical: TechnicalReport;
    };
    summary: {
      consensus: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      keySignals: string[];
    };
  }
  ```
- [ ] Implement parallel analyst execution
- [ ] Add report validation and error handling
- [ ] Create report caching strategy

---

## Week 3: Researcher Agents & Debate System

### Bullish Researcher (Claude Opus 4.5)
- [ ] Create `bullish-researcher.ts` implementation
- [ ] Extract bullish signals from analyst reports
- [ ] Build bull thesis construction logic
- [ ] Identify upside catalysts
- [ ] Calculate probability of success
- [ ] Match bullish case to trading strategies
- [ ] Implement conviction scoring (0-100)

### Bearish Researcher (Claude Opus 4.5)
- [ ] Create `bearish-researcher.ts` implementation
- [ ] Extract bearish signals from analyst reports
- [ ] Build bear thesis construction logic
- [ ] Identify downside risks
- [ ] Calculate probability of failure
- [ ] Identify "stay flat" conditions
- [ ] Implement conviction scoring (0-100)

### Debate Protocol Implementation
- [ ] Create `debate-protocol.ts` orchestrator
- [ ] Implement 3-round debate structure:
  1. Opening arguments
  2. Rebuttals
  3. Closing statements
- [ ] Add debate turn management
- [ ] Create argument tracking system
- [ ] Implement consensus scoring (-100 to +100)
- [ ] Add debate quality metrics
- [ ] Set 30-second max debate time

### Debate Storage & Retrieval
- [ ] Create database schema:
  ```sql
  CREATE TABLE researcher_debates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    analyst_report_ids UUID[],
    bullish_arguments JSONB,
    bearish_arguments JSONB,
    debate_rounds JSONB,
    consensus_score DECIMAL(5,2),
    final_assessment JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Implement debate transcript storage
- [ ] Create debate retrieval API
- [ ] Add debate replay functionality

---

## Week 4: Trader Agent & Decision Synthesis

### Trader Agent (Claude Opus 4.5)
- [ ] Create `trader-agent.ts` implementation
- [ ] Implement strategy matching logic:
  - 40/40 Club detection
  - Morning Flush identification
  - Lunch/Power Hour Flush
  - Print Charged Ripper
  - 22 VIX Fixer
- [ ] Add position sizing calculator
- [ ] Create entry/exit price determination
- [ ] Implement stop loss/take profit logic
- [ ] Build trade proposal generator
- [ ] Add confidence scoring system

### Strategy Integration
- [ ] Connect with Agent 1's strategy signals
- [ ] Map debate consensus to strategy selection
- [ ] Implement strategy priority system:
  1. 40/40 Club (highest)
  2. Morning Flush
  3. 22 VIX Fixer
  4. Lunch/Power Hour Flush
  5. Print Charged Ripper
- [ ] Add multi-strategy conflict resolution
- [ ] Create strategy performance tracking

### Proposal Generation with AI Reasoning
- [ ] Enhance proposal schema with AI data:
  ```typescript
  interface AIEnhancedProposal {
    baseProposal: TradingProposal;
    aiReasoning: {
      analystReports: AnalystSummary;
      debateTranscript: DebateSummary;
      traderSynthesis: string;
      confidenceFactors: string[];
    };
    agentMetadata: {
      pipelineTime: number;
      modelsUsed: string[];
      reportIds: string[];
    };
  }
  ```
- [ ] Create detailed reasoning narratives
- [ ] Add proposal explanation generator

---

## Week 5: Risk Manager Agent & QuickPulse

### Risk Manager Agent (Claude Opus 4.5)
- [ ] Create `risk-manager-agent.ts` implementation
- [ ] Implement risk rule validation:
  - Daily loss limits
  - Position size limits
  - Trade count limits
  - Time window restrictions
  - Breaking news pauses
- [ ] Add market condition assessment
- [ ] Create risk scoring system (0-100)
- [ ] Implement approval/rejection logic
- [ ] Add modification suggestions
- [ ] Build risk assessment reports

### QuickPulse Analyst (Claude Opus 4.5 Fast)
- [ ] Create `quickpulse-analyst.ts` service
- [ ] Implement snapshot analysis (<5 seconds)
- [ ] Integrate news sentiment grade
- [ ] Add technical overlay analysis
- [ ] Create directional bias determination
- [ ] Build instant action suggestions
- [ ] Add urgency scoring
- [ ] Connect to VIX ticker UI trigger

### Risk Assessment Storage
- [ ] Implement risk decision logging:
  ```sql
  CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID,
    risk_score DECIMAL(3,2),
    market_risk VARCHAR(20),
    execution_risk VARCHAR(20),
    account_risk VARCHAR(20),
    decision VARCHAR(20),
    reasoning TEXT,
    modifications JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

---

## Week 6: Complete Chat Interface & Agent Queries

### Enhanced Chat System
- [ ] Implement multi-model chat support:
  ```typescript
  interface ChatConfig {
    model: 'opus' | 'haiku' | 'grok';
    streamResponse: boolean;
    includeAgentContext: boolean;
    maxTokens: number;
  }
  ```
- [ ] Add model selection logic per message
- [ ] Create conversation branching support
- [ ] Implement message editing/regeneration
- [ ] Add conversation search functionality

### Agent Reasoning Queries
- [ ] Implement natural language commands:
  - "Explain this trade proposal"
  - "Why did risk manager reject?"
  - "What are the analysts seeing?"
  - "Show me the debate"
  - "What's the market sentiment?"
- [ ] Create agent report summarizer
- [ ] Add debate transcript formatter
- [ ] Build reasoning chain visualizer

### Chat API Enhancements
- [ ] Update `/api/ai/chat` with streaming
- [ ] Add `/api/ai/chat/models` for available models
- [ ] Create `/api/ai/chat/commands` for agent queries
- [ ] Implement `/api/ai/chat/export` for conversation export
- [ ] Add WebSocket support for real-time chat

### Conversation Intelligence
- [ ] Add smart context injection:
  ```typescript
  interface ChatContext {
    currentPositions: Position[];
    recentTrades: Trade[];
    marketConditions: MarketSummary;
    activeProposals: Proposal[];
    agentReports: RecentReports;
  }
  ```
- [ ] Implement context-aware responses
- [ ] Add trading-specific knowledge base

---

## Week 7: Full Agent Pipeline Integration

### Complete Pipeline Orchestration
- [ ] Create `agent-pipeline.ts` master orchestrator
- [ ] Implement full workflow:
  ```typescript
  class AgentPipeline {
    async execute(): Promise<PipelineResult> {
      // 1. Run analysts in parallel
      const analystReports = await this.runAnalysts();

      // 2. Check for setup detection
      if (this.detectSetup(analystReports)) {
        // 3. Run researcher debate
        const debate = await this.runDebate(analystReports);

        // 4. Generate trading proposal
        const proposal = await this.runTrader(debate);

        // 5. Risk assessment
        const riskDecision = await this.runRiskManager(proposal);

        // 6. Return for user approval
        return { proposal, riskDecision, agentReports };
      }
    }
  }
  ```

### Performance Optimization
- [ ] Implement agent report caching (60s TTL)
- [ ] Add parallel execution for analysts
- [ ] Optimize prompt tokens usage
- [ ] Create agent response caching
- [ ] Add pipeline circuit breakers
- [ ] Target < 60 second full pipeline

### Agent Monitoring & Logging
- [ ] Create agent performance metrics:
  ```typescript
  interface AgentMetrics {
    agentName: string;
    executionTime: number;
    tokenCount: number;
    modelUsed: string;
    confidence: number;
    errors: Error[];
  }
  ```
- [ ] Implement comprehensive logging
- [ ] Add agent health monitoring
- [ ] Create performance dashboard data
- [ ] Build agent audit trail

### Error Handling & Recovery
- [ ] Add agent failure recovery:
  - Retry logic with backoff
  - Fallback to simpler models
  - Graceful degradation
- [ ] Implement partial pipeline completion
- [ ] Add error notification system
- [ ] Create pipeline state recovery

---

## Week 8: Testing, Documentation & Production

### Comprehensive Testing Suite
- [ ] Unit tests for each agent:
  ```typescript
  describe('MarketDataAnalyst', () => {
    it('should classify market regime correctly');
    it('should detect antilag conditions');
    it('should complete within 5 seconds');
  });
  ```
- [ ] Integration tests for debate system
- [ ] End-to-end pipeline tests
- [ ] Load testing with concurrent requests
- [ ] Model response validation tests
- [ ] Error scenario testing

### API Documentation
- [ ] Document all agent endpoints:
  ```yaml
  /api/agents/reports/market-data:
    get:
      description: Get latest market data analyst report
      responses:
        200: MarketDataReport
  ```
- [ ] Create agent prompt documentation
- [ ] Write debate protocol specification
- [ ] Document pipeline workflow
- [ ] Add troubleshooting guide

### Production Deployment Preparation
- [ ] Configure production API keys:
  ```bash
  ANTHROPIC_API_KEY=
  GROK_API_KEY=
  AI_GATEWAY_URL=
  ```
- [ ] Set up rate limiting per model
- [ ] Configure cost monitoring
- [ ] Add usage analytics
- [ ] Create model fallback configuration

### Agent System Documentation
- [ ] Write agent architecture guide
- [ ] Create prompt engineering documentation
- [ ] Document model selection criteria
- [ ] Write performance tuning guide
- [ ] Create agent customization guide
- [ ] Build troubleshooting playbook

---

## Success Criteria

### Week 1
- ✅ Vercel AI SDK integrated
- ✅ All 3 models (Opus, Haiku, Grok) working
- ✅ Chat backend functional

### Week 2
- ✅ All 3 analyst agents operational
- ✅ Reports generating in parallel
- ✅ < 10 second analyst cycle

### Week 3
- ✅ Debate system working
- ✅ Consensus scoring accurate
- ✅ < 30 second debate completion

### Week 4
- ✅ Trader agent generating proposals
- ✅ All 5 strategies mapped
- ✅ Detailed reasoning included

### Week 5
- ✅ Risk manager evaluating correctly
- ✅ QuickPulse < 5 second response
- ✅ Risk decisions logged

### Week 6
- ✅ Chat fully functional
- ✅ Agent queries working
- ✅ Streaming responses enabled

### Week 7
- ✅ Full pipeline < 60 seconds
- ✅ All agents integrated
- ✅ Error recovery working

### Week 8
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Production ready

---

## Dependencies & Coordination

### Required from Agent 1 (Cursor)
- [ ] Strategy signal formats (Week 2)
- [ ] Antilag detection data structure (Week 2)
- [ ] Proposal schema (Week 4)
- [ ] Risk validation rules (Week 5)
- [ ] Execution confirmation format (Week 5)

### Required from User
- [ ] AI API keys (Anthropic, Grok)
- [ ] Model selection preferences
- [ ] Confidence thresholds
- [ ] Chat response time requirements

### External Dependencies
- [ ] Vercel AI SDK compatibility
- [ ] AI model API availability
- [ ] Rate limits sufficient
- [ ] Cost budget approved

---

## Communication Points with Agent 1

### Week 2
- Receive strategy signal formats
- Share analyst report schemas

### Week 3
- Coordinate antilag data integration
- Share debate consensus format

### Week 4
- Align proposal generation with Agent 1's system
- Share trader decision format

### Week 5
- Integrate risk validation rules
- Coordinate execution workflow

### Week 6
- Share chat context requirements
- Align execution confirmations

### Week 7
- Full integration testing together
- Pipeline coordination

### Week 8
- Joint production deployment
- Unified documentation

---

## Model Cost Estimates

### Per Pipeline Execution
- **Analysts** (3x Haiku + 1x Grok): ~$0.05
- **Researchers** (2x Opus): ~$0.15
- **Trader** (1x Opus): ~$0.08
- **Risk Manager** (1x Opus): ~$0.08
- **Total per pipeline**: ~$0.36

### Monthly Estimates (per user)
- 100 pipelines/day: ~$36/day
- 50 pipelines/day: ~$18/day
- 20 pipelines/day: ~$7.20/day

### Optimization Strategies
- Cache analyst reports (60s)
- Use Haiku for simple tasks
- Batch similar requests
- Implement user tier limits

---

## Risk Mitigation

### AI Model Risks
- **Mitigation**: Multiple model providers, fallback options
- **Contingency**: Degrade to simpler models if needed

### Latency Risks
- **Mitigation**: Parallel execution, caching, optimization
- **Contingency**: Reduce debate rounds, simplify analysis

### Cost Overruns
- **Mitigation**: Usage monitoring, tier limits, caching
- **Contingency**: Restrict to premium users only

### Integration Failures
- **Mitigation**: Comprehensive testing, gradual rollout
- **Contingency**: Maintain current system as fallback

---

## Supplementary: Rithmic Test Trade Endpoint

> **Context**: Standalone backend endpoint that simulates a trade through PIC's
> strategy models (40/40 Club, Flush, Ripper) against Rithmic micro instruments
> on TopstepX. Returns calculated targets, risk, and scale-in capacity without
> executing. A future separate plan will add the frontend test-trade button.

### Status

| Layer | File | Status |
|-------|------|--------|
| Types | `backend-hono/src/types/trading.ts` (lines 46-100) | **Done** |
| Service | `backend-hono/src/services/trading-service.ts` | Planned |
| Handler | `backend-hono/src/routes/trading/handlers.ts` | Planned |
| Route | `backend-hono/src/routes/trading/index.ts` | Planned |

### Task Checklist

#### 1. Service — `trading-service.ts`

- [ ] Add `getPointValue()` helper for Rithmic micro instruments:
  | Symbol | Point Value |
  |--------|-------------|
  | MNQ | $2 |
  | NQ | $20 |
  | MES | $5 |
  | ES | $50 |
- [ ] Add `executeTestTrade(userId, request: TestTradeRequest): Promise<TestTradeResult>`
- [ ] Compute stop distance, risk-per-contract, total risk from entry/stop prices
- [ ] Generate strategy-specific targets:
  - **40/40 Club**: +40pt primary, fib extensions, VWAP levels
  - **Flush**: +30pt primary, HTF fib rounded to nearest 25, exhaustion targets
  - **Ripper**: +50pt primary, wider targets, event-severity scaling
- [ ] Calculate best R:R ratio from targets
- [ ] Compute `maxScaleInContracts`:
  - Default max = 25, reduced to 20 after 12:30 ET
  - Scale-in prerequisite: >= 55% ATR from 100 EMA
- [ ] Apply PDPT cap based on `mode`:
  - `combine` → $1,550 hard cap
  - `funded` → $1,500 trailing avg ($1,300–$2,000 range)
- [ ] Populate `notes[]` with strategy-specific context (fib zone, timing window, catalyst)

#### 2. Handler — `handlers.ts`

- [ ] Add `handleTestTrade(c: Context)` handler
- [ ] Validate `TestTradeRequest` body (strategy, symbol, side, entryPrice, stopPrice required)
- [ ] Return 400 on invalid input, 500 on service error
- [ ] Return `TestTradeResponse` on success

#### 3. Route — `index.ts`

- [ ] Register `POST /test-trade` → `handleTestTrade`

### Implementation Notes

- This is a **simulation-only** endpoint — no orders placed
- Uses the existing service-layer pattern (types → service → handler → route)
- `getPointValue()` is distinct from the existing `getMultiplier()` which has full-size contract values
- Strategy target logic should reference specs in `docs/quantconnect/STRATEGY-*.md`
- Trailing stop phases and cycle levels are display-only in test trade output (execution logic is in QC)

---

## Notes

1. **Priority**: Chat must work first, then analysts, then full pipeline
2. **Model Selection**: Opus for complex, Haiku for fast, Grok for news
3. **Testing**: Test each agent individually before integration
4. **Cost Control**: Monitor usage closely from day 1
5. **Documentation**: Document prompts and responses for debugging

---

**Agent 2 Ready to Execute** ✅
# Collaborative AI System Implementation Plan


## Non-Negotiable Scope & UI Directives (Chief Override)

- **Pulse-only scope**: All implementation in this plan targets **Pulse** exclusively. **Do not implement anything in ClawSpace** (deprecated).
- **UI source standard**: Any new or updated chat UI elements/components must be sourced from **21st.dev** patterns/components first, then adapted to Pulse.
- **No blank assistant bubble while thinking**: When the agent is working/thinking and not yet streaming tokens, do **not** render an empty assistant message bubble. Only render assistant bubble once stream/output begins.
- **Sticky bottom chat behavior**: Chat view must stay pinned to the bottom during active conversation/streaming (with robust auto-scroll + bottom-lock behavior) unless the user intentionally scrolls up.

## Pulse v3.0 - Multi-Agent Trading Intelligence

> **Created**: 2026-01-02
> **Status**: Planning Phase
> **Target**: Transform PriceBrain Layer into Collaborative AI System

---

## Executive Summary

This document outlines the transformation of Pulse's single-agent "PriceBrain Layer" into a **collaborative multi-agent AI system** inspired by the TradingAgents framework. Instead of one AI controlling all decisions, we'll implement specialized AI agents that work together like a professional trading firm.

### Current Problems
1. **News Feed**: Has failed across all 3 backend iterations
2. **AI Agent**: Cannot start conversations, no conversation history, no functional chat
3. **Autopilot**: Cannot execute trades despite previous functionality with AWS Bedrock + X API
4. **Peak Functionality**: Basic AWS Bedrock messages + RiskFlow with X API (until rate limits)

### Solution Approach
Transform the backend from a single AI agent into a **collaborative multi-agent system** modeled after TradingAgents:
- **Analyst Agents**: Fundamental, Sentiment, News, Technical
- **Researcher Agents**: Bullish/Bearish debate teams
- **Trader Agent**: Synthesizes analysis into trading proposals
- **Risk Manager Agent**: Final approval/rejection authority

---

## Part 1: Current State Analysis

### What We Have (From Architecture Review)

#### Backend Infrastructure (Hono on Fly.io)
- **Database**: Neon PostgreSQL (working)
- **Auth**: Clerk JWT (configured but failing with 401s)
- **Deployment**: Fly.io at `pulse-api-withered-dust-1394.fly.dev`
- **Health Check**: Working (`/health` endpoint functional)

#### Existing Services (Backend)
- **RiskFlow Service** (`/api/riskflow`): News feed with IV scoring
- **Autopilot Service** (`/api/autopilot`): Proposal workflow (incomplete)
- **ProjectX Service** (`/api/projectx`): TopStepX integration
- **AI Service** (`/api/ai`): Currently returns empty conversations

#### Critical Issues
1. **Authentication Flow**: 401 errors flooding (2000+ in 30 seconds)
   - Frontend sends Clerk JWT, backend rejects
   - `CLERK_SECRET_KEY` may be misconfigured
   - No retry backoff causing error cascade

2. **Mock Data Flooding**: 3000+ newsfeed items when mock enabled
   - No pagination control
   - No virtualization
   - Needs rate limiting

3. **AI System**: Completely non-functional
   - Old AWS Bedrock code removed
   - No conversation management
   - No message persistence
   - Empty `/api/ai` endpoints

4. **Autopilot**: Backend-only, no execution
   - Proposal workflow incomplete
   - No ProjectX integration for execution
   - No risk validation
   - No strategy engine

### What We Lost (From Previous Iterations)
- AWS Bedrock basic chat functionality
- X API RiskFlow feed (worked until rate limits)
- Autopilot execution capability
- Conversation history persistence
- Tilt detection system

### Technology Stack Currently in Place
- **Backend**: Hono.js, TypeScript, Node.js
- **Database**: Neon PostgreSQL (serverless)
- **Auth**: Clerk (JWT-based)
- **Frontend**: React 18 + Vite, Tailwind CSS
- **Deployment**: Backend on Fly.io, Frontend on Vercel

---

## Part 2: TradingAgents Framework Analysis

### Architecture Overview

The TradingAgents framework simulates a professional trading firm through specialized AI agents:

#### Agent Hierarchy

**1. Analyst Team** (Information Gathering)
- **Fundamental Analyst**: Company financials, earnings, balance sheets
- **Sentiment Analyst**: Social media, market sentiment, retail positioning
- **News Analyst**: Global news, macroeconomic indicators, geopolitical events
- **Technical Analyst**: Chart patterns, indicators, price action

**2. Researcher Team** (Critical Analysis)
- **Bullish Researchers**: Identify positive signals, opportunities, upside catalysts
- **Bearish Researchers**: Identify risks, downside catalysts, red flags
- **Structured Debates**: Critical assessment through opposing viewpoints

**3. Trader Agent** (Decision Synthesis)
- Reviews all analyst reports
- Synthesizes bullish/bearish research
- Determines trade timing, size, entry/exit
- Produces decision signals with rationale

**4. Risk Management Team** (Final Authority)
- Assesses portfolio risks
- Evaluates market volatility and liquidity
- Implements risk mitigation strategies
- **Final approval/rejection of trades**

### Collaboration Mechanism

1. **Data Ingestion**: Market data, news, sentiment, fundamentals
2. **Parallel Analysis**: Analysts work independently on their domains
3. **Report Compilation**: Each analyst produces structured report
4. **Researcher Debate**: Bullish vs Bearish teams critically analyze
5. **Trader Synthesis**: Trader reviews all reports, makes proposal
6. **Risk Review**: Risk manager evaluates and approves/rejects
7. **Execution**: If approved, trade executed with monitoring

### Technology Stack (TradingAgents)
- **Framework**: LangGraph (for agent orchestration)
- **LLMs**: GPT-4o, o1-preview
- **Data Sources**: yfinance, Alpha Vantage, news APIs
- **Prompting**: ReAct framework for reasoning
- **Communication**: Structured protocols, JSON reports

### Key Differentiators
- **Specialization**: Each agent has narrow focus
- **Dialectical Process**: Bullish vs Bearish debate
- **Transparency**: Explainable decision trails
- **Human-in-the-loop**: Risk manager can be human-controlled
- **Scalability**: Add/remove agents without rewriting system

---

## Part 3: Pulse Collaborative AI Architecture

### Design Principles

1. **Human-in-the-Loop**: All trades require explicit user approval
2. **Transparency**: Every decision must be explainable
3. **Modularity**: Agents are independent, swappable services
4. **Fail-Safe**: Risk manager has veto power on all trades
5. **Real-Time**: Agents react to market events as they happen

### Agent Mapping for Pulse

#### Analyst Layer (Parallel Processing)

**1. Market Data Analyst**
- **Purpose**: Process real-time market data (VIX, price action, volume)
- **Data Sources**:
  - ProjectX API (real-time quotes, trades, depth)
  - VIX data via `/api/market/vix`
  - Historical bars for pattern recognition
- **Outputs**: Market regime classification, volatility state, trend analysis
- **AI Model**: Fast model for low-latency (GPT-4o-mini or Claude Haiku)
- **Update Frequency**: Real-time via SignalR, summary every 5 minutes

**2. News & Sentiment Analyst**
- **Purpose**: Analyze RiskFlow feed for market-moving news
- **Data Sources**:
  - X API via `news-service.ts`
  - Polymarket odds for event probabilities
  - Scheduled events (`scheduled_events` table)
- **Outputs**: Sentiment classification, IV impact score, macro level
- **AI Model**: Medium model for context (GPT-4o or Claude Sonnet)
- **Update Frequency**: On new RiskFlow item (breaking news triggers immediate analysis)

**3. Technical Analyst**
- **Purpose**: Chart patterns, technical indicators, entry/exit signals
- **Data Sources**:
  - Historical bars via ProjectX `/api/History/retrieveBars`
  - Real-time price data via Market Hub
- **Outputs**: Support/resistance levels, trend signals, pattern recognition
- **AI Model**: Specialized model for pattern recognition (consider fine-tuned model)
- **Update Frequency**: Every 1 minute for active symbols

**4. Fundamental Analyst** (Future Phase)
- **Purpose**: Company fundamentals, earnings, economic data
- **Data Sources**: Economic calendar, earnings reports (future integration)
- **Outputs**: Fundamental strength score, earnings impact
- **AI Model**: Large reasoning model (GPT-4o or Claude Opus)
- **Update Frequency**: On earnings/economic events

#### Researcher Layer (Critical Analysis)

**5. Bullish Researcher**
- **Purpose**: Identify positive signals, upside opportunities
- **Inputs**: All analyst reports
- **Process**:
  - Extract bullish indicators from each report
  - Assess probability of upside scenarios
  - Identify catalysts for positive price movement
- **Outputs**: Bullish case report with confidence score
- **AI Model**: Reasoning model (GPT-4o, Claude Sonnet, or o1-preview)

**6. Bearish Researcher**
- **Purpose**: Identify risks, downside scenarios, red flags
- **Inputs**: All analyst reports
- **Process**:
  - Extract bearish indicators
  - Assess probability of downside scenarios
  - Identify risk factors (news, volatility, positioning)
- **Outputs**: Bearish case report with confidence score
- **AI Model**: Reasoning model (GPT-4o, Claude Sonnet, or o1-preview)

**Debate Protocol**:
- Bullish and Bearish researchers exchange 2-3 rounds of arguments
- Each round refines thesis based on counterpoints
- Final output: Balanced risk/reward assessment

#### Decision Layer (Synthesis)

**7. Trader Agent**
- **Purpose**: Synthesize all analysis into trading proposal
- **Inputs**:
  - Market Data Analyst report
  - News & Sentiment Analyst report
  - Technical Analyst report
  - Bullish Researcher report
  - Bearish Researcher report
  - User's active trading strategies (Morning Flush, VIX Fix, etc.)
- **Process**:
  - Evaluate alignment with enabled trading models
  - Determine optimal entry/exit based on analyst consensus
  - Calculate position size based on conviction level
  - Check time windows and market conditions
- **Outputs**: Trading proposal with:
  - Symbol, side (long/short), size
  - Entry price, stop loss, take profit
  - Strategy name (which model triggered)
  - Reasoning (full explanation referencing analyst reports)
  - Confidence score (0-100)
- **AI Model**: Large reasoning model (GPT-4o, Claude Opus, or o1-preview)

#### Risk Layer (Final Authority)

**8. Risk Manager Agent**
- **Purpose**: Final approval/rejection of trading proposals
- **Inputs**:
  - Trader proposal
  - Current account state (balance, open positions, P&L)
  - Daily loss limits, position size limits
  - Breaking news status (is there a recent high-impact event?)
  - Time window restrictions
- **Process**:
  - Validate proposal against risk rules
  - Check for correlated positions
  - Assess market conditions (volatility, liquidity)
  - Evaluate if risk/reward is favorable
  - **Make final decision**: Approve, Reject, or Modify
- **Outputs**:
  - Approval/Rejection decision
  - Risk assessment report
  - Modification suggestions (if applicable)
- **AI Model**: Large reasoning model (GPT-4o, Claude Opus, or o1-preview)
- **Human Override**: User can always override risk manager decision

---

## Part 4: Technical Implementation Plan

### Phase 1: Foundation & Authentication Fix (Week 1)

#### Objectives
- Fix authentication 401 errors
- Stabilize RiskFlow feed
- Set up Vercel AI SDK infrastructure
- Create agent orchestration framework

#### Tasks

**1.1 Fix Authentication Flow**
- [ ] Debug Clerk JWT verification in `auth.ts`
- [ ] Verify `CLERK_SECRET_KEY` matches Clerk dashboard
- [ ] Add retry backoff logic in frontend API client
- [ ] Stop polling on 401 errors
- [ ] Add rate limiting to prevent error cascades
- [ ] Test auth flow end-to-end

**1.2 Stabilize RiskFlow Feed**
- [ ] Fix mock data flooding (limit to 50 items max)
- [ ] Add pagination support (`limit`, `offset` params)
- [ ] Implement cursor-based pagination for real-time feed
- [ ] Add virtualization in frontend (react-window or similar)
- [ ] Test with real X API data (manage rate limits)

**1.3 Vercel AI SDK Setup**
- [ ] Research Vercel AI Gateway configuration requirements
- [ ] Install Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
- [ ] Configure AI Gateway API key in Fly.io secrets
- [ ] Create AI client wrapper service (`ai-client-service.ts`)
- [ ] Test basic text generation with multiple providers
- [ ] Set up streaming response support

**1.4 Agent Orchestration Framework**
- [ ] Design agent communication protocol (JSON schemas)
- [ ] Create agent registry (`agent-registry.ts`)
- [ ] Implement agent runner (`agent-runner.ts`) for parallel execution
- [ ] Create agent report aggregator
- [ ] Design debate protocol for researcher agents
- [ ] Implement agent state management (track active agents, reports)

#### Deliverables
- Authentication working (no 401 errors)
- RiskFlow feed stable with pagination
- Vercel AI SDK integrated and tested
- Agent orchestration framework ready

#### Branch: `v.1.7.1` (assuming current date is Jan 7)

---

### Phase 2: Analyst Agent Implementation (Week 2)

#### Objectives
- Implement Market Data Analyst
- Implement News & Sentiment Analyst
- Implement Technical Analyst
- Create report aggregation system

#### Tasks

**2.1 Market Data Analyst**
- [ ] Create `market-data-analyst.ts` service
- [ ] Define Market Data Analyst prompt template
- [ ] Integrate ProjectX SignalR for real-time quotes
- [ ] Implement VIX data fetching
- [ ] Create market regime classification logic
- [ ] Design Market Data Analyst report schema
- [ ] Test with live market data
- [ ] Add caching for 5-minute summaries

**2.2 News & Sentiment Analyst**
- [ ] Create `news-sentiment-analyst.ts` service
- [ ] Define News & Sentiment Analyst prompt template
- [ ] Integrate with RiskFlow feed (`/api/riskflow/feed`)
- [ ] Implement breaking news detection
- [ ] Add Polymarket integration for event probabilities
- [ ] Design News & Sentiment report schema
- [ ] Test with real X API news
- [ ] Add sentiment scoring cache

**2.3 Technical Analyst**
- [ ] Create `technical-analyst.ts` service
- [ ] Define Technical Analyst prompt template
- [ ] Integrate historical bars via ProjectX API
- [ ] Implement technical indicator calculations (moving averages, RSI, etc.)
- [ ] Add pattern recognition logic (support/resistance, breakouts)
- [ ] Design Technical Analyst report schema
- [ ] Test with real-time price data
- [ ] Add 1-minute update cycle

**2.4 Report Aggregation**
- [ ] Create `analyst-reports.ts` aggregation service
- [ ] Design unified report format
- [ ] Implement report caching strategy
- [ ] Create report versioning (track report history)
- [ ] Add report retrieval API (`/api/agents/reports`)
- [ ] Test parallel analyst execution
- [ ] Measure latency and optimize

#### Database Schema
```sql
CREATE TABLE agent_reports (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  agent_type VARCHAR(50) NOT NULL, -- 'market_data', 'news_sentiment', 'technical'
  report_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_agent_reports_user_type ON agent_reports(user_id, agent_type);
CREATE INDEX idx_agent_reports_created ON agent_reports(created_at DESC);
```

#### Deliverables
- 3 analyst agents fully functional
- Report aggregation system working
- Real-time analyst reports available via API
- Database schema deployed

#### Branch: `v.1.14.1`

---

### Phase 3: Researcher & Debate System (Week 3)

#### Objectives
- Implement Bullish Researcher agent
- Implement Bearish Researcher agent
- Create debate protocol
- Test dialectical analysis process

#### Tasks

**3.1 Bullish Researcher Agent**
- [ ] Create `bullish-researcher.ts` service
- [ ] Define Bullish Researcher prompt template
- [ ] Implement bullish case extraction logic
- [ ] Add confidence scoring for bullish scenarios
- [ ] Design Bullish Researcher report schema
- [ ] Test with analyst reports as input

**3.2 Bearish Researcher Agent**
- [ ] Create `bearish-researcher.ts` service
- [ ] Define Bearish Researcher prompt template
- [ ] Implement bearish case extraction logic
- [ ] Add confidence scoring for bearish scenarios
- [ ] Design Bearish Researcher report schema
- [ ] Test with analyst reports as input

**3.3 Debate Protocol**
- [ ] Create `debate-protocol.ts` orchestration service
- [ ] Implement multi-round debate logic (2-3 rounds)
- [ ] Add argument/counterargument tracking
- [ ] Create debate summary generator
- [ ] Design debate transcript storage
- [ ] Test full debate cycle with real market data

**3.4 Debate Analysis**
- [ ] Create `debate-analyzer.ts` service
- [ ] Implement consensus detection
- [ ] Calculate bullish/bearish score balance
- [ ] Generate final risk/reward assessment
- [ ] Add debate quality metrics (argument strength, evidence quality)

#### Database Schema
```sql
CREATE TABLE researcher_debates (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  analyst_report_ids UUID[] NOT NULL,
  bullish_report JSONB NOT NULL,
  bearish_report JSONB NOT NULL,
  debate_rounds JSONB NOT NULL, -- Array of round transcripts
  consensus_score DECIMAL(3,2), -- -1 (bearish) to +1 (bullish)
  final_assessment JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_debates_user ON researcher_debates(user_id);
CREATE INDEX idx_debates_created ON researcher_debates(created_at DESC);
```

#### Deliverables
- Bullish and Bearish researchers functional
- Debate protocol working end-to-end
- Debate transcripts stored and retrievable
- Consensus scoring implemented

#### Branch: `v.1.21.1`

---

### Phase 4: Trader Agent & Proposal Generation (Week 4)

#### Objectives
- Implement Trader Agent
- Integrate with trading strategies (Morning Flush, VIX Fix, etc.)
- Create proposal generation system
- Test proposal workflow

#### Tasks

**4.1 Trader Agent**
- [ ] Create `trader-agent.ts` service
- [ ] Define Trader Agent prompt template
- [ ] Implement strategy matching logic (which model triggered?)
- [ ] Add position sizing calculations
- [ ] Create entry/exit price determination
- [ ] Implement stop loss / take profit logic
- [ ] Design Trader proposal schema
- [ ] Test with full analyst + researcher pipeline

**4.2 Trading Strategy Integration**
- [ ] Map existing strategies to agent logic:
  - Morning Flush
  - Lunch/Power Hour Flush
  - 40/40 Club
  - Momentum Model
  - 22 VIX Fix
  - Charged Up Rippers
  - Mean Reversion
- [ ] Create strategy configuration schema
- [ ] Implement strategy enable/disable controls
- [ ] Add strategy time window validation
- [ ] Test each strategy with agent system

**4.3 Proposal Generation**
- [ ] Create `proposal-generator.ts` service
- [ ] Design proposal schema (extend existing `autopilot_proposals`)
- [ ] Add reasoning field with full agent report references
- [ ] Implement confidence score calculation
- [ ] Create proposal expiration logic (default 5 minutes)
- [ ] Add proposal modification support

**4.4 Proposal API**
- [ ] Update `/api/autopilot/propose` endpoint
- [ ] Add agent report IDs to proposal metadata
- [ ] Create `/api/autopilot/proposals/:id/reasoning` endpoint (full agent chain)
- [ ] Test proposal creation from agent pipeline

#### Database Schema Updates
```sql
ALTER TABLE autopilot_proposals ADD COLUMN agent_reports JSONB;
ALTER TABLE autopilot_proposals ADD COLUMN trader_reasoning TEXT;
ALTER TABLE autopilot_proposals ADD COLUMN confidence_score DECIMAL(3,2);
ALTER TABLE autopilot_proposals ADD COLUMN debate_id UUID REFERENCES researcher_debates(id);
```

#### Deliverables
- Trader Agent fully functional
- All trading strategies integrated
- Proposal generation working end-to-end
- API endpoints updated

#### Branch: `v.1.28.1`

---

### Phase 5: Risk Manager & Execution (Week 5)

#### Objectives
- Implement Risk Manager Agent
- Create risk validation system
- Integrate ProjectX order execution
- Test full pipeline (analyst → trader → risk → execution)

#### Tasks

**5.1 Risk Manager Agent**
- [ ] Create `risk-manager-agent.ts` service
- [ ] Define Risk Manager prompt template
- [ ] Implement risk rule validation:
  - Daily loss limit
  - Position size limits
  - Account balance checks
  - Open position correlation
  - Breaking news pause detection
  - Time window restrictions
- [ ] Add risk scoring system
- [ ] Create approval/rejection logic
- [ ] Design Risk Manager report schema
- [ ] Test with real proposals

**5.2 Risk Validation System**
- [ ] Create `risk-validator.ts` service
- [ ] Implement hard risk checks (programmatic):
  - Daily loss limit exceeded?
  - Position size over max?
  - Insufficient buying power?
  - Correlated positions check
  - Time window allowed?
- [ ] Add soft risk checks (AI-assisted):
  - Market volatility too high?
  - News event risk?
  - Counterparty liquidity?
- [ ] Create risk override mechanism (user approval)

**5.3 ProjectX Order Execution**
- [ ] Update `projectx-client.ts` for order placement
- [ ] Implement bracket order creation (entry + stop + target)
- [ ] Add order status tracking via SignalR
- [ ] Create execution result handler
- [ ] Store execution in `autopilot_executions` table
- [ ] Add execution failure retry logic
- [ ] Test with ProjectX API (sim account first)

**5.4 Full Pipeline Integration**
- [ ] Create `agent-pipeline.ts` orchestrator
- [ ] Implement end-to-end workflow:
  1. Market event triggers analysis
  2. Analysts generate reports in parallel
  3. Researchers debate findings
  4. Trader creates proposal
  5. Risk Manager evaluates
  6. If approved, user acknowledges
  7. Execution via ProjectX
  8. Post-execution monitoring
- [ ] Add pipeline state management
- [ ] Create pipeline logging/audit trail
- [ ] Test full pipeline with real market data

#### Database Schema
```sql
CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES autopilot_proposals(id),
  risk_manager_report JSONB NOT NULL,
  risk_score DECIMAL(3,2), -- 0 (safe) to 1 (dangerous)
  decision VARCHAR(20) NOT NULL, -- 'approved', 'rejected', 'modified'
  rejection_reason TEXT,
  modification_suggestions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_assessments_proposal ON risk_assessments(proposal_id);
```

#### Deliverables
- Risk Manager Agent functional
- Risk validation system working
- ProjectX order execution integrated
- Full agent pipeline operational

#### Branch: `v.2.4.1`

---

### Phase 6: Chat Interface & Conversation System (Week 6)

#### Objectives
- Implement AI chat interface backend
- Create conversation management system
- Integrate chat with agent pipeline
- Enable users to query agent reasoning

#### Tasks

**6.1 Chat Backend**
- [ ] Update `/api/ai/chat` endpoint
- [ ] Implement conversation threading
- [ ] Add message persistence
- [ ] Create streaming response support
- [ ] Design chat context injection (account state, market data)
- [ ] Test chat with Vercel AI SDK

**6.2 Conversation Management**
- [ ] Create `conversation-manager.ts` service
- [ ] Implement conversation history retrieval
- [ ] Add conversation search/filtering
- [ ] Create conversation archiving
- [ ] Design conversation metadata schema
- [ ] Test with multiple concurrent conversations

**6.3 Agent Reasoning Queries**
- [ ] Add "Explain this proposal" chat command
- [ ] Create "Why did risk manager reject?" query
- [ ] Implement "What are analysts seeing?" summary
- [ ] Add "Show me the debate" command
- [ ] Create natural language query interface for agent reports

**6.4 Chat API**
- [ ] Update `/api/ai/conversations` endpoint
- [ ] Create `/api/ai/conversations/:id` endpoint
- [ ] Add `/api/ai/chat/stream` for real-time streaming
- [ ] Test chat with frontend integration

#### Database Schema
```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id),
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB, -- Agent reports, proposal IDs, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX idx_messages_created ON ai_messages(created_at DESC);
```

#### Deliverables
- Chat backend fully functional
- Conversation management working
- Agent reasoning queries implemented
- Chat API endpoints ready

#### Branch: `v.2.11.1`

---

### Phase 7: Frontend Integration & Testing (Week 7)

#### Objectives
- Connect frontend to collaborative AI backend
- Update ChatInterface component
- Update AutopilotWidget with agent reasoning
- End-to-end testing

#### Tasks

**7.1 Frontend API Client Updates**
- [ ] Update API client for new endpoints
- [ ] Add agent report fetching
- [ ] Implement debate transcript display
- [ ] Create proposal reasoning display
- [ ] Test all API calls

**7.2 ChatInterface Integration**
- [ ] Update ChatInterface to use new `/api/ai/chat`
- [ ] Add streaming support for responses
- [ ] Implement conversation threading UI
- [ ] Add agent reasoning display in chat
- [ ] Test chat with real backend

**7.3 Autopilot Widget Updates**
- [ ] Display agent reasoning in proposals
- [ ] Show analyst reports summary
- [ ] Add debate transcript view
- [ ] Display risk manager assessment
- [ ] Test proposal flow end-to-end

**7.4 RiskFlow Integration**
- [ ] Connect News & Sentiment Analyst to RiskFlow feed
- [ ] Display AI-generated sentiment in feed cards
- [ ] Add "Ask AI about this news" button
- [ ] Test real-time news analysis

**7.5 End-to-End Testing**
- [ ] Test full pipeline with real market data
- [ ] Verify proposal generation workflow
- [ ] Test chat interface with agent queries
- [ ] Verify execution flow with ProjectX
- [ ] Load testing (multiple concurrent users)
- [ ] Error handling and edge cases

#### Deliverables
- Frontend fully integrated with collaborative AI backend
- Chat interface functional
- Autopilot widget showing agent reasoning
- All features tested end-to-end

#### Branch: `v.2.18.1`

---

### Phase 8: Optimization & Production (Week 8)

#### Objectives
- Optimize agent performance
- Add caching and rate limiting
- Implement monitoring and logging
- Production deployment

#### Tasks

**8.1 Performance Optimization**
- [ ] Add agent report caching (Redis or in-memory)
- [ ] Implement parallel agent execution
- [ ] Optimize database queries
- [ ] Add batch processing for analyst updates
- [ ] Reduce latency on proposal generation

**8.2 Rate Limiting & Cost Control**
- [ ] Implement AI API rate limiting
- [ ] Add usage tracking per user tier
- [ ] Create cost estimation for agent pipeline
- [ ] Add fallback models for cost savings
- [ ] Test rate limit handling

**8.3 Monitoring & Logging**
- [ ] Add agent execution logging
- [ ] Create agent performance metrics
- [ ] Implement error tracking (Sentry or similar)
- [ ] Add real-time agent status dashboard
- [ ] Create audit trail for all trades

**8.4 Production Deployment**
- [ ] Deploy to Fly.io production
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Test in production environment
- [ ] Monitor for issues

**8.5 Documentation**
- [ ] Update architecture documentation
- [ ] Create agent system guide
- [ ] Document API endpoints
- [ ] Write user guide for collaborative AI
- [ ] Create handoff document for future development

#### Deliverables
- Optimized agent system
- Production deployment complete
- Monitoring and logging in place
- Full documentation

#### Branch: `v.2.25.1`

---

## Part 5: Agent Prompts & Configuration

### Market Data Analyst Prompt Template

```markdown
You are the Market Data Analyst for a professional trading firm.

Your role: Analyze real-time market data and classify current market conditions.

Context:
- Symbol: {symbol}
- Current Price: {current_price}
- VIX Level: {vix_level}
- Volume: {volume}
- Recent Price Action: {price_action_summary}

Tasks:
1. Classify market regime (Trending Up, Trending Down, Ranging, Volatile)
2. Assess volatility state (Low, Normal, High, Extreme)
3. Identify key support/resistance levels
4. Evaluate volume profile (Strong, Normal, Weak)
5. Provide confidence score (0-100)

Output format (JSON):
{
  "market_regime": "string",
  "volatility_state": "string",
  "support_level": number,
  "resistance_level": number,
  "volume_profile": "string",
  "key_observations": ["string"],
  "confidence": number
}

Be concise, data-driven, and objective.
```

### News & Sentiment Analyst Prompt Template

```markdown
You are the News & Sentiment Analyst for a professional trading firm.

Your role: Analyze market news and sentiment to assess potential market impact.

Context:
- Recent News: {news_items}
- Sentiment Indicators: {sentiment_data}
- Scheduled Events: {scheduled_events}

Tasks:
1. Classify overall sentiment (Bullish, Bearish, Neutral)
2. Score IV impact (0-10, where 10 is extreme market-moving news)
3. Identify macro level (1=low, 2=medium, 3=high, 4=extreme)
4. Assess breaking news risk
5. Provide confidence score (0-100)

Output format (JSON):
{
  "sentiment": "string",
  "iv_impact": number,
  "macro_level": number,
  "breaking_news_detected": boolean,
  "key_catalysts": ["string"],
  "risk_factors": ["string"],
  "confidence": number
}

Focus on market-moving information, not noise.
```

### Technical Analyst Prompt Template

```markdown
You are the Technical Analyst for a professional trading firm.

Your role: Analyze chart patterns and technical indicators to identify trading opportunities.

Context:
- Symbol: {symbol}
- Historical Data: {ohlcv_data}
- Indicators: {indicators}
- Timeframe: {timeframe}

Tasks:
1. Identify current trend (Uptrend, Downtrend, Sideways)
2. Detect chart patterns (Breakouts, Reversals, Continuations)
3. Assess technical indicators (RSI, MACD, Moving Averages)
4. Determine entry/exit levels
5. Provide confidence score (0-100)

Output format (JSON):
{
  "trend": "string",
  "patterns_detected": ["string"],
  "indicators_summary": {
    "rsi": number,
    "macd": "string",
    "moving_averages": "string"
  },
  "entry_level": number,
  "exit_level": number,
  "stop_loss": number,
  "confidence": number
}

Use objective technical analysis, avoid speculation.
```

### Bullish Researcher Prompt Template

```markdown
You are the Bullish Researcher for a professional trading firm.

Your role: Identify and argue for positive market scenarios based on analyst reports.

Context:
- Market Data Report: {market_data_report}
- News & Sentiment Report: {news_sentiment_report}
- Technical Report: {technical_report}

Tasks:
1. Extract all bullish signals from reports
2. Assess probability of upside scenarios
3. Identify catalysts for positive price movement
4. Counter bearish arguments (if in debate)
5. Provide confidence score (0-100)

Output format (JSON):
{
  "bullish_thesis": "string",
  "bullish_signals": ["string"],
  "upside_catalysts": ["string"],
  "probability_upside": number,
  "counterarguments_to_bears": ["string"],
  "confidence": number
}

Be rigorous but advocate for the bullish case.
```

### Bearish Researcher Prompt Template

```markdown
You are the Bearish Researcher for a professional trading firm.

Your role: Identify and argue for risk scenarios based on analyst reports.

Context:
- Market Data Report: {market_data_report}
- News & Sentiment Report: {news_sentiment_report}
- Technical Report: {technical_report}

Tasks:
1. Extract all bearish signals from reports
2. Assess probability of downside scenarios
3. Identify risk factors for negative price movement
4. Counter bullish arguments (if in debate)
5. Provide confidence score (0-100)

Output format (JSON):
{
  "bearish_thesis": "string",
  "bearish_signals": ["string"],
  "downside_risks": ["string"],
  "probability_downside": number,
  "counterarguments_to_bulls": ["string"],
  "confidence": number
}

Be rigorous but advocate for the bearish case.
```

### Trader Agent Prompt Template

```markdown
You are the Trader for a professional trading firm.

Your role: Synthesize all analyst and researcher reports to create a trading proposal.

Context:
- Market Data Report: {market_data_report}
- News & Sentiment Report: {news_sentiment_report}
- Technical Report: {technical_report}
- Bullish Research: {bullish_report}
- Bearish Research: {bearish_report}
- User's Active Strategies: {active_strategies}
- Account State: {account_state}

Tasks:
1. Evaluate which strategy (if any) is triggered
2. Determine optimal trade direction (long/short)
3. Calculate position size based on conviction
4. Set entry, stop loss, take profit levels
5. Provide full reasoning with report references
6. Assign confidence score (0-100)

Output format (JSON):
{
  "trade_recommended": boolean,
  "strategy_name": "string",
  "symbol": "string",
  "side": "long" | "short",
  "size": number,
  "entry_price": number,
  "stop_loss": number,
  "take_profit": number,
  "reasoning": "string",
  "analyst_references": ["string"],
  "confidence": number
}

Only recommend trades with high conviction. When in doubt, don't trade.
```

### Risk Manager Prompt Template

```markdown
You are the Risk Manager for a professional trading firm.

Your role: Final approval/rejection authority for all trading proposals.

Context:
- Trading Proposal: {trader_proposal}
- Account State: {account_state}
- Open Positions: {open_positions}
- Daily P&L: {daily_pnl}
- Risk Limits: {risk_limits}
- Breaking News: {breaking_news}

Tasks:
1. Validate proposal against risk rules (programmatic checks already done)
2. Assess market conditions for execution risk
3. Evaluate if risk/reward is favorable
4. Check for correlated positions
5. Make final decision: Approve, Reject, or Modify
6. Provide risk assessment report

Output format (JSON):
{
  "decision": "approved" | "rejected" | "modified",
  "risk_score": number,
  "rejection_reason": "string" | null,
  "modification_suggestions": {} | null,
  "risk_assessment": {
    "position_risk": "string",
    "market_risk": "string",
    "correlation_risk": "string",
    "overall_risk": "string"
  },
  "confidence": number
}

Prioritize capital preservation over profit. Reject aggressively when uncertain.
```

---

## Part 6: API Endpoints Summary

### New Agent API Endpoints

#### Analyst Reports
- `GET /api/agents/reports/market-data` - Latest market data analyst report
- `GET /api/agents/reports/news-sentiment` - Latest news & sentiment report
- `GET /api/agents/reports/technical` - Latest technical analyst report
- `GET /api/agents/reports/all` - All latest analyst reports

#### Researcher Debates
- `GET /api/agents/debates/latest` - Latest debate transcript
- `GET /api/agents/debates/:id` - Specific debate by ID
- `POST /api/agents/debates/trigger` - Manually trigger debate

#### Trading Proposals
- `POST /api/autopilot/propose` - Create proposal (now powered by agent pipeline)
- `GET /api/autopilot/proposals` - List proposals with agent reasoning
- `GET /api/autopilot/proposals/:id/reasoning` - Full agent reasoning chain
- `POST /api/autopilot/acknowledge` - Approve/reject proposal
- `POST /api/autopilot/execute` - Execute approved proposal

#### Risk Management
- `GET /api/agents/risk/assessment/:proposalId` - Risk assessment for proposal
- `GET /api/agents/risk/status` - Current risk status (limits, exposure)

#### Chat Interface
- `POST /api/ai/chat` - Send message to AI (with streaming)
- `GET /api/ai/conversations` - List user conversations
- `GET /api/ai/conversations/:id` - Get conversation history
- `POST /api/ai/conversations/:id/messages` - Add message to conversation

---

## Part 7: Success Criteria & KPIs

### Phase Completion Criteria

**Phase 1**: Foundation
- [ ] Zero 401 authentication errors
- [ ] RiskFlow feed stable with < 50 items
- [ ] Vercel AI SDK generating text successfully

**Phase 2**: Analysts
- [ ] 3 analyst agents producing reports
- [ ] Reports generated in < 10 seconds
- [ ] 90%+ uptime for analyst services

**Phase 3**: Researchers
- [ ] Debate completes in < 30 seconds
- [ ] Consensus score accurately reflects bullish/bearish balance
- [ ] Debate quality score > 7/10

**Phase 4**: Trader
- [ ] Trader agent generates valid proposals
- [ ] Proposals match enabled trading strategies
- [ ] Position sizing logic correct

**Phase 5**: Risk & Execution
- [ ] Risk manager correctly approves/rejects proposals
- [ ] ProjectX order execution succeeds > 95%
- [ ] Full pipeline completes in < 60 seconds

**Phase 6**: Chat
- [ ] Chat responds in < 5 seconds
- [ ] Conversation history persists correctly
- [ ] Agent reasoning queries work

**Phase 7**: Frontend
- [ ] All frontend components display agent data
- [ ] No UI errors or crashes
- [ ] User can complete full workflow (view analysis → approve proposal → execute)

**Phase 8**: Production
- [ ] System handles 100 concurrent users
- [ ] Agent pipeline cost < $0.50 per proposal
- [ ] 99% uptime over 1 week

### Key Performance Indicators

**Latency**:
- Market Data Analyst: < 5 seconds
- News & Sentiment Analyst: < 10 seconds
- Technical Analyst: < 5 seconds
- Debate: < 30 seconds
- Full pipeline: < 60 seconds

**Quality**:
- Analyst report confidence: > 70%
- Trader proposal confidence: > 60%
- Risk manager approval rate: 20-40% (reject most proposals)

**Reliability**:
- Agent uptime: > 99%
- API error rate: < 1%
- Database query success: > 99.9%

**Cost**:
- Average cost per proposal: < $0.50
- Daily AI API cost per user: < $5
- Monthly infrastructure cost: < $500

---

## Part 8: Risk Mitigation & Contingencies

### Technical Risks

**Risk 1: AI API Rate Limits**
- Mitigation: Implement caching, use multiple providers, add fallback models
- Contingency: Degrade to single-agent system if multi-agent fails

**Risk 2: Agent Pipeline Latency Too High**
- Mitigation: Parallel execution, caching, pre-computation
- Contingency: Reduce debate rounds, simplify analyst logic

**Risk 3: Database Performance Issues**
- Mitigation: Add indexes, optimize queries, use read replicas
- Contingency: Move to faster database tier on Neon

**Risk 4: ProjectX API Failures**
- Mitigation: Retry logic, error handling, fallback to manual execution
- Contingency: Disable autopilot, manual trading only

### Business Risks

**Risk 1: Agent Recommendations Perform Poorly**
- Mitigation: Extensive backtesting, paper trading phase, human oversight
- Contingency: Disable autopilot, revert to manual trading

**Risk 2: User Adoption Low**
- Mitigation: Clear UI, onboarding, education, demo mode
- Contingency: Keep old system as fallback

**Risk 3: Cost Overruns**
- Mitigation: Usage limits, tier-based access, cost monitoring
- Contingency: Reduce agent complexity, use cheaper models

### Security Risks

**Risk 1: Unauthorized Trade Execution**
- Mitigation: Human-in-the-loop, Clerk auth, audit trails
- Contingency: Emergency kill switch, rollback mechanism

**Risk 2: Data Breach**
- Mitigation: Encrypted secrets, secure database, minimal data retention
- Contingency: Incident response plan, user notification

---

## Part 9: Next Steps for Cursor Implementation

### Immediate Actions (This Session)

1. **Review this plan with user** - Get approval, clarify questions
2. **Prioritize phases** - Which phases are highest priority?
3. **Clarify requirements** - Answer open questions from handoff docs
4. **Create first branch** - `v.1.7.1` for Phase 1
5. **Start with auth fix** - Resolve 401 errors immediately

### Questions to Answer Before Starting

#### Authentication
- What is the exact `CLERK_SECRET_KEY` value? (from Clerk dashboard)
- Should we add retry backoff in frontend or backend?
- What rate limiting strategy? (exponential backoff, max retries)

#### AI Models
- Which AI models should we use? (GPT-4o, Claude Sonnet, o1-preview, etc.)
- Should we implement model selection dropdown for users?
- What's the budget for AI API costs per user/month?

#### Trading Strategies
- For each strategy (Morning Flush, VIX Fix, etc.), what are the exact entry criteria?
- Should all strategies be enabled by default, or user-selectable?
- What are the risk parameters per strategy? (max size, max loss, etc.)

#### Risk Management
- What are the daily loss limits? (per user tier)
- What are position size limits? (per strategy, per account)
- Should risk manager be AI-only, or allow human override?

#### Chat Interface
- Should chat have access to all agent reports, or summarized view?
- Should users be able to trigger manual agent analysis via chat?
- What's the expected chat response time? (< 5 seconds, < 10 seconds?)

#### Deployment
- Should we deploy to production incrementally, or all at once?
- What's the rollback strategy if something breaks?
- Should we use feature flags for gradual rollout?

---

## Part 10: Long-Term Vision

### Future Enhancements (Post-Phase 8)

**1. Advanced Agent Types**
- **Options Analyst**: IV analysis, Greeks, options strategies
- **Macro Economist**: GDP, inflation, interest rates, central bank policy
- **Sector Analyst**: Industry-specific analysis
- **Correlation Analyst**: Cross-asset correlations, hedging strategies

**2. Agent Learning & Improvement**
- Track agent performance over time
- Fine-tune agent prompts based on outcomes
- Implement reinforcement learning for agent optimization
- A/B testing for agent configurations

**3. Multi-User Collaboration**
- Share agent reports with other users
- Collaborative trading rooms
- Agent performance leaderboards
- Community-driven agent improvements

**4. Real-Time Agent Dashboard**
- Live view of agent activities
- Agent health monitoring
- Performance metrics visualization
- Agent "thinking" visualization (show reasoning process)

**5. Advanced Risk Management**
- Portfolio-level risk analysis
- Scenario analysis (what-if simulations)
- Stress testing
- Dynamic risk adjustment based on market conditions

**6. Integration with External Data**
- Earnings calendars
- Economic data releases
- Insider trading data
- Institutional positioning data

---

## Conclusion

This plan transforms Pulse from a single-agent "PriceBrain Layer" into a **collaborative multi-agent AI system** inspired by the TradingAgents framework. By breaking down the trading decision process into specialized agents (Analysts, Researchers, Trader, Risk Manager), we create a transparent, robust, and scalable system.

### Key Benefits

1. **Transparency**: Every trade has a full reasoning chain from analysts → debate → trader → risk
2. **Robustness**: Multiple perspectives reduce single-point-of-failure risks
3. **Scalability**: Add new agents without rewriting core system
4. **Human Control**: User has final approval, risk manager acts as safeguard
5. **Explainability**: Users can ask "Why?" and get detailed agent reasoning

### Timeline Summary

- **Week 1**: Fix auth, stabilize feed, set up AI SDK
- **Week 2**: Implement analyst agents
- **Week 3**: Implement researcher debate system
- **Week 4**: Implement trader agent, proposal generation
- **Week 5**: Implement risk manager, ProjectX execution
- **Week 6**: Implement chat interface
- **Week 7**: Frontend integration, testing
- **Week 8**: Optimization, production deployment

**Total: 8 weeks to fully functional collaborative AI system**

### Success Metrics

- Zero 401 errors
- News feed stable and functional
- AI chat working with conversation history
- Autopilot generating and executing trades
- Full agent pipeline operational
- User satisfaction high
- System cost-effective and scalable

**Let's build something great!** 🚀

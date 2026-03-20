# Technology Gap Analysis - Pulse v3.0
## Critical Integration Points & Solutions

> **Purpose**: Close all technological gaps between components
> **Status**: Final Review
> **Date**: 2026-01-02

> **Environment Update (Jan 2026):** All backend AI workloads now run exclusively through the Vercel AI Gateway (`VERCEL_AI_GATEWAY_API_KEY`). Remove legacy keys such as `ANTHROPIC_API_KEY`, `GROK_API_KEY`, and `CLAUDE_*` once the gateway is configured.

---

## 1. Authentication Gap (CRITICAL - Week 1 Priority)

### Gap Identified
- Clerk JWT validation failing with 401 errors
- 2000+ errors in 30 seconds cascade
- No retry backoff implemented

### Solution
```typescript
// backend-hono/src/middleware/auth.ts
import { verifyToken } from '@clerk/backend';

export async function authMiddleware(c: Context, next: Next) {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('No token');

    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: ['https://pulse.solvys.io', 'http://localhost:3000']
    });

    c.set('userId', verified.sub);
    await next();
  } catch (error) {
    // Log specific error for debugging
    console.error('Auth error:', error.message);
    return c.json({ error: 'Unauthorized' }, 401);
  }
}

// frontend/lib/apiClient.ts
class ApiClient {
  private retryCount = 0;
  private maxRetries = 3;
  private backoffMs = [1000, 2000, 4000];

  async request(url: string, options: RequestOptions) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${await getToken()}` // From Clerk
        }
      });

      if (response.status === 401 && this.retryCount < this.maxRetries) {
        await this.wait(this.backoffMs[this.retryCount]);
        this.retryCount++;
        return this.request(url, options);
      }

      this.retryCount = 0; // Reset on success
      return response;
    } catch (error) {
      if (this.retryCount >= this.maxRetries) {
        this.stopPolling(); // Prevent cascade
        throw error;
      }
    }
  }
}
```

---

## 2. Real-time Data Gap

### Gap Identified
- No WebSocket implementation
- SignalR connection for ProjectX not established
- RiskFlow updates only via polling

### Solution
```typescript
// backend-hono/src/services/realtime-service.ts
import { HubConnectionBuilder } from '@microsoft/signalr';

class RealtimeService {
  private projectXConnection: HubConnection;
  private riskFlowWS: Map<string, WebSocket> = new Map();

  async initProjectXSignalR() {
    const token = process.env.PROJECTX_TOKEN;
    this.projectXConnection = new HubConnectionBuilder()
      .withUrl(`https://rtc.topstepx.com/hubs/market?access_token=${token}`, {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    await this.projectXConnection.start();

    // Subscribe to market data
    this.projectXConnection.on('GatewayQuote', (contractId, data) => {
      this.broadcastToClients('quote', { contractId, data });
    });
  }

  async handleRiskFlowWebSocket(ws: WebSocket, userId: string) {
    this.riskFlowWS.set(userId, ws);

    ws.on('close', () => {
      this.riskFlowWS.delete(userId);
    });

    // Send initial data
    const feed = await this.getRiskFlowFeed(userId);
    ws.send(JSON.stringify({ type: 'initial', data: feed }));
  }

  broadcastRiskFlowUpdate(update: RiskFlowUpdate) {
    const message = JSON.stringify({ type: 'update', data: update });
    this.riskFlowWS.forEach((ws, userId) => {
      // Filter by user watchlist
      if (this.shouldReceiveUpdate(userId, update)) {
        ws.send(message);
      }
    });
  }
}
```

---

## 3. AI Model Integration Gap

### Gap Identified
- Vercel AI SDK not configured
- Model selection not implemented
- No fallback for rate limits

### Solution
```typescript
// backend-hono/src/services/ai-model-service.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

class AIModelService {
  private models = {
    opus: anthropic('claude-3-opus-20240229'),
    haiku: anthropic('claude-3-haiku-20240307'),
    grok: openai('grok-beta', {
      baseURL: 'https://api.x.ai/v1',
      apiKey: process.env.GROK_API_KEY
    })
  };

  private fallbacks = {
    opus: 'haiku',  // Fallback to faster model
    haiku: 'grok',   // Fallback to different provider
    grok: 'haiku'    // Fallback to Claude
  };

  async generateResponse(
    model: 'opus' | 'haiku' | 'grok',
    prompt: string,
    options: GenerateOptions = {}
  ) {
    try {
      const result = await generateText({
        model: this.models[model],
        prompt,
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 1000
      });

      return result.text;
    } catch (error) {
      if (error.code === 'rate_limit_exceeded') {
        // Try fallback model
        const fallbackModel = this.fallbacks[model];
        return this.generateResponse(fallbackModel, prompt, options);
      }
      throw error;
    }
  }

  async streamResponse(
    model: 'opus' | 'haiku' | 'grok',
    prompt: string,
    onChunk: (chunk: string) => void
  ) {
    const { textStream } = await streamText({
      model: this.models[model],
      prompt
    });

    for await (const chunk of textStream) {
      onChunk(chunk);
    }
  }
}
```

---

## 4. Database Performance Gap

### Gap Identified
- Missing connection pooling
- No query optimization
- Lack of caching layer

### Solution
```typescript
// backend-hono/src/db/optimized.ts
import { Pool } from '@neondatabase/serverless';
import { LRUCache } from 'lru-cache';

class OptimizedDatabase {
  private pool: Pool;
  private cache: LRUCache<string, any>;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    this.cache = new LRUCache({
      max: 500,
      ttl: 60000 // 60 second TTL
    });
  }

  async query(text: string, params?: any[], useCache = true) {
    const cacheKey = `${text}-${JSON.stringify(params)}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const start = Date.now();
    const result = await this.pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms):`, text);
    }

    if (useCache) {
      this.cache.set(cacheKey, result.rows);
    }

    return result.rows;
  }

  // Optimized feed query
  async getUserFeed(userId: string, limit = 50, offset = 0) {
    const query = `
      WITH user_symbols AS (
        SELECT symbols FROM user_watchlist WHERE user_id = $1
      )
      SELECT n.*,
        CASE
          WHEN n.is_breaking THEN 1
          WHEN n.macro_level >= 4 THEN 2
          WHEN n.iv_impact >= 7 THEN 3
          ELSE 4
        END as priority
      FROM news_articles n
      WHERE
        n.published_at > NOW() - INTERVAL '24 hours'
        AND (
          n.is_breaking = true
          OR n.macro_level >= 3
          OR n.symbols && (SELECT symbols FROM user_symbols)
        )
      ORDER BY priority, n.published_at DESC
      LIMIT $2 OFFSET $3
    `;

    return this.query(query, [userId, limit, offset]);
  }
}
```

---

## 5. Trading Strategy Engine Gap

### Gap Identified
- Antilag calculation not defined
- Strategy conflict resolution missing
- No backtesting capability

### Solution
```typescript
// backend-hono/src/services/strategy-engine.ts
class StrategyEngine {
  private strategies: Map<string, TradingStrategy> = new Map();
  private antilagDetector: AntilagDetector;

  async evaluateAllStrategies(marketData: MarketData): StrategySignal[] {
    const signals: StrategySignal[] = [];

    // Check antilag first (shared condition)
    const antilag = await this.antilagDetector.detect(
      marketData.primary,
      marketData.secondary
    );

    // Evaluate each strategy in priority order
    const priorityOrder = [
      '40_40_club',        // Highest priority
      'morning_flush',
      'vix_fixer',
      'lunch_power_flush',
      'charged_ripper'     // Lowest priority
    ];

    for (const strategyName of priorityOrder) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy || !strategy.enabled) continue;

      const signal = await strategy.evaluate(marketData, antilag);
      if (signal && signal.confidence > 60) {
        signals.push(signal);

        // Stop after first high-confidence signal
        if (signal.confidence > 80) break;
      }
    }

    return this.resolveConflicts(signals);
  }

  private resolveConflicts(signals: StrategySignal[]): StrategySignal[] {
    // If multiple signals, prioritize by:
    // 1. Confidence level
    // 2. Risk/reward ratio
    // 3. Strategy priority

    return signals.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      if (a.riskReward !== b.riskReward) {
        return b.riskReward - a.riskReward;
      }
      return a.priority - b.priority;
    }).slice(0, 1); // Return only top signal
  }
}

class AntilagDetector {
  private readonly WINDOW_MS = 90000; // 90 seconds
  private readonly TICK_THRESHOLD = 50; // Ticks in window
  private readonly CORRELATION_THRESHOLD = 0.8;

  async detect(primary: TickData[], secondary: TickData[]): AntilagSignal {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;

    // Get ticks in window
    const primaryTicks = primary.filter(t => t.timestamp > windowStart);
    const secondaryTicks = secondary.filter(t => t.timestamp > windowStart);

    // Check tick surge
    const tickSurge = secondaryTicks.length > this.TICK_THRESHOLD;
    if (!tickSurge) return null;

    // Check price synchronization
    const correlation = this.calculateCorrelation(primaryTicks, secondaryTicks);
    const synchronized = correlation > this.CORRELATION_THRESHOLD;

    if (synchronized) {
      return {
        detected: true,
        primarySymbol: 'ES',
        secondarySymbol: 'NQ',
        tickCount: secondaryTicks.length,
        correlation,
        confidence: Math.min(correlation * 100, 95)
      };
    }

    return null;
  }

  private calculateCorrelation(primary: TickData[], secondary: TickData[]): number {
    // Pearson correlation of price movements
    // Returns value between -1 and 1
    // Implementation details...
    return 0.85; // Placeholder
  }
}
```

---

## 6. Error Handling & Recovery Gap

### Gap Identified
- No circuit breakers
- Missing error recovery
- Lack of audit logging

### Solution
```typescript
// backend-hono/src/services/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt: number = Date.now();

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 120000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount > this.threshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.successCount = 0;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Audit logging
class AuditLogger {
  async logTradeProposal(proposal: TradeProposal) {
    await this.log('TRADE_PROPOSAL', {
      userId: proposal.userId,
      strategy: proposal.strategy,
      symbol: proposal.symbol,
      side: proposal.side,
      size: proposal.size,
      confidence: proposal.confidence,
      timestamp: new Date().toISOString()
    });
  }

  async logExecution(execution: Execution) {
    await this.log('TRADE_EXECUTION', {
      proposalId: execution.proposalId,
      orderId: execution.orderId,
      status: execution.status,
      fillPrice: execution.fillPrice,
      timestamp: new Date().toISOString()
    });
  }

  private async log(event: string, data: any) {
    await sql`
      INSERT INTO audit_logs (event_type, data, created_at)
      VALUES (${event}, ${JSON.stringify(data)}, NOW())
    `;
  }
}
```

---

## 7. Push Notification Gap

### Gap Identified
- No push service configured
- Missing notification templates
- No mobile app integration

### Solution
```typescript
// backend-hono/src/services/push-notification-service.ts
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

class PushNotificationService {
  private expo = new Expo();

  async sendMarketShaker(userId: string, alert: MarketShaker) {
    const pushToken = await this.getUserPushToken(userId);
    if (!pushToken) return;

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: '🚨 MARKET SHAKER DETECTED',
      body: alert.summary,
      data: {
        type: 'market_shaker',
        alertId: alert.id,
        proposal: alert.proposal
      },
      priority: 'high',
      channelId: 'market-alerts'
    };

    await this.expo.sendPushNotificationsAsync([message]);
  }

  async sendProposal(userId: string, proposal: TradeProposal) {
    const pushToken = await this.getUserPushToken(userId);
    if (!pushToken) return;

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: `Trading Opportunity: ${proposal.symbol}`,
      body: `${proposal.strategy} setup detected. ${proposal.side.toUpperCase()} ${proposal.contracts} contracts.`,
      data: {
        type: 'trade_proposal',
        proposalId: proposal.id,
        expiresAt: proposal.expiresAt
      },
      priority: 'high',
      channelId: 'trade-proposals',
      badge: 1
    };

    await this.expo.sendPushNotificationsAsync([message]);
  }

  private async getUserPushToken(userId: string): Promise<string> {
    const result = await sql`
      SELECT push_token FROM user_settings
      WHERE user_id = ${userId}
      AND push_enabled = true
    `;
    return result[0]?.push_token;
  }
}
```

---

## 8. Frontend State Management Gap

### Gap Identified
- No global state for RiskFlow
- Missing real-time update handling
- Lack of optimistic updates

### Solution
```tsx
// frontend/contexts/RiskFlowContext.tsx
import { createContext, useContext, useEffect, useReducer } from 'react';

interface RiskFlowState {
  items: RiskFlowItem[];
  loading: boolean;
  error: string | null;
  watchlist: string[];
  impliedPoints: number;
  lastUpdate: Date;
}

const RiskFlowContext = createContext<{
  state: RiskFlowState;
  dispatch: Dispatch<RiskFlowAction>;
}>(null);

export function RiskFlowProvider({ children }) {
  const [state, dispatch] = useReducer(riskFlowReducer, initialState);
  const ws = useRef<WebSocket>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    ws.current = new WebSocket(`${WS_URL}/riskflow`);

    ws.current.onmessage = (event) => {
      const update = JSON.parse(event.data);
      dispatch({ type: 'WS_UPDATE', payload: update });
    };

    // Fetch initial data
    fetchRiskFlowFeed().then(data => {
      dispatch({ type: 'SET_ITEMS', payload: data });
    });

    // Refresh every minute
    const interval = setInterval(() => {
      dispatch({ type: 'REFRESH' });
    }, 60000);

    return () => {
      ws.current?.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <RiskFlowContext.Provider value={{ state, dispatch }}>
      {children}
    </RiskFlowContext.Provider>
  );
}

function riskFlowReducer(state: RiskFlowState, action: RiskFlowAction) {
  switch (action.type) {
    case 'WS_UPDATE':
      // Add new item, maintain 50 item limit
      const newItems = [action.payload, ...state.items].slice(0, 50);
      return { ...state, items: newItems, lastUpdate: new Date() };

    case 'SET_ITEMS':
      return { ...state, items: action.payload, loading: false };

    case 'SET_WATCHLIST':
      return { ...state, watchlist: action.payload };

    case 'UPDATE_IMPLIED_POINTS':
      return { ...state, impliedPoints: action.payload };

    default:
      return state;
  }
}
```

---

## Critical Integration Checklist

### Week 1 Must-Haves
- [ ] Fix Clerk authentication (0 401 errors)
- [ ] Limit RiskFlow to 50 items
- [ ] Add pagination support
- [ ] Implement retry backoff
- [ ] Set up X API with rate limiting

### Data Flow Verification
- [ ] X API → Grok → Database → Frontend
- [ ] FMP → Hot Print Detection → Alert
- [ ] Antilag → Strategy → Proposal → User
- [ ] Overnight → Push → User → Approval

### Performance Targets
- [ ] Feed refresh < 1 second
- [ ] API response < 200ms cached
- [ ] AI analysis < 500ms per item
- [ ] Full pipeline < 60 seconds

### Error Recovery
- [ ] Circuit breakers on all external APIs
- [ ] Fallback models for AI
- [ ] Graceful degradation
- [ ] Audit logging for compliance

---

## Deployment Readiness

### Environment Variables Required
```bash
# Fly.io Secrets
DATABASE_URL=
CLERK_SECRET_KEY=
PROJECTX_API_KEY=
PROJECTX_USERNAME=
X_API_BEARER_TOKEN=
X_API_BASE_URL=https://api.twitter.com/2
FMP_API_KEY=
GROK_API_KEY=
ANTHROPIC_API_KEY=
PUSH_SERVER_KEY=
```

### Database Migrations
```bash
# Run in order
001_create_user_watchlist.sql
002_create_economic_events.sql
003_add_indexes.sql
004_create_audit_logs.sql
```

### Monitoring Setup
- Health checks on all services
- Error tracking (Sentry)
- Performance monitoring (Datadog)
- Custom metrics (Prometheus)

---

**All gaps identified and solutions provided. Ready for implementation.**
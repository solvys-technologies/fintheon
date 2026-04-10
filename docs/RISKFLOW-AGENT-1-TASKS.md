# RiskFlow Implementation Tasks - Agent 1 (Cursor)

## Backend Infrastructure & Data Pipeline

> **Agent**: Cursor
> **Focus**: RiskFlow backend infrastructure, X API integration, FMP economics, data pipeline
> **Priority**: CRITICAL - Must be fast, competitive, and powerful

---

## Week 1: RiskFlow Core Infrastructure

### Fix Authentication & Feed Stability (Days 1-2)

- [ ] Fix Clerk JWT verification in `auth.ts`
- [ ] Implement exponential backoff for 401 errors
- [ ] Add rate limiting middleware to prevent cascades
- [ ] Fix mock data generator - limit to 50 items MAX
- [ ] Implement proper pagination:
  ```typescript
  interface FeedPagination {
    limit: number; // max 50
    offset: number; // for pagination
    after?: string; // timestamp cursor
    symbols?: string[]; // user watchlist
  }
  ```

### Database Optimization (Day 3)

- [ ] Create optimal indexes for RiskFlow:

  ```sql
  -- Performance indexes
  CREATE INDEX idx_news_published_desc ON news_articles(published_at DESC);
  CREATE INDEX idx_news_breaking ON news_articles(is_breaking);
  CREATE INDEX idx_news_macro_level ON news_articles(macro_level);
  CREATE INDEX idx_news_symbols ON news_articles USING GIN(symbols);
  CREATE INDEX idx_news_iv_impact ON news_articles(iv_impact DESC);

  -- User watchlist
  CREATE TABLE user_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    symbols JSONB NOT NULL,
    alert_thresholds JSONB,
    overnight_monitoring BOOLEAN DEFAULT false,
    custom_alerts JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
  );

  -- Economic events table
  CREATE TABLE economic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10),
    impact_level VARCHAR(20), -- 'low', 'medium', 'high'
    actual DECIMAL(10,2),
    forecast DECIMAL(10,2),
    previous DECIMAL(10,2),
    release_time TIMESTAMP NOT NULL,
    is_hot_print BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

### X API Integration (Days 4-5)

- [ ] Create `backend-hono/src/services/x-api-service.ts`:

  ```typescript
  class XApiService {
    private rateLimiter: RateLimiter;
    private sources = ["FinancialJuice", "InsiderWire"];

    async fetchLatestTweets(): Promise<Tweet[]> {
      // Implement with rate limiting
      // Handle 429 errors gracefully
    }

    async parseNewsFromTweet(tweet: Tweet): NewsArticle {
      // Extract title, content, symbols
      // Detect breaking news patterns
    }
  }
  ```

- [ ] Implement rate limiting for X API:
  - 300 requests per 15 minutes (Free tier)
  - Queue system for requests
  - Exponential backoff on 429
- [ ] Set up dual-source fetching:
  - @FinancialJuice: Market news
  - @InsiderWire: Breaking developments
- [ ] Parse tweet formats:
  - Extract symbols (e.g., $SPY, $QQQ)
  - Identify economic prints
  - Detect "BREAKING" patterns

---

## Week 2: FMP Economics Integration

### FMP API Setup (Days 1-2)

- [ ] Create `backend-hono/src/services/fmp-service.ts`:

  ```typescript
  class FMPService {
    private apiKey: string = process.env.FMP_API_KEY;

    async getEconomicCalendar(date: string): Promise<EconomicEvent[]> {
      // Fetch calendar for date
    }

    async getLatestPrints(): Promise<EconomicPrint[]> {
      // Get recent releases
    }

    async detectHotPrint(event: EconomicEvent): boolean {
      // Check if print deviates significantly
      const deviation =
        Math.abs(event.actual - event.forecast) / event.forecast;
      return deviation > 0.1; // 10% deviation = hot
    }
  }
  ```

- [ ] Implement economic event monitoring:
  - Poll every 1 minute during market hours
  - Check for new releases
  - Compare actual vs forecast
- [ ] Hot print detection logic:
  - CPI/PPI > 0.2% deviation
  - NFP > 50k deviation
  - Fed rate decision != consensus
  - GDP > 0.5% deviation

### Data Fusion Pipeline (Days 3-4)

- [ ] Create unified news processor:

  ```typescript
  class NewsProcessor {
    async processIncomingData(source: "X" | "FMP", data: any): NewsArticle {
      // Standardize format
      // Extract key information
      // Assign initial macro level
    }

    async detectCorrelations(articles: NewsArticle[]): void {
      // Find related news
      // Group by theme
      // Identify market movers
    }
  }
  ```

- [ ] Implement deduplication:
  - Check for similar headlines
  - Merge duplicate events
  - Prioritize official sources

### Real-time Feed Engine (Day 5)

- [ ] Create `backend-hono/src/services/riskflow-engine.ts`:

  ```typescript
  class RiskFlowEngine {
    private refreshInterval = 60000; // 1 minute
    private cache: LRUCache;

    async start() {
      setInterval(() => this.refresh(), this.refreshInterval);
    }

    async refresh() {
      // Fetch from X API
      // Fetch from FMP
      // Process through AI
      // Store in database
      // Notify subscribers
    }

    async getUserFeed(userId: string, options: FeedOptions): RiskFlowItem[] {
      // Get user watchlist
      // Filter by symbols
      // Apply IV thresholds
      // Sort by importance
    }
  }
  ```

---

## Week 3: Performance & Caching

### Caching Layer (Days 1-2)

- [ ] Implement in-memory caching:

  ```typescript
  class RiskFlowCache {
    private feedCache: Map<string, CachedFeed> = new Map();
    private TTL = 60000; // 60 seconds

    async getFeed(userId: string): Promise<RiskFlowItem[]> {
      const cached = this.feedCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.TTL) {
        return cached.items;
      }
      return null;
    }

    async setFeed(userId: string, items: RiskFlowItem[]): void {
      this.feedCache.set(userId, {
        items,
        timestamp: Date.now(),
      });
    }
  }
  ```

- [ ] Add Redis caching (optional):
  - User feed cache (60s TTL)
  - Economic events (5min TTL)
  - Symbol mappings (1hr TTL)

### Query Optimization (Day 3)

- [ ] Optimize database queries:
  ```sql
  -- Optimized feed query
  CREATE OR REPLACE FUNCTION get_user_feed(
    p_user_id VARCHAR,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
  ) RETURNS TABLE(...) AS $$
  BEGIN
    RETURN QUERY
    WITH user_symbols AS (
      SELECT symbols FROM user_watchlist WHERE user_id = p_user_id
    )
    SELECT n.*
    FROM news_articles n
    WHERE
      (n.macro_level >= 3 OR n.is_breaking = true)
      OR n.symbols && (SELECT symbols FROM user_symbols)
    ORDER BY
      CASE WHEN n.is_breaking THEN 0 ELSE 1 END,
      n.iv_impact DESC,
      n.published_at DESC
    LIMIT p_limit OFFSET p_offset;
  END;
  $$ LANGUAGE plpgsql;
  ```

### WebSocket Support (Days 4-5)

- [ ] Add real-time updates:

  ```typescript
  class RiskFlowWebSocket {
    async handleConnection(ws: WebSocket, userId: string) {
      // Subscribe to user's feed
      // Send initial data
      // Push updates on refresh
    }

    async broadcast(update: RiskFlowUpdate) {
      // Send to relevant subscribers
      // Filter by user watchlist
    }
  }
  ```

---

## Week 4: Overnight Monitoring & Alerts

### Overnight Watch System (Days 1-3)

- [ ] Create `backend-hono/src/services/overnight-monitor.ts`:

  ```typescript
  class OvernightMonitor {
    private watchList: Map<string, WatchConfig> = new Map();

    async addWatch(userId: string, config: WatchConfig) {
      // User configures what to watch
      // e.g., "war news", "bank failures", "rate changes"
    }

    async monitorFeeds() {
      // Run every 5 minutes overnight
      // Check for matching patterns
      // Trigger alerts if found
    }

    async checkForMarketShakers(articles: NewsArticle[]): Alert[] {
      // Identify major events
      // Calculate potential impact
      // Generate alert with proposal
    }
  }
  ```

### Push Notification System (Days 4-5)

- [ ] Implement push notifications:

  ```typescript
  class PushNotificationService {
    async sendAlert(userId: string, alert: Alert) {
      // Send to mobile app
      // Include proposal details
      // Quick approve/reject actions
    }

    async sendProposal(userId: string, proposal: TradingProposal) {
      // Format for push
      // Include key metrics
      // Time-sensitive flag
    }
  }
  ```

- [ ] Create notification templates:
  - Breaking news alert
  - Hot print notification
  - Overnight market shaker
  - Trading proposal ready

---

## Week 5: User Customization & Intelligence

### User Watchlist Management (Days 1-2)

- [ ] Create watchlist API:
  ```typescript
  // POST /api/riskflow/watchlist
  interface WatchlistUpdate {
    symbols: string[]; // Primary symbols
    alertThresholds: {
      ivImpact: number; // Min IV to alert
      macroLevel: number; // Min macro level
    };
    customAlerts: {
      keywords: string[]; // "war", "crash", etc
      patterns: string[]; // Regex patterns
    };
    overnightMonitoring: boolean;
  }
  ```

### Implied Points Ticker (Days 3-4)

- [ ] Create daily performance tracker:

  ```typescript
  class ImpliedPointsTracker {
    private dailyPoints = 0;
    private contributions: PointContribution[] = [];

    async calculateDailyPoints(): number {
      // Sum all implied points from news
      // Weight by accuracy/outcome
      // Return net impact
    }

    async getTickerValue(): string {
      // Format for display
      // e.g., "+15.5 pts" or "-8.2 pts"
    }
  }
  ```

### Smart Feed Ranking (Day 5)

- [ ] Implement intelligent sorting:
  ```typescript
  class FeedRanker {
    async rankItems(items: RiskFlowItem[], user: UserProfile): RiskFlowItem[] {
      return items.sort((a, b) => {
        // Priority factors:
        // 1. Breaking news
        // 2. User watchlist match
        // 3. IV impact score
        // 4. Macro level
        // 5. Recency
        // 6. Symbol relevance
      });
    }
  }
  ```

---

## Critical Performance Requirements

### Speed Targets

- Feed refresh: < 1 second processing
- API response: < 200ms (cached)
- Database query: < 50ms
- X API fetch: < 2 seconds
- FMP fetch: < 1 second

### Reliability Targets

- 99.9% uptime
- Zero data loss
- Graceful degradation on API failures
- Automatic recovery from errors

### Scale Targets

- Handle 1000+ concurrent users
- Process 10,000+ news items/day
- Store 1M+ historical articles
- Support 100+ symbols per user

---

## Testing Checklist

### Unit Tests

- [ ] X API service tests
- [ ] FMP service tests
- [ ] News processor tests
- [ ] Cache layer tests
- [ ] Watchlist management tests

### Integration Tests

- [ ] End-to-end feed refresh
- [ ] User watchlist filtering
- [ ] Overnight monitoring
- [ ] Push notifications
- [ ] Database performance

### Load Tests

- [ ] 1000 concurrent users
- [ ] 100 requests/second
- [ ] 24-hour stability test
- [ ] API rate limit handling

---

## Success Metrics

### Week 1

✅ Authentication working (0 errors)
✅ Feed limited to 50 items
✅ X API integrated with both sources
✅ Database optimized with indexes

### Week 2

✅ FMP economics integrated
✅ Hot prints detected automatically
✅ Feed refreshes every 60 seconds
✅ Data fusion working correctly

### Week 3

✅ Response times < 200ms
✅ Caching reduces DB load 80%
✅ WebSocket updates working
✅ Query performance optimized

### Week 4

✅ Overnight monitoring active
✅ Push notifications working
✅ Market shakers detected
✅ Proposals generated from alerts

### Week 5

✅ User watchlists functional
✅ Implied points tracking
✅ Smart feed ranking
✅ Full customization options

---

## Dependencies

### Required from Agent 2

- Grok analysis results format
- IV scoring methodology
- Sentiment classification
- Hot print criteria

### External Requirements

- X API credentials valid
- FMP API key configured
- Push notification service
- WebSocket infrastructure

---

**CRITICAL: This must be FAST, COMPETITIVE, and POWERFUL. No compromises on performance.**

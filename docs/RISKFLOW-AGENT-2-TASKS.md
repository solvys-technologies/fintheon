# RiskFlow Implementation Tasks - Agent 2 (Claude Code)

## AI Analysis & Intelligence Layer

> **Agent**: Claude Code
> **Focus**: Grok integration for news analysis, IV scoring, sentiment analysis, overnight intelligence
> **Priority**: CRITICAL - Must properly parse and interpret financial headlines

---

## Week 1: Grok Integration for News Analysis

### Setup Grok AI Service (Days 1-2)

- [ ] Create `backend-hono/src/services/grok-service.ts`:

  ```typescript
  class GrokService {
    private model = "grok-latest";
    private apiKey = process.env.GROK_API_KEY;

    async analyzeNewsBatch(articles: RawArticle[]): Promise<AnalyzedArticle[]> {
      // Batch process for efficiency
      // Max 10 articles per request
    }

    async parseFinancialHeadline(headline: string): Promise<ParsedNews> {
      // Extract key information:
      // - Affected instruments
      // - Action/event type
      // - Magnitude/numbers
      // - Timing
    }

    async detectHotPrint(text: string): Promise<HotPrintAnalysis> {
      // Identify economic data
      // Compare to expectations
      // Flag significant deviations
    }
  }
  ```

### Financial Headline Parser (Days 3-4)

- [ ] Implement sophisticated parsing:

  ```typescript
  interface HeadlineParsing {
    // Example: "BREAKING: FED RAISES RATES BY 50 BPS, MARKETS TUMBLE"
    parseBreaking(text: string): {
      isBreaking: boolean;
      urgency: "immediate" | "high" | "normal";
    };

    parseEntity(text: string): {
      entity: string; // "FED"
      action: string; // "RAISES"
      target: string; // "RATES"
      magnitude: number; // 50
      unit: string; // "BPS"
    };

    parseMarketReaction(text: string): {
      direction: "up" | "down" | "mixed";
      intensity: "mild" | "moderate" | "severe";
    };

    parseSymbols(text: string): string[]; // ["SPY", "QQQ", "TLT"]
  }
  ```

### @FinancialJuice Format Handler (Day 5)

- [ ] Create specialized parser for FinancialJuice tweets:

  ```typescript
  class FinancialJuiceParser {
    patterns = {
      economicData:
        /(\w+)\s+(\w+):\s+Actual\s+([\d.]+%?)\s+vs\s+Expected\s+([\d.]+%?)/,
      breaking: /^BREAKING:|^JUST IN:|^ALERT:/,
      fedSpeak: /FED|FOMC|POWELL|YELLEN/i,
      earnings: /EARNINGS|EPS|REVENUE|BEAT|MISS/i,
      geopolitical: /WAR|CONFLICT|SANCTIONS|TENSIONS/i,
    };

    async parse(tweet: string): NewsItem {
      // Match against patterns
      // Extract structured data
      // Assign initial IV impact
    }
  }
  ```

---

## Week 2: IV Scoring & Sentiment Analysis

### IV Impact Scoring System (Days 1-3)

- [ ] Implement IV scoring algorithm:

  ```typescript
  class IVScoringEngine {
    private baseWeights = {
      fedDecision: 10,      // Max impact
      cpiPrint: 8,
      nfpPrint: 7,
      gdpPrint: 6,
      earnings: 5,
      geopolitical: 8,
      bankingCrisis: 9,
      technicalBreak: 4
    };

    async scoreNewsItem(item: AnalyzedNews): number {
      let score = 0;

      // Base score from event type
      score = this.baseWeights[item.eventType] || 3;

      // Adjust for magnitude
      if (item.deviation > 20) score += 2;
      if (item.deviation > 50) score += 3;

      // Adjust for market timing
      if (this.isPreMarket()) score += 1;
      if (this.isDuringFOMC()) score += 2;

      // Cap at 10
      return Math.min(score, 10);
    }

    async calculateMarketImpact(score: number): ImpliedPoints {
      // Convert IV score to implied ES/NQ points
      const multiplier = {
        1-3: 5,    // 5-15 points
        4-6: 10,   // 40-60 points
        7-8: 20,   // 140-160 points
        9-10: 40   // 360-400 points
      };
    }
  }
  ```

### Sentiment Classification (Days 4-5)

- [ ] Create multi-dimensional sentiment analyzer:

  ```typescript
  class SentimentAnalyzer {
    async analyzeSentiment(text: string): SentimentResult {
      const prompt = `
        Analyze this financial news for market sentiment:
        "${text}"
  
        Return JSON:
        {
          "overall": "bullish" | "bearish" | "neutral",
          "confidence": 0-100,
          "factors": {
            "economic": "positive" | "negative" | "neutral",
            "technical": "positive" | "negative" | "neutral",
            "geopolitical": "positive" | "negative" | "neutral"
          },
          "timeframe": "immediate" | "short" | "medium" | "long",
          "affectedSectors": ["tech", "financials", etc]
        }
      `;

      return await grok.analyze(prompt);
    }

    async detectMarketRegime(articles: NewsArticle[]): MarketRegime {
      // Analyze collection of news
      // Identify prevailing themes
      // Determine market regime:
      // - Risk-on
      // - Risk-off
      // - Uncertain
      // - Transitioning
    }
  }
  ```

---

## Week 3: Tape Checking & NTN Reports

### "Check the Tape" Implementation (Days 1-2)

- [ ] Create tape analysis system:

  ```typescript
  class TapeChecker {
    async checkTape(timeWindow: number = 3600000): TapeReport {
      // Get last hour of news
      const recentNews = await this.getRecentNews(timeWindow);

      // Group by themes
      const themes = this.identifyThemes(recentNews);

      // Identify key drivers
      const drivers = this.findMarketDrivers(themes);

      // Generate NTN (Note to Trader)
      return {
        summary: this.generateSummary(themes, drivers),
        keyThemes: themes,
        marketDrivers: drivers,
        sentiment: this.aggregateSentiment(recentNews),
        actionableInsights: this.extractActionable(drivers),
      };
    }

    private identifyThemes(news: NewsArticle[]): Theme[] {
      // Cluster similar news
      // Identify recurring topics
      // Weight by importance
    }
  }
  ```

### NTN Report Generator (Days 3-4)

- [ ] Create concise trading notes:

  ```typescript
  class NTNGenerator {
    async generateDailyNTN(): string {
      const template = `
        MARKET DRIVERS TODAY:
        {drivers}
  
        KEY RISKS:
        {risks}
  
        OPPORTUNITIES:
        {opportunities}
  
        WATCH FOR:
        {watchItems}
  
        SENTIMENT: {sentiment}
        IV ENVIRONMENT: {ivLevel}
      `;

      // Fill template with analysis
      // Keep under 200 words
      // Focus on actionable info
    }

    async generateFlashNTN(event: BreakingNews): string {
      // Quick 2-3 sentence summary
      // Immediate action required?
      // Expected market reaction
    }
  }
  ```

### Hot Print Detection (Day 5)

- [ ] Implement economic print analyzer:

  ```typescript
  class HotPrintDetector {
    private thresholds = {
      CPI: { deviation: 0.2, impact: "high" },
      NFP: { deviation: 50000, impact: "high" },
      GDP: { deviation: 0.5, impact: "medium" },
      RETAIL: { deviation: 0.3, impact: "medium" },
    };

    async detectHotPrint(event: EconomicEvent): HotPrint | null {
      const threshold = this.thresholds[event.type];
      if (!threshold) return null;

      const deviation = Math.abs(event.actual - event.forecast);
      const isHot = deviation > threshold.deviation;

      if (isHot) {
        return {
          event: event.type,
          actual: event.actual,
          forecast: event.forecast,
          deviation: deviation,
          direction: event.actual > event.forecast ? "above" : "below",
          impact: threshold.impact,
          tradingImplication: this.getImplication(event),
        };
      }
    }
  }
  ```

---

## Week 4: Overnight Intelligence System

### Overnight Monitoring AI (Days 1-3)

- [ ] Create overnight watch system:

  ```typescript
  class OvernightIntelligence {
    private watchPatterns: WatchPattern[] = [];

    async addWatchPattern(userId: string, pattern: WatchPattern) {
      // User defines what to watch
      // e.g., "war escalation", "bank failure", "surprise rate cut"
      this.watchPatterns.push({
        userId,
        pattern: pattern.regex,
        keywords: pattern.keywords,
        severity: pattern.severity,
        action: pattern.proposedAction,
      });
    }

    async monitorOvernight() {
      // Run every 5 minutes from 4pm-9am ET
      const news = await this.fetchGlobalNews();

      for (const item of news) {
        const matches = this.checkPatterns(item);
        if (matches.length > 0) {
          await this.triggerAlert(matches, item);
        }
      }
    }

    async assessMarketShaker(news: NewsItem): MarketShakerAssessment {
      // Use Grok to assess severity
      // Predict market open reaction
      // Generate pre-market proposal
    }
  }
  ```

### Charged Up Ripper Detector (Days 4-5)

- [ ] Implement pattern recognition for charged markets:

  ```typescript
  class ChargedMarketDetector {
    async detectChargedConditions(news: NewsArticle[]): ChargedMarket | null {
      // Look for:
      // - Multiple correlated high-impact news
      // - Escalating situation (war, crisis)
      // - Surprise policy changes
      // - Black swan events

      const signals = {
        newsVelocity: this.calculateNewsVelocity(news),
        sentimentShift: this.detectSentimentShift(news),
        correlatedEvents: this.findCorrelatedEvents(news),
        unexpectedEvents: this.identifyUnexpected(news),
      };

      if (this.isCharged(signals)) {
        return {
          chargeLevel: this.calculateChargeLevel(signals),
          triggers: this.identifyTriggers(news),
          expectedVolatility: this.predictVolatility(signals),
          tradingStrategy: "CHARGED_UP_RIPPER",
          entry: this.suggestEntry(signals),
        };
      }
    }
  }
  ```

---

## Week 5: Integration & Intelligence Layer

### Collaborative AI Integration (Days 1-2)

- [ ] Connect to News & Sentiment Analyst:

  ```typescript
  class NewsSentimentAnalyst {
    private grok: GrokService;
    private ivScorer: IVScoringEngine;
    private sentimentAnalyzer: SentimentAnalyzer;

    async analyzeRiskFlowItem(item: RawNews): AnalystReport {
      // Parse with Grok
      const parsed = await this.grok.parseFinancialHeadline(item.text);

      // Score IV impact
      const ivScore = await this.ivScorer.scoreNewsItem(parsed);

      // Analyze sentiment
      const sentiment = await this.sentimentAnalyzer.analyzeSentiment(
        item.text,
      );

      // Detect hot prints
      const hotPrint = await this.detectHotPrint(parsed);

      // Check for charged market
      const charged = await this.checkChargedConditions(parsed);

      return {
        parsed,
        ivScore,
        sentiment,
        hotPrint,
        charged,
        ntn: await this.generateNTN(parsed, sentiment),
        tradingImplications: this.deriveImplications(ivScore, sentiment),
      };
    }
  }
  ```

### Implied Points Calculation (Days 3-4)

- [ ] Create daily performance predictor:

  ```typescript
  class ImpliedPointsCalculator {
    async calculateDailyImplied(news: AnalyzedNews[]): ImpliedPoints {
      let bullishPoints = 0;
      let bearishPoints = 0;

      for (const item of news) {
        const points = this.newsToPoints(item);
        if (points > 0) bullishPoints += points;
        else bearishPoints += Math.abs(points);
      }

      return {
        net: bullishPoints - bearishPoints,
        bullish: bullishPoints,
        bearish: bearishPoints,
        confidence: this.calculateConfidence(news),
        drivers: this.identifyDrivers(news),
      };
    }

    private newsToPoints(news: AnalyzedNews): number {
      // Convert IV score to ES points
      const basePoints = news.ivScore * 5; // 5 points per IV level

      // Adjust for sentiment
      const sentimentMultiplier =
        news.sentiment === "bullish"
          ? 1
          : news.sentiment === "bearish"
            ? -1
            : 0;

      // Adjust for confidence
      const confidence = news.confidence / 100;

      return basePoints * sentimentMultiplier * confidence;
    }
  }
  ```

### Performance Monitoring (Day 5)

- [ ] Track analysis accuracy:

  ```typescript
  class AnalysisAccuracyTracker {
    async trackPrediction(prediction: Prediction): void {
      // Store prediction
      await this.storePrediction(prediction);

      // Schedule outcome check
      setTimeout(() => this.checkOutcome(prediction), prediction.timeframe);
    }

    async checkOutcome(prediction: Prediction): void {
      // Get actual market movement
      const actual = await this.getMarketMovement(prediction.timestamp);

      // Calculate accuracy
      const accuracy = this.calculateAccuracy(prediction, actual);

      // Update model weights
      await this.updateWeights(accuracy);
    }

    async getAccuracyMetrics(): AccuracyReport {
      return {
        ivScoringAccuracy: this.getIVAccuracy(),
        sentimentAccuracy: this.getSentimentAccuracy(),
        impliedPointsAccuracy: this.getPointsAccuracy(),
        hotPrintDetection: this.getHotPrintAccuracy(),
      };
    }
  }
  ```

---

## Critical Quality Requirements

### Parsing Accuracy

- Must correctly parse 95%+ of FinancialJuice tweets
- Must identify 100% of hot economic prints
- Must detect breaking news within 10 seconds
- Zero false positives on market shakers

### Analysis Speed

- Single news item: < 500ms
- Batch of 10: < 2 seconds
- Tape check report: < 3 seconds
- Overnight scan: < 30 seconds

### Intelligence Quality

- IV scoring correlation with actual volatility > 0.7
- Sentiment accuracy > 80%
- Hot print detection 100%
- Implied points within 20% of actual

---

## Testing Requirements

### Unit Tests

- [ ] Headline parsing accuracy
- [ ] IV scoring logic
- [ ] Sentiment classification
- [ ] Hot print detection
- [ ] Pattern matching

### Integration Tests

- [ ] Grok API integration
- [ ] News processing pipeline
- [ ] Overnight monitoring
- [ ] Alert generation
- [ ] Collaborative AI connection

### Quality Tests

- [ ] Parse 1000 real FinancialJuice tweets
- [ ] Validate IV scores against historical data
- [ ] Test sentiment against market moves
- [ ] Verify hot print detection accuracy

---

## Success Metrics

### Week 1

✅ Grok parsing FinancialJuice correctly
✅ Breaking news detected < 10 seconds
✅ Economic data extracted accurately
✅ Symbols identified in tweets

### Week 2

✅ IV scoring correlates with VIX
✅ Sentiment matches market direction
✅ All hot prints detected
✅ Implied points calculated

### Week 3

✅ Tape reports generated < 3 seconds
✅ NTN summaries actionable
✅ Hot prints trigger alerts
✅ Market regime identified

### Week 4

✅ Overnight monitoring active
✅ Market shakers detected
✅ Charged conditions identified
✅ Pre-market proposals generated

### Week 5

✅ Full AI integration complete
✅ Implied points accurate
✅ Analysis accuracy > 80%
✅ System learning from outcomes

---

## Dependencies

### Required from Agent 1

- News feed infrastructure
- X API integration
- FMP economics data
- Database schema

### External Requirements

- Grok API access
- Sufficient API rate limits
- Historical data for training
- Real-time market data

---

## Coordination Points

### With Agent 1

- News article format
- Database schema
- API endpoints
- Cache strategy

### With Trading Team

- IV score interpretation
- Sentiment usage
- Hot print thresholds
- Charged market criteria

---

**CRITICAL: Financial parsing must be PERFECT. This is a finance product - no room for interpretation errors.**

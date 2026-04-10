/**
 * Agent Types
 * Type definitions for collaborative AI agents
 * Phase 6 - Days 20-25
 */

export type AgentType =
  | "market_data"
  | "news_sentiment"
  | "technical"
  | "bullish_researcher"
  | "bearish_researcher"
  | "trader"
  | "risk_manager";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export type Sentiment = "bullish" | "bearish" | "neutral";

export type RiskLevel = "low" | "medium" | "high" | "extreme";

export type ProposalDecision = "approved" | "rejected" | "modified" | "pending";

// Base agent report interface
export interface AgentReport {
  id: string;
  userId: string;
  agentType: AgentType;
  reportData: Record<string, unknown>;
  confidenceScore: number; // 0-1
  model?: string;
  latencyMs?: number;
  createdAt: string;
  expiresAt?: string;
}

// Market Data Analyst output
export interface MarketDataReport {
  vix: {
    current: number;
    change: number;
    level: "low" | "normal" | "elevated" | "high" | "extreme";
  };
  es: {
    price: number;
    change: number;
    percentChange: number;
  };
  nq: {
    price: number;
    change: number;
    percentChange: number;
  };
  treasuryYields: {
    twoYear: number;
    tenYear: number;
    spread: number;
  };
  marketRegime: "risk_on" | "risk_off" | "transitional";
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  summary: string;
}

// News & Sentiment Analyst output
export interface NewsSentimentReport {
  overallSentiment: Sentiment;
  sentimentScore: number; // -1 to +1
  macroLevel: 1 | 2 | 3 | 4; // 4-tier urgency system
  breakingNewsDetected: boolean;
  topHeadlines: {
    headline: string;
    source: string;
    sentiment: Sentiment;
    ivScore: number;
    macroLevel: 1 | 2 | 3 | 4;
    publishedAt: string;
  }[];
  catalysts: {
    event: string;
    impact: "high" | "medium" | "low";
    direction: Sentiment;
    timing: string;
  }[];
  riskEvents: string[];
  summary: string;
}

// Technical Analyst output
export interface TechnicalReport {
  trend: {
    daily: "bullish" | "bearish" | "neutral";
    hourly: "bullish" | "bearish" | "neutral";
    strength: number; // 0-100
  };
  emaAnalysis: {
    ema20: number;
    ema50: number;
    ema100: number;
    ema200: number;
    priceVsEmas: "above_all" | "mixed" | "below_all";
  };
  vwapAnalysis: {
    dailyVwap: number;
    priceVsVwap: "above" | "below" | "at";
  };
  volumeProfile: {
    currentVsAvg: "high" | "normal" | "low";
    volumeTrend: "increasing" | "decreasing" | "stable";
  };
  keyPatterns: string[];
  tradingBias: Sentiment;
  summary: string;
}

// Researcher report (bullish or bearish)
export interface ResearcherReport {
  thesis: string;
  conviction: number; // 0-100
  keyArguments: {
    point: string;
    evidence: string;
    strength: number; // 0-10
  }[];
  riskFactors: string[];
  priceTarget?: {
    value: number;
    timeframe: string;
    probability: number;
  };
  catalysts: string[];
  summary: string;
}

// Debate round between researchers
export interface DebateRound {
  round: number;
  bullishArgument: string;
  bearishRebuttal: string;
  bearishArgument: string;
  bullishRebuttal: string;
  roundScore: number; // -1 (bearish won) to +1 (bullish won)
}

// Researcher debate output
export interface DebateResult {
  id: string;
  userId: string;
  analystReportIds: string[];
  bullishReport: ResearcherReport;
  bearishReport: ResearcherReport;
  debateRounds: DebateRound[];
  consensusScore: number; // -1 (bearish) to +1 (bullish)
  finalAssessment: {
    recommendation: Sentiment;
    confidence: number;
    reasoning: string;
    keyRisks: string[];
  };
  model?: string;
  totalLatencyMs?: number;
  createdAt: string;
}

// Trading strategies
export type TradingStrategy =
  | "MORNING_FLUSH"
  | "LUNCH_FLUSH"
  | "POWER_HOUR_FLUSH"
  | "VIX_FIX_22"
  | "FORTY_FORTY_CLUB"
  | "MOMENTUM"
  | "CHARGED_RIPPERS"
  | "MEAN_REVERSION"
  | "DISCRETIONARY"
  | "PLAYBOOK_SWEEP_RECLAIM";

// Trading proposal from Trader agent
export interface TradingProposal {
  id: string;
  userId: string;
  tradeRecommended: boolean;
  strategyName: TradingStrategy;
  instrument: string;
  direction: "long" | "short" | "flat";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number[];
  positionSize: number;
  riskRewardRatio: number;
  confidence: number; // 0-100
  rationale: string;
  analystInputs: {
    marketData: string;
    sentiment: string;
    technical: string;
    researchConsensus: string;
  };
  timeframe: string;
  setupType: string;
  createdAt: string;
}

// Risk Manager assessment
export interface RiskAssessment {
  id: string;
  userId: string;
  proposalId?: string;
  riskScore: number; // 0-1
  decision: ProposalDecision;
  issues: {
    category: string;
    severity: RiskLevel;
    description: string;
    mitigation?: string;
  }[];
  portfolioImpact: {
    maxDrawdown: number;
    positionConcentration: number;
    correlationRisk: RiskLevel;
  };
  blindSpotAlerts: string[];
  modificationSuggestions?: {
    field: string;
    current: unknown;
    suggested: unknown;
    reason: string;
  }[];
  rejectionReason?: string;
  summary: string;
  createdAt: string;
}

// Signal event from external detectors (QuantConnect, TradingView)
export interface SignalEvent {
  source: "quantconnect" | "tradingview" | "manual";
  strategy: TradingStrategy;
  direction: "long" | "short";
  instrument: string;
  confidence: number; // 0-100
  entryPrice: number;
  stopLoss: number;
  takeProfit: number[];
  signals: string[]; // e.g. ['liquidity_sweep', 'rsi_divergence']
  htfContext?: string;
  volumeDelta?: number;
  rsiValue?: number;
  timestamp: string;
  sessionWindow?: string;
}

// User psychology profile (for Risk Manager)
export interface UserPsychology {
  userId: string;
  blindSpots: string[];
  goal?: string;
  orientationComplete: boolean;
  psychScores: {
    fomo: number;
    revenge: number;
    overconfidence: number;
    lossAversion: number;
  };
  lastAssessmentAt?: string;
  agentNotes: string[];
}

// Full agent pipeline result
export interface AgentPipelineResult {
  marketData: MarketDataReport;
  newsSentiment: NewsSentimentReport;
  technical: TechnicalReport;
  debate: DebateResult;
  proposal?: TradingProposal;
  riskAssessment?: RiskAssessment;
  overallRecommendation: {
    action: "trade" | "wait" | "avoid";
    direction?: "long" | "short";
    confidence: number;
    reasoning: string;
  };
  pipelineLatencyMs: number;
  createdAt: string;
}

// Database row types
export interface AgentReportRow {
  id: string;
  user_id: string;
  agent_type: string;
  report_data: Record<string, unknown>;
  confidence_score: number | null;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
  expires_at: string | null;
}

export interface DebateRow {
  id: string;
  user_id: string;
  analyst_report_ids: string[];
  bullish_report: Record<string, unknown>;
  bearish_report: Record<string, unknown>;
  debate_rounds: DebateRound[];
  consensus_score: number | null;
  final_assessment: Record<string, unknown> | null;
  model: string | null;
  total_latency_ms: number | null;
  created_at: string;
}

export interface RiskAssessmentRow {
  id: string;
  user_id: string;
  proposal_id: string | null;
  risk_manager_report: Record<string, unknown>;
  risk_score: number | null;
  decision: string;
  rejection_reason: string | null;
  modification_suggestions: Record<string, unknown>[] | null;
  model: string | null;
  created_at: string;
}

// Request types for API
export interface AnalyzeRequest {
  symbol?: string;
  includeDebate?: boolean;
  includeProposal?: boolean;
}

export interface GetReportsRequest {
  agentType?: AgentType;
  limit?: number;
  since?: string;
}

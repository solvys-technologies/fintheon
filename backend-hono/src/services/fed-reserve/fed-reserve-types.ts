// Federal Reserve Debate Board — MiroShark-inspired multi-agent FOMC simulation
// Models central banking psychology & monetary policy deliberation dynamics

export type FedStance = 'hawkish' | 'dovish' | 'neutral';

export type FedVoteDecision =
  | 'hike-50'
  | 'hike-25'
  | 'hold'
  | 'cut-25'
  | 'cut-50';

export type DeliberationPhase =
  | 'context-build'
  | 'opening-statements'
  | 'deliberation'
  | 'coalition-forming'
  | 'final-vote'
  | 'complete';

export interface FedAgentProfile {
  id: string;
  name: string;
  archetype: string;
  stance: FedStance;
  bias: string;
  /** How quickly they react to new data (0-1, 1 = instant) */
  reactionSpeed: number;
  /** Influence on other agents' positions (0-1) */
  influenceWeight: number;
  /** Tendency to shift position under pressure (0-1, 1 = very flexible) */
  flexibility: number;
  persona: string;
  focusAreas: string[];
}

export interface FedAgentVote {
  agentId: string;
  agentName: string;
  decision: FedVoteDecision;
  stance: FedStance;
  confidence: number;
  reasoning: string;
  dissent: boolean;
  dissentStatement?: string;
  /** Which agents influenced this vote */
  influencedBy: string[];
  /** Dot plot projection: where they see rates in 12 months */
  dotPlotProjection: number;
}

export interface FedDeliberationRound {
  round: number;
  phase: DeliberationPhase;
  exchanges: FedExchange[];
  stanceShifts: Array<{
    agentId: string;
    from: FedStance;
    to: FedStance;
    reason: string;
  }>;
  coalitions: FedCoalition[];
}

export interface FedExchange {
  speakerId: string;
  speakerName: string;
  targetId?: string;
  content: string;
  stance: FedStance;
  conviction: number;
}

export interface FedCoalition {
  name: string;
  stance: FedStance;
  memberIds: string[];
  strength: number;
}

export interface FedSessionContext {
  currentFedFundsRate: number;
  latestCPI: number | null;
  latestPCE: number | null;
  unemploymentRate: number | null;
  gdpGrowth: number | null;
  yieldCurve2s10s: number | null;
  vixLevel: number | null;
  recentFedSpeeches: string[];
  riskflowHeadlines: Array<{
    title: string;
    sentiment: string;
    macroLevel: number;
  }>;
  fetchedAt: string;
}

export interface FedRateDecision {
  decision: FedVoteDecision;
  voteCount: Record<FedVoteDecision, number>;
  totalVotes: number;
  dissentCount: number;
  consensusStrength: number;
  medianDotPlot: number;
  dotPlotRange: { low: number; high: number };
}

export interface FedForwardGuidance {
  signal: 'tightening' | 'easing' | 'data-dependent' | 'on-hold';
  hawkishProbability: number;
  dovishProbability: number;
  nextMeetingExpectation: FedVoteDecision;
  keyRisks: string[];
  dissenterNarratives: string[];
}

export interface FedSessionReport {
  sessionId: string;
  status: 'running' | 'complete' | 'error';
  context: FedSessionContext;
  agents: FedAgentProfile[];
  deliberationRounds: FedDeliberationRound[];
  rateDecision: FedRateDecision;
  forwardGuidance: FedForwardGuidance;
  /** Monetary policy risk signal (0-10) fed into MiroFish */
  monetaryPolicySignal: number;
  /** Confidence in the signal */
  signalConfidence: number;
  /** Regime shift probability from monetary policy angle */
  regimeShiftProbability: number;
  briefingSummary: string;
  generatedAt: string;
  error?: string;
}

export interface FedSessionSummary {
  sessionId: string;
  decision: FedVoteDecision;
  dissentCount: number;
  consensusStrength: number;
  monetaryPolicySignal: number;
  signalConfidence: number;
  briefingSummary: string;
  createdAt: string;
}

/** The output format that MiroFish context assembly consumes */
export interface FedReserveContextSignal {
  monetaryPolicySignal: number;
  signalConfidence: number;
  regimeShiftProbability: number;
  rateDecision: FedVoteDecision;
  consensusStrength: number;
  forwardGuidanceSignal: string;
  dissentCount: number;
  medianDotPlot: number;
  sessionId: string;
  generatedAt: string;
}

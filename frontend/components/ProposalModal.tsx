import { useState } from "react";
import { X, TrendingUp, TrendingDown, AlertTriangle, Shield, Zap } from "lucide-react";

export interface TradingProposal {
  id: string;
  tradeRecommended: boolean;
  strategyName: string;
  instrument: string;
  direction: 'long' | 'short' | 'flat';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number[];
  positionSize: number;
  riskRewardRatio: number;
  confidence: number;
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

interface ProposalModalProps {
  proposal: TradingProposal;
  onClose: () => void;
  onApprove?: (proposal: TradingProposal) => void;
  onReject?: (proposal: TradingProposal) => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  MORNING_FLUSH: "Morning Flush",
  LUNCH_FLUSH: "Lunch Flush",
  POWER_HOUR_FLUSH: "Power Hour Flush",
  VIX_FIX_22: "VIX Fix 22",
  FORTY_FORTY_CLUB: "40/40 Club",
  MOMENTUM: "Momentum",
  CHARGED_RIPPERS: "Charged Rippers",
  MEAN_REVERSION: "Mean Reversion",
  DISCRETIONARY: "Discretionary",
  PLAYBOOK_SWEEP_RECLAIM: "Playbook Sweep",
};

export function ProposalModal({ proposal, onClose, onApprove, onReject }: ProposalModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleApprove = () => {
    onApprove?.(proposal);
    handleClose();
  };

  const handleReject = () => {
    onReject?.(proposal);
    handleClose();
  };

  const isLong = proposal.direction === 'long';
  const isShort = proposal.direction === 'short';
  const directionColor = isLong ? 'text-green-400' : isShort ? 'text-red-400' : 'text-zinc-400';
  const directionBg = isLong ? 'bg-green-500/10 border-green-500/30' : isShort ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-500/10 border-zinc-500/30';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg shadow-[0_0_24px_rgba(255,192,56,0.2)] w-full max-w-2xl max-h-[85vh] flex flex-col ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-[var(--fintheon-accent)]" />
            <h2 className="text-lg font-bold text-[var(--fintheon-accent)]">Trading Proposal</h2>
            <span className={`text-xs px-2 py-0.5 rounded border ${directionBg} ${directionColor}`}>
              {proposal.direction.toUpperCase()}
            </span>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-zinc-900 rounded transition-all">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Strategy & Instrument */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Strategy</div>
              <div className="text-lg font-semibold text-white">
                {STRATEGY_LABELS[proposal.strategyName] || proposal.strategyName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Instrument</div>
              <div className="text-lg font-mono font-bold text-[var(--fintheon-accent)]">{proposal.instrument}</div>
            </div>
          </div>

          {/* Direction & Confidence */}
          <div className={`p-4 rounded-lg border ${directionBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isLong ? (
                  <TrendingUp className="w-8 h-8 text-green-400" />
                ) : isShort ? (
                  <TrendingDown className="w-8 h-8 text-red-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-zinc-400" />
                )}
                <div>
                  <div className={`text-2xl font-bold ${directionColor}`}>
                    {proposal.direction === 'flat' ? 'NO TRADE' : proposal.direction.toUpperCase()}
                  </div>
                  <div className="text-sm text-zinc-400">{proposal.setupType}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">Confidence</div>
                <div className={`text-3xl font-bold ${proposal.confidence >= 70 ? 'text-green-400' : proposal.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {proposal.confidence}%
                </div>
              </div>
            </div>
          </div>

          {/* Trade Details */}
          {proposal.direction !== 'flat' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">Entry</div>
                <div className="text-lg font-mono text-white">{proposal.entryPrice?.toFixed(2) || 'Market'}</div>
              </div>
              <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">Stop Loss</div>
                <div className="text-lg font-mono text-red-400">{proposal.stopLoss?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">Take Profit</div>
                <div className="text-lg font-mono text-green-400">
                  {proposal.takeProfit?.length ? proposal.takeProfit[0].toFixed(2) : 'N/A'}
                </div>
              </div>
              <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">R:R</div>
                <div className="text-lg font-mono text-[var(--fintheon-accent)]">{proposal.riskRewardRatio.toFixed(1)}:1</div>
              </div>
            </div>
          )}

          {/* Rationale */}
          <div className="bg-[var(--fintheon-bg)] border border-zinc-900 rounded-lg p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Rationale</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{proposal.rationale}</p>
          </div>

          {/* Analyst Inputs */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Agent Analysis</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(proposal.analystInputs).map(([key, value]) => (
                <div key={key} className="bg-[var(--fintheon-bg)] border border-zinc-900/50 rounded p-2">
                  <div className="text-[10px] text-zinc-600 uppercase">{key.replace(/([A-Z])/g, ' $1')}</div>
                  <div className="text-xs text-zinc-400 truncate">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <div>Timeframe: {proposal.timeframe}</div>
            <div>Size: {proposal.positionSize} contracts</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-900">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Shield className="w-4 h-4" />
            <span>Risk Manager Approved</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium transition-all"
            >
              Reject
            </button>
            {proposal.tradeRecommended && (
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-[var(--fintheon-accent)] hover:bg-[#FFD060] text-black rounded-lg text-sm font-medium transition-all"
              >
                Execute Trade
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock proposal for testing
export const MOCK_PROPOSAL: TradingProposal = {
  id: 'mock-proposal-1',
  tradeRecommended: true,
  strategyName: 'MORNING_FLUSH',
  instrument: 'MNQ',
  direction: 'long',
  entryPrice: 19250.00,
  stopLoss: 19220.00,
  takeProfit: [19300.00, 19350.00],
  positionSize: 2,
  riskRewardRatio: 2.5,
  confidence: 78,
  rationale: 'VIX elevated at 22.5, market showing oversold conditions with bullish divergence on 5m RSI. Morning flush setup triggered with confluence at prior session VWAP.',
  analystInputs: {
    marketData: 'Risk-off regime, VIX elevated',
    sentiment: 'Neutral, awaiting FOMC minutes',
    technical: 'Bullish divergence, above 200 EMA',
    researchConsensus: 'Moderate bull case, 62% conviction',
  },
  timeframe: 'EOD',
  setupType: 'ORB reversal',
  createdAt: new Date().toISOString(),
};

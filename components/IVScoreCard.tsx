// [claude-code 2026-03-09] Added VIX degraded-state indicator (stale/degraded dot)
import { Info, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useVIX } from '../contexts/VIXContext';

interface IVScoreCardProps {
  score: number;
}

// Instrument configurations with Grok-spec betas for point move calculations
// Beta = correlation to SPX volatility (1.0 = moves with SPX, <1 = less volatile)
// Based on Rule of 16: Implied % = VIX / 16, then adjusted by instrument beta
const INSTRUMENT_CONFIG: Record<string, { beta: number; tickValue: number; tickSize: number; currentPrice: number; notes: string }> = {
  // Equity Index Futures
  "/ES": { beta: 1.0, tickValue: 12.50, tickSize: 0.25, currentPrice: 6000, notes: 'E-mini S&P 500 - Base' },
  "/MES": { beta: 1.0, tickValue: 1.25, tickSize: 0.25, currentPrice: 6000, notes: 'Micro E-mini S&P 500' },
  "/NQ": { beta: 1.2, tickValue: 5.00, tickSize: 0.25, currentPrice: 21000, notes: 'E-mini Nasdaq 100 - Tech' },
  "/MNQ": { beta: 1.2, tickValue: 0.50, tickSize: 0.25, currentPrice: 21000, notes: 'Micro E-mini Nasdaq 100' },
  "/YM": { beta: 0.95, tickValue: 5.00, tickSize: 1.0, currentPrice: 44000, notes: 'E-mini Dow - Industrials' },
  "/MYM": { beta: 0.95, tickValue: 0.50, tickSize: 1.0, currentPrice: 44000, notes: 'Micro E-mini Dow' },
  "/RTY": { beta: 1.1, tickValue: 5.00, tickSize: 0.10, currentPrice: 2200, notes: 'E-mini Russell 2000 - Small caps' },
  "/M2K": { beta: 1.1, tickValue: 0.50, tickSize: 0.10, currentPrice: 2200, notes: 'Micro E-mini Russell 2000' },
  
  // Commodities
  "/CL": { beta: 0.6, tickValue: 10.00, tickSize: 0.01, currentPrice: 75, notes: 'Crude Oil' },
  "/MCL": { beta: 0.6, tickValue: 1.00, tickSize: 0.01, currentPrice: 75, notes: 'Micro Crude Oil' },
  "/GC": { beta: 0.2, tickValue: 10.00, tickSize: 0.10, currentPrice: 2650, notes: 'Gold - Safe-haven' },
  "/MGC": { beta: 0.2, tickValue: 1.00, tickSize: 0.10, currentPrice: 2650, notes: 'Micro Gold' },
  "/SI": { beta: 0.4, tickValue: 25.00, tickSize: 0.005, currentPrice: 30, notes: 'Silver' },
  "/SIL": { beta: 0.4, tickValue: 2.50, tickSize: 0.005, currentPrice: 30, notes: 'Micro Silver' },
  "/NG": { beta: 0.5, tickValue: 10.00, tickSize: 0.001, currentPrice: 3.50, notes: 'Natural Gas' },
  
  // Currencies
  "/6E": { beta: 0.3, tickValue: 12.50, tickSize: 0.00005, currentPrice: 1.08, notes: 'Euro FX' },
  "/6J": { beta: 0.25, tickValue: 12.50, tickSize: 0.0000005, currentPrice: 0.0067, notes: 'Japanese Yen' },
  "/6B": { beta: 0.35, tickValue: 6.25, tickSize: 0.0001, currentPrice: 1.27, notes: 'British Pound' },
  
  // Bonds (inverse correlation)
  "/ZB": { beta: -0.3, tickValue: 31.25, tickSize: 0.03125, currentPrice: 118, notes: '30-Year Treasury' },
  "/ZN": { beta: -0.25, tickValue: 15.625, tickSize: 0.015625, currentPrice: 110, notes: '10-Year Treasury' },
};

function calculateExpectedMove(ivScore: number, symbol: string) {
  const config = INSTRUMENT_CONFIG[symbol];
  if (!config) {
    // Fallback to /ES if symbol not found
    const esConfig = INSTRUMENT_CONFIG["/ES"];
    return calculateMoveFromConfig(ivScore, esConfig, symbol);
  }
  return calculateMoveFromConfig(ivScore, config, symbol);
}

function calculateMoveFromConfig(
  ivScore: number, 
  config: typeof INSTRUMENT_CONFIG[keyof typeof INSTRUMENT_CONFIG],
  symbol: string
) {
  // Use IV score to estimate VIX-like volatility (score 0-10 maps to roughly VIX 10-35)
  const estimatedVix = 10 + (ivScore * 2.5);
  
  // Rule of 16: Implied daily % move = VIX / 16
  // e.g., VIX 20 = 1.25% expected daily move
  const impliedPct = estimatedVix / 16;
  
  // Base points = price × implied %
  const basePoints = config.currentPrice * (impliedPct / 100);
  
  // Adjust by instrument beta (use absolute value for display)
  const adjustedPoints = basePoints * Math.abs(config.beta);
  
  // Calculate ticks for context
  const adjustedTicks = adjustedPoints / config.tickSize;
  
  // Calculate dollar risk per contract
  const dollarRisk = adjustedTicks * config.tickValue;

  return {
    points: Math.round(adjustedPoints * 10) / 10,
    ticks: Math.round(adjustedTicks),
    dollarRisk: Math.round(dollarRisk),
    percent: Number(impliedPct.toFixed(2)),
    beta: config.beta,
  };
}

interface IVScoreCardProps {
  score: number;
  variant?: 'default' | 'frosted';
  layoutOption?: 'movable' | 'tickers-only' | 'combined';
}

export function IVScoreCard({ score, variant = 'default', layoutOption }: IVScoreCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { selectedSymbol } = useSettings();
  const { status: vixStatus } = useVIX();

  // Calculate expected move for user's selected instrument
  const expectedMove = calculateExpectedMove(score, selectedSymbol.symbol);

  const getScoreColor = () => {
    if (score >= 8) return 'text-red-500';
    if (score >= 6) return 'text-orange-400';
    if (score >= 4) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getScoreLabel = () => {
    if (score >= 8) return 'Extreme';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Moderate';
    return 'Low';
  };

  const getBarColor = () => {
    if (score >= 8) return 'bg-red-500';
    if (score >= 6) return 'bg-orange-400';
    if (score >= 4) return 'bg-yellow-400';
    return 'bg-emerald-400';
  };

  const containerClasses = variant === 'frosted'
    ? 'relative backdrop-blur-2xl bg-gradient-to-br from-[#050500]/60 to-[#050500]/40 border border-[#D4AF37]/30 rounded-xl px-3 py-1.5 shadow-lg'
    : 'relative bg-[#050500] border border-[#D4AF37]/20 rounded-lg px-3 py-1.5';
  
  const frostedStyle = variant === 'frosted' ? {
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  } : {};

  return (
    <div className={`${containerClasses} relative overflow-hidden`} style={frostedStyle}>
      <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <span className="text-[10px] text-gray-400 flex-shrink-0">IV Score</span>
        {vixStatus === 'stale' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#c79f4a] flex-shrink-0 animate-pulse" title="VIX data stale (>2min)" />
        )}
        {vixStatus === 'degraded' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0 animate-pulse" title="VIX feed unavailable" />
        )}
        {vixStatus === 'loading' && (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 flex-shrink-0 animate-pulse" title="Loading VIX data..." />
        )}
        <span className={`text-sm font-bold flex-shrink-0 ${getScoreColor()}`}>
          {score.toFixed(1)}
        </span>
        <span className={`text-[10px] font-medium flex-shrink-0 ${getScoreColor()}`}>
          {getScoreLabel()}
        </span>
        {expectedMove && (
          <>
            <span className="text-gray-600">|</span>
            <TrendingUp className="w-3 h-3 text-[#D4AF37]" />
            <span className="text-[10px] text-[#D4AF37] font-medium truncate flex-shrink">
              ±{expectedMove.points} pts ({selectedSymbol.symbol})
            </span>
          </>
        )}
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="text-gray-500 hover:text-gray-400 transition-colors ml-0.5"
        >
          <Info className="w-2.5 h-2.5" />
        </button>
      </div>

      {showTooltip && (
        <div 
          className={`absolute top-full mt-2 w-80 bg-[#0a0a00] border border-[#D4AF37]/30 rounded-lg p-4 shadow-xl z-50 ${
            layoutOption === 'tickers-only' ? 'right-0' : 'left-0'
          }`}
          style={{
            maxWidth: layoutOption === 'tickers-only' ? 'min(320px, calc(100vw - 2rem))' : '320px',
            ...(layoutOption === 'tickers-only' ? {
              right: '0',
              left: 'auto'
            } : {
              left: '0',
              right: 'auto'
            })
          }}
        >
          <h4 className="text-sm font-semibold text-[#D4AF37] mb-2">Implied Volatility Score</h4>
          <p className="text-xs text-gray-400 mb-3">
            Measures expected market volatility using Black-Scholes methodology. Higher scores indicate greater expected price swings.
          </p>

          {expectedMove && (
            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg p-3 mb-3">
              <h5 className="text-xs font-semibold text-[#D4AF37] mb-1">Expected Move for {selectedSymbol.symbol}</h5>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">±{expectedMove.points}</span>
                <span className="text-xs text-gray-400">points</span>
                <span className="text-xs text-gray-500">({expectedMove.percent.toFixed(2)}%)</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Basis-adjusted for {selectedSymbol.symbol} typical volatility profile
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-gray-300"><strong>0-4:</strong> Low volatility, stable conditions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-xs text-gray-300"><strong>4-6:</strong> Moderate volatility, normal fluctuations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-xs text-gray-300"><strong>6-8:</strong> High volatility, significant moves expected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-gray-300"><strong>8-10:</strong> Extreme volatility, major market events</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [claude-code 2026-03-31] S13-T2: TradePlanCard — displays generated trade plan for a proposal
import { useState } from "react";
import {
  Target,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart3,
  Shield,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import { AskAboutThis } from "../chat/AskAboutThis";
import type { TradePlanData } from "../../types/feed";

const TREND_LABELS: Record<string, { label: string; color: string }> = {
  ripper: { label: "RIPPER", color: "text-emerald-400 bg-emerald-500/10" },
  strong_trend: {
    label: "STRONG TREND",
    color: "text-[#c79f4a] bg-[#c79f4a]/10",
  },
  weak_trend: {
    label: "WEAK TREND",
    color: "text-amber-500/70 bg-amber-500/10",
  },
};

interface TradePlanCardProps {
  proposalId: string;
  instrument: string;
  direction: "long" | "short" | "flat";
  tradePlan: TradePlanData;
  onRefresh?: () => void;
}

export function TradePlanCard({
  proposalId,
  instrument,
  direction,
  tradePlan,
  onRefresh,
}: TradePlanCardProps) {
  const backend = useBackend();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const isLong = direction === "long";

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await backend.skills.enrichProposal(proposalId);
      onRefresh?.();
    } catch {
      // silent — non-critical
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="group rounded-lg border border-[#c79f4a]/20 bg-[#0a0805] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#c79f4a]" />
          <span className="text-sm font-medium text-[#f0ead6]">Trade Plan</span>
          <span className="text-xs text-[#f0ead6]/50">
            {tradePlan.timeframe}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              isLong
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isLong ? "LONG" : "SHORT"} {instrument}
          </span>
          <AskAboutThis
            surface="trade_plan"
            label="this trade plan"
            payload={{
              proposal_id: proposalId,
              instrument,
              direction,
              timeframe: tradePlan.timeframe,
              trend_template: tradePlan.trendTemplate,
            }}
          />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="p-1 rounded hover:bg-[#c79f4a]/10 text-[#f0ead6]/40 hover:text-[#c79f4a] transition-colors disabled:opacity-50"
            title="Regenerate Plan"
          >
            <RefreshCw
              size={14}
              className={regenerating ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* Trend Template Badge */}
      {tradePlan.trendTemplate && TREND_LABELS[tradePlan.trendTemplate] && (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${TREND_LABELS[tradePlan.trendTemplate].color}`}
          >
            {TREND_LABELS[tradePlan.trendTemplate].label}
          </span>
          <span className="text-[10px] text-[#f0ead6]/30">
            Fib Zone Classification
          </span>
        </div>
      )}

      {/* Price Levels */}
      <div className="space-y-1.5">
        {/* Take Profit levels (highest first for long, lowest first for short) */}
        {[...tradePlan.takeProfitLevels].reverse().map((tp, i) => {
          const tpIndex = tradePlan.takeProfitLevels.length - i;
          return (
            <PriceRow
              key={`tp-${i}`}
              label={`TP${tpIndex}`}
              price={tp}
              icon={<TrendingUp size={12} />}
              color="text-emerald-400"
              bgColor="bg-emerald-500/5"
            />
          );
        })}

        {/* Entry */}
        <PriceRow
          label="Entry"
          price={tradePlan.entryPrice}
          icon={<Target size={12} />}
          color="text-[#c79f4a]"
          bgColor="bg-[#c79f4a]/5"
          highlight
        />

        {/* Stop Loss */}
        <PriceRow
          label="Stop"
          price={tradePlan.stopLoss}
          icon={<Shield size={12} />}
          color="text-red-400"
          bgColor="bg-red-500/5"
        />
      </div>

      {/* R:R + Confidence */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[#f0ead6]/40">R:R</span>
          <span
            className={`font-mono font-medium ${
              tradePlan.riskRewardRatio >= 2
                ? "text-emerald-400"
                : tradePlan.riskRewardRatio >= 1
                  ? "text-[#c79f4a]"
                  : "text-red-400"
            }`}
          >
            {tradePlan.riskRewardRatio.toFixed(1)}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="text-[#f0ead6]/40">Confidence</span>
          <div className="w-16 h-1.5 rounded-full bg-[#f0ead6]/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tradePlan.confidence >= 70
                  ? "bg-emerald-400"
                  : tradePlan.confidence >= 40
                    ? "bg-[#c79f4a]"
                    : "bg-red-400"
              }`}
              style={{ width: `${tradePlan.confidence}%` }}
            />
          </div>
          <span className="font-mono text-[#f0ead6]/60">
            {tradePlan.confidence}
          </span>
        </div>
      </div>

      {/* Key Levels */}
      {tradePlan.keyLevels.length > 0 && (
        <div className="pt-1 border-t border-[#f0ead6]/5">
          <div className="text-xs text-[#f0ead6]/40 mb-1">Key Levels</div>
          <div className="flex flex-wrap gap-1.5">
            {tradePlan.keyLevels.map((kl, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded bg-[#f0ead6]/5 text-[#f0ead6]/60 font-mono"
              >
                {kl.label}: {kl.price.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chart Analysis (collapsible) */}
      {tradePlan.chartAnalysis && (
        <div className="pt-1 border-t border-[#f0ead6]/5">
          <button
            onClick={() => setAnalysisOpen(!analysisOpen)}
            className="flex items-center gap-1 text-xs text-[#f0ead6]/40 hover:text-[#c79f4a] transition-colors w-full"
          >
            {analysisOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Chart Analysis
          </button>
          {analysisOpen && (
            <p className="mt-1.5 text-xs text-[#f0ead6]/60 leading-relaxed">
              {tradePlan.chartAnalysis}
            </p>
          )}
        </div>
      )}

      {/* Screenshot */}
      {tradePlan.screenshotBase64 && (
        <div className="pt-1 border-t border-[#f0ead6]/5">
          <img
            src={`data:image/png;base64,${tradePlan.screenshotBase64}`}
            alt={`${instrument} chart`}
            className="w-full rounded border border-[#f0ead6]/10"
          />
        </div>
      )}
    </div>
  );
}

// ── PriceRow sub-component ─────────────────────────────────────────────────

function PriceRow({
  label,
  price,
  icon,
  color,
  bgColor,
  highlight,
}: {
  label: string;
  price: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1 rounded ${bgColor} ${
        highlight ? "ring-1 ring-[#c79f4a]/20" : ""
      }`}
    >
      <div className={`flex items-center gap-1.5 text-xs ${color}`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <span
        className={`font-mono text-xs ${highlight ? "text-[#c79f4a] font-semibold" : "text-[#f0ead6]/70"}`}
      >
        {price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}

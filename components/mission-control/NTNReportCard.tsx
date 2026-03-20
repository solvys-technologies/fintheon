import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  BarChart3,
  Zap,
  Globe,
  Target,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

export type DayClassification = 'compounding' | 'expansion';

export interface Performer {
  ticker: string;
  changePercent: number;
}

export interface MacroDataPoint {
  name: string;
  actual: string;
  expected?: string;
  prior?: string;
}

export interface OptionsFlow {
  instrument: string;
  activity: string;
  vixpiration?: string;
  opex?: string;
}

export interface TariffEvent {
  timestamp: string;
  description: string;
  nqImplication: string;
}

export interface NTNReportData {
  date: string;
  dayClassification: DayClassification;
  classificationRationale: string;
  bestPerformers: Performer[];
  worstPerformers: Performer[];
  macroData: MacroDataPoint[];
  politicalCommentary: string;
  optionsFlow: OptionsFlow;
  marketRisk: string;
  vixLevel?: number;
  tariffEvents: TariffEvent[];
  overallSentiment: string;
  recommendedStrategy?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-1.5 group"
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
        <span className="text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider">
          {title}
        </span>
      </div>
      {open ? (
        <ChevronUp className="w-3 h-3 text-[#D4AF37]/60 group-hover:text-[#D4AF37]" />
      ) : (
        <ChevronDown className="w-3 h-3 text-[#D4AF37]/60 group-hover:text-[#D4AF37]" />
      )}
    </button>
  );
}

function PerformerRow({ performer }: { performer: Performer }) {
  const isPositive = performer.changePercent >= 0;
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs font-mono text-white">{performer.ticker}</span>
      <span
        className={`text-xs font-mono font-semibold ${
          isPositive ? 'text-emerald-400' : 'text-red-500'
        }`}
      >
        {isPositive ? '+' : ''}
        {performer.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface NTNReportCardProps {
  report: NTNReportData;
  defaultExpanded?: boolean;
}

export function NTNReportCard({
  report,
  defaultExpanded = false,
}: NTNReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    performers: true,
    macro: false,
    political: false,
    options: false,
    risk: false,
    tariff: false,
    sentiment: true,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const isCompounding = report.dayClassification === 'compounding';

  return (
    <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#D4AF37]/10 to-transparent hover:from-[#D4AF37]/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-bold text-[#D4AF37] tracking-wide">
            NTN REPORT
          </span>
          <span className="text-[10px] text-gray-500">{report.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isCompounding
                ? 'text-[#D4AF37] border-[#D4AF37]/40 bg-[#D4AF37]/10'
                : 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
            }`}
          >
            {isCompounding ? 'COMPOUNDING' : 'EXPANSION'}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#D4AF37]/60" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#D4AF37]/60" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1 divide-y divide-[#D4AF37]/10">
          {/* Classification Rationale */}
          <p className="text-[10px] text-gray-400 py-1.5 italic">
            {report.classificationRationale}
          </p>

          {/* Performers */}
          <div>
            <SectionHeader
              icon={BarChart3}
              title="Top Performers (AH)"
              open={openSections.performers}
              onToggle={() => toggle('performers')}
            />
            {openSections.performers && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0 pb-1">
                <div>
                  <p className="text-[9px] text-emerald-400/70 font-semibold mb-0.5 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" /> BEST
                  </p>
                  {report.bestPerformers.map((p) => (
                    <PerformerRow key={p.ticker} performer={p} />
                  ))}
                </div>
                <div>
                  <p className="text-[9px] text-red-500/70 font-semibold mb-0.5 flex items-center gap-1">
                    <TrendingDown className="w-2.5 h-2.5" /> WORST
                  </p>
                  {report.worstPerformers.map((p) => (
                    <PerformerRow key={p.ticker} performer={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Macro Data */}
          <div>
            <SectionHeader
              icon={Globe}
              title="Macro Data"
              open={openSections.macro}
              onToggle={() => toggle('macro')}
            />
            {openSections.macro && (
              <div className="space-y-1 pb-1">
                {report.macroData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-baseline justify-between"
                  >
                    <span className="text-[10px] text-gray-400">{d.name}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-white font-mono">{d.actual}</span>
                      {d.expected && (
                        <span className="text-gray-600">
                          exp {d.expected}
                        </span>
                      )}
                      {d.prior && (
                        <span className="text-gray-600">
                          prior {d.prior}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Political Commentary */}
          <div>
            <SectionHeader
              icon={Shield}
              title="Political Commentary"
              open={openSections.political}
              onToggle={() => toggle('political')}
            />
            {openSections.political && (
              <p className="text-[10px] text-gray-300 leading-relaxed pb-1">
                {report.politicalCommentary}
              </p>
            )}
          </div>

          {/* Options Flow */}
          <div>
            <SectionHeader
              icon={Target}
              title="Key Options Flow"
              open={openSections.options}
              onToggle={() => toggle('options')}
            />
            {openSections.options && (
              <div className="pb-1 space-y-1">
                <p className="text-[10px] text-gray-300">
                  <span className="text-[#D4AF37] font-semibold">
                    {report.optionsFlow.instrument}:
                  </span>{' '}
                  {report.optionsFlow.activity}
                </p>
                <div className="flex gap-3 text-[9px] text-gray-500">
                  {report.optionsFlow.vixpiration && (
                    <span>VIXpiration: {report.optionsFlow.vixpiration}</span>
                  )}
                  {report.optionsFlow.opex && (
                    <span>OPEX: {report.optionsFlow.opex}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Market Risk */}
          <div>
            <SectionHeader
              icon={AlertTriangle}
              title="Market Risk"
              open={openSections.risk}
              onToggle={() => toggle('risk')}
            />
            {openSections.risk && (
              <div className="pb-1">
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  {report.marketRisk}
                </p>
                {report.vixLevel != null && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-500">VIX</span>
                    <span className="text-xs font-mono text-white">
                      {report.vixLevel.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tariff / Black-Swan */}
          {report.tariffEvents.length > 0 && (
            <div>
              <SectionHeader
                icon={AlertTriangle}
                title="Tariff / Black-Swan"
                open={openSections.tariff}
                onToggle={() => toggle('tariff')}
              />
              {openSections.tariff && (
                <div className="space-y-1.5 pb-1">
                  {report.tariffEvents.map((evt, i) => (
                    <div key={i} className="pl-2 border-l-2 border-[#D4AF37]/30">
                      <span className="text-[9px] text-gray-500 block">
                        {evt.timestamp}
                      </span>
                      <p className="text-[10px] text-gray-300">
                        {evt.description}
                      </p>
                      <p className="text-[9px] text-[#D4AF37]/70 italic">
                        NQ: {evt.nqImplication}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overall Sentiment */}
          <div>
            <SectionHeader
              icon={Zap}
              title="Overall Sentiment"
              open={openSections.sentiment}
              onToggle={() => toggle('sentiment')}
            />
            {openSections.sentiment && (
              <div className="pb-1">
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  {report.overallSentiment}
                </p>
                {report.recommendedStrategy && (
                  <div className="mt-1.5 px-2 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded">
                    <span className="text-[9px] text-[#D4AF37] font-semibold">
                      STRATEGY:{' '}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {report.recommendedStrategy}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

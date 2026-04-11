// [claude-code 2026-04-11] S14-T7: Inline artifact cards for trade proposals, catalysts, narrative items
import type { FC } from "react";
import type { ParsedArtifact } from "../../lib/artifact-parser";

/* ------------------------------------------------------------------ */
/*  Trade Proposal Card                                                */
/* ------------------------------------------------------------------ */

interface TradeProposalData {
  bias: string;
  instrument?: string;
  entry?: string | number;
  stop?: string | number;
  target?: string | number;
  rr?: string | number;
  confidence?: string | number;
  rationale?: string;
}

const TradeProposalCard: FC<{ data: TradeProposalData }> = ({ data }) => {
  const isBullish =
    data.bias?.toLowerCase() === "bullish" ||
    data.bias?.toLowerCase() === "long";
  return (
    <div className="mt-2 rounded-lg bg-[#0a0906] border border-[#c79f4a]/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            isBullish
              ? "bg-emerald-900/40 text-emerald-400"
              : "bg-red-900/40 text-red-400"
          }`}
        >
          {data.bias}
        </span>
        {data.instrument && (
          <span className="text-xs font-semibold text-[#f0ead6]">
            {data.instrument}
          </span>
        )}
        {data.confidence != null && (
          <span className="ml-auto text-[10px] text-[#c79f4a]/70">
            {data.confidence}% conf
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {data.entry != null && (
          <div>
            <span className="text-zinc-500 block">Entry</span>
            <span className="text-[#f0ead6]">{data.entry}</span>
          </div>
        )}
        {data.stop != null && (
          <div>
            <span className="text-zinc-500 block">Stop</span>
            <span className="text-red-400/80">{data.stop}</span>
          </div>
        )}
        {data.target != null && (
          <div>
            <span className="text-zinc-500 block">Target</span>
            <span className="text-emerald-400/80">{data.target}</span>
          </div>
        )}
      </div>

      {data.rr != null && (
        <div className="text-[10px] text-zinc-500">
          R:R <span className="text-[#f0ead6]/70">{data.rr}</span>
        </div>
      )}

      {data.rationale && (
        <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-white/5 pt-2">
          {data.rationale}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Catalyst Card                                                       */
/* ------------------------------------------------------------------ */

interface CatalystData {
  title: string;
  description?: string;
  sentiment?: string;
  severity?: string;
  tags?: string[];
  directionBias?: string;
}

const CatalystCard: FC<{ data: CatalystData }> = ({ data }) => {
  const isBullish =
    data.sentiment === "bullish" || data.directionBias === "bullish";
  return (
    <div className="mt-2 rounded-lg bg-[#0a0906] border border-[#c79f4a]/15 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isBullish ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
        <span className="text-xs font-medium text-[#f0ead6]">{data.title}</span>
        {data.severity && (
          <span
            className={`ml-auto text-[9px] uppercase font-bold ${
              data.severity === "high"
                ? "text-red-400/70"
                : data.severity === "medium"
                  ? "text-[#c79f4a]/70"
                  : "text-zinc-500"
            }`}
          >
            {data.severity}
          </span>
        )}
      </div>

      {data.description && (
        <p className="text-[11px] text-zinc-400 leading-relaxed pl-3.5">
          {data.description}
        </p>
      )}

      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-3.5">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded bg-[#f0ead6]/5 text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Narrative Item Card                                                 */
/* ------------------------------------------------------------------ */

interface NarrativeItemData {
  title: string;
  description?: string;
  category?: string;
  date?: string;
}

const NarrativeItemCard: FC<{ data: NarrativeItemData }> = ({ data }) => (
  <div className="mt-2 rounded-lg bg-[#0a0906] border border-[#f0ead6]/8 p-3 space-y-1">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[#f0ead6]">{data.title}</span>
      {data.category && (
        <span className="text-[9px] text-zinc-500 uppercase">
          {data.category}
        </span>
      )}
    </div>
    {data.description && (
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {data.description}
      </p>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Exported dispatcher                                                 */
/* ------------------------------------------------------------------ */

export const ArtifactCard: FC<{ artifact: ParsedArtifact }> = ({
  artifact,
}) => {
  switch (artifact.type) {
    case "trade-proposal":
      return (
        <TradeProposalCard
          data={artifact.data as unknown as TradeProposalData}
        />
      );
    case "catalyst":
      return <CatalystCard data={artifact.data as unknown as CatalystData} />;
    case "narrative-item":
      return (
        <NarrativeItemCard
          data={artifact.data as unknown as NarrativeItemData}
        />
      );
    default:
      return null;
  }
};

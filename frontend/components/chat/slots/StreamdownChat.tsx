// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Drop-in markdown renderer for Harper chat. Wraps Streamdown with the 6 slot
// renderers registered via plugins.renderers — fenced blocks with matching
// `language` tokens route to their slot. Plain markdown flows through unchanged.
//   parseIncompleteMarkdown: true keeps the stream readable mid-token;
//   mode: "streaming" keeps fade-in animations suppressed per-block.

import type { ComponentType } from "react";
import {
  Streamdown,
  type CustomRenderer,
  type CustomRendererProps,
} from "streamdown";
import { CatalystCardSlot } from "./CatalystCardSlot";
import { NarrativePreviewSlot } from "./NarrativePreviewSlot";
import { PsychTableSlot } from "./PsychTableSlot";
import { PerfTableSlot } from "./PerfTableSlot";
import { VisionInsightSlot } from "./VisionInsightSlot";
import { TVChartSlot } from "./TVChartSlot";
import { PriceLevelSlot } from "./PriceLevelSlot";
import { ProbabilityTableSlot } from "./ProbabilityTableSlot";
import { AgentHandoffSlot } from "./AgentHandoffSlot";
import { BacktestResultSlot } from "./BacktestResultSlot";
import { WeeklyDeskPlanSlot } from "./WeeklyDeskPlanSlot";
import { MarketTickerStripSlot } from "./MarketTickerStripSlot";
import {
  enhanceTickerMentions,
  MarketTickerMention,
} from "./MarketTickerMention";

export const SLOT_RENDERERS: Record<
  string,
  ComponentType<CustomRendererProps>
> = {
  "catalyst-card": CatalystCardSlot,
  "narrative-preview": NarrativePreviewSlot,
  "psych-table": PsychTableSlot,
  "perf-table": PerfTableSlot,
  "vision-insight": VisionInsightSlot,
  "tv-chart": TVChartSlot,
  "price-level": PriceLevelSlot,
  "probability-table": ProbabilityTableSlot,
  "agent-handoff": AgentHandoffSlot,
  "backtest-result": BacktestResultSlot,
  "weekly-desk-plan": WeeklyDeskPlanSlot,
  "market-ticker-strip": MarketTickerStripSlot,
  "ticker-badges": MarketTickerStripSlot,
};

export const SLOT_LANGUAGES = Object.keys(SLOT_RENDERERS);

const RENDERERS: CustomRenderer[] = SLOT_LANGUAGES.map((language) => ({
  language,
  component: SLOT_RENDERERS[language],
}));
const ALLOWED_TAGS = { "market-ticker": ["symbol"] };
const COMPONENTS = {
  "market-ticker": MarketTickerMention as ComponentType<Record<string, unknown>>,
};
const LITERAL_TAG_CONTENT = ["market-ticker"];
const PLUGINS = { renderers: RENDERERS };

interface StreamdownChatProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

export function StreamdownChat({
  content,
  streaming = false,
  className,
}: StreamdownChatProps) {
  const enhancedContent = enhanceTickerMentions(content);
  return (
    <Streamdown
      className={className}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      allowedTags={ALLOWED_TAGS}
      components={COMPONENTS}
      literalTagContent={LITERAL_TAG_CONTENT}
      plugins={PLUGINS}
    >
      {enhancedContent}
    </Streamdown>
  );
}

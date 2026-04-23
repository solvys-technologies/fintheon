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
};

export const SLOT_LANGUAGES = Object.keys(SLOT_RENDERERS);

const RENDERERS: CustomRenderer[] = SLOT_LANGUAGES.map((language) => ({
  language,
  component: SLOT_RENDERERS[language],
}));

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
  return (
    <Streamdown
      className={className}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      plugins={{ renderers: RENDERERS }}
    >
      {content}
    </Streamdown>
  );
}

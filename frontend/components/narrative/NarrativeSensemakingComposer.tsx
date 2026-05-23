import { NarrativeInputBar } from "./NarrativeInputBar";
import type { QueuedMessage } from "../chat/MessageQueue";
import type { ReasoningLevel } from "../chat/reasoning";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

interface NarrativeSensemakingComposerProps {
  query: string;
  attachedHeadlines: NarrativeHeadlineOption[];
  isSubmitting: boolean;
  validationMessage: string | null;
  reasoningLevel: ReasoningLevel;
  queue: QueuedMessage[];
  mode?: "session" | "opener" | "overlay";
  minHeadlines?: number;
  submitLabel?: string;
  attachLabel?: string;
  narrativeChips?: NarrativeChip[];
  selectedNarrativeSlugs?: Set<string>;
  contextStats?: {
    messageCount: number;
    estimatedTokens: number;
    connectorCount: number;
    activeSkillLabel?: string | null;
  };
  onQueryChange: (value: string) => void;
  onOpenDrawer: () => void;
  onRemoveHeadline: (id: string) => void;
  onSubmit: () => void;
  onQueueMessage: (text: string) => void;
  onEditQueue: (id: string, text: string) => void;
  onRemoveQueue: (id: string) => void;
  onReorderQueue: (fromIdx: number, toIdx: number) => void;
  onSendQueueOne: () => void;
  onSendQueueAll: () => void;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  onToggleNarrative?: (slug: string) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function NarrativeSensemakingComposer({
  contextStats,
  ...props
}: NarrativeSensemakingComposerProps) {
  return (
    <NarrativeInputBar
      {...props}
      contextStats={
        contextStats ?? {
          messageCount: props.attachedHeadlines.length,
          estimatedTokens: estimateTokens(props.query, props.attachedHeadlines),
          connectorCount: props.attachedHeadlines.length,
          activeSkillLabel: "NarrativeFlow",
        }
      }
    />
  );
}

function estimateTokens(
  query: string,
  headlines: NarrativeHeadlineOption[],
): number {
  const headlineText = headlines
    .map((item) => `${item.headline} ${item.summary ?? ""}`)
    .join("\n");
  return Math.ceil(`${query}\n${headlineText}`.length / 4);
}

interface NarrativeChip {
  slug: string;
  label: string;
}

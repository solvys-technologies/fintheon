import { NarrativeInputBar } from "./NarrativeInputBar";
import type { HeadlineAttachment } from "../chat/FintheonAttachPopup";
import type { QueuedMessage } from "../chat/MessageQueue";
import type { ReasoningLevel } from "../chat/reasoning";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import type { NarrativeSelectionChip } from "./narrative-selection";

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
  narrativeChips?: NarrativeSelectionChip[];
  selectedNarrativeSlugs?: Set<string>;
  contextStats?: {
    messageCount: number;
    estimatedTokens: number;
    connectorCount: number;
    activeSkillLabel?: string | null;
  };
  onQueryChange: (value: string) => void;
  onOpenDrawer: () => void;
  onCloseDrawer?: () => void;
  onRemoveHeadline: (id: string) => void;
  onSubmit: (contextSuffix?: string) => void;
  onQueueMessage: (text: string) => void;
  onEditQueue: (id: string, text: string) => void;
  onRemoveQueue: (id: string) => void;
  onReorderQueue: (fromIdx: number, toIdx: number) => void;
  onSendQueueOne: () => void;
  onSendQueueAll: () => void;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  onToggleNarrative?: (slug: string) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  riskflowAlerts?: RiskFlowAlert[];
  onAttachHeadlines?: (items: HeadlineAttachment[]) => void;
  riskFlowDrawerOpen?: boolean;
  caoWolfEnabled?: boolean;
  caoWolfRunKey?: string | number;
  caoWolfReserveSpace?: boolean;
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

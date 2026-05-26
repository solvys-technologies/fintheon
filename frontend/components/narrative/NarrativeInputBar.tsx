import { useRef, useState } from "react";
import { Plug } from "lucide-react";
import { PromptBox } from "../ui/chatgpt-prompt-input";
import { MessageQueue, type QueuedMessage } from "../chat/MessageQueue";
import { FintheonProviderModal } from "../chat/FintheonProviderModal";
import { FintheonProviderTrigger } from "../chat/FintheonProviderTrigger";
import { FintheonToolboxModal } from "../chat/FintheonToolboxModal";
import { RepoChatComposerSurface } from "../chat/composer/RepoChatComposer";
import { useHarperProvider } from "../chat/ProviderDropdown";
import type { HeadlineAttachment } from "../chat/FintheonAttachPopup";
import type { ReasoningLevel } from "../chat/reasoning";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { SKILLS } from "../../lib/skills";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import { NarrativeCaoWolfAvatar } from "./NarrativeCaoWolfAvatar";
import { NarrativeComposerSelector } from "./NarrativeComposerSelector";
import type { NarrativeSelectionChip } from "./narrative-selection";
interface NarrativeContextStats {
  messageCount: number;
  estimatedTokens: number;
  connectorCount: number;
  activeSkillLabel?: string | null;
}
interface NarrativeInputBarProps {
  query: string;
  attachedHeadlines: NarrativeHeadlineOption[];
  isSubmitting: boolean;
  validationMessage: string | null;
  mode?: "session" | "opener" | "overlay";
  minHeadlines?: number;
  submitLabel?: string;
  attachLabel?: string;
  narrativeChips?: NarrativeSelectionChip[];
  selectedNarrativeSlugs?: Set<string>;
  reasoningLevel: ReasoningLevel;
  queue: QueuedMessage[];
  contextStats: NarrativeContextStats;
  onQueryChange: (value: string) => void;
  onOpenDrawer: () => void;
  onCloseDrawer?: () => void;
  onRemoveHeadline: (id: string) => void;
  onSubmit: (message: string) => void;
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

export function NarrativeInputBar({
  query,
  attachedHeadlines,
  isSubmitting,
  validationMessage,
  mode = "session",
  minHeadlines = 1,
  attachLabel = "Headlines",
  narrativeChips = [],
  selectedNarrativeSlugs,
  reasoningLevel,
  queue,
  contextStats,
  onQueryChange,
  onOpenDrawer,
  onCloseDrawer,
  onRemoveHeadline,
  onSubmit,
  onQueueMessage,
  onEditQueue,
  onRemoveQueue,
  onReorderQueue,
  onSendQueueOne,
  onSendQueueAll,
  onReasoningLevelChange,
  onToggleNarrative,
  onPaste,
  riskflowAlerts = [],
  onAttachHeadlines,
  riskFlowDrawerOpen = false,
  caoWolfEnabled = false,
  caoWolfRunKey = 0,
  caoWolfReserveSpace = false,
}: NarrativeInputBarProps) {
  const [showToolboxModal, setShowToolboxModal] = useState(false);
  const [showNarrativeMenu, setShowNarrativeMenu] = useState(false);
  const [showCatalystHint, setShowCatalystHint] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerAnchorRect, setProviderAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const narrativeMenuRef = useRef<HTMLDivElement>(null);
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const { provider, setProvider } = useHarperProvider();
  const isOverlay = mode === "overlay";
  const hasCaoWolfHost = caoWolfReserveSpace || caoWolfEnabled;
  const wrapperClass =
    mode === "opener"
      ? "relative z-20 px-4"
      : isOverlay
        ? "relative z-20 w-full px-2"
        : "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4";
  const hostClass = hasCaoWolfHost
    ? `${wrapperClass} narrative-cao-wolf-composer-host`
    : wrapperClass;
  const hasNarrativeSelector =
    narrativeChips.length > 0 && Boolean(onToggleNarrative);
  const catalystReady = attachedHeadlines.length >= minHeadlines;
  const shouldPromptForCatalysts = query.trim().length > 0 && !catalystReady;
  const headlineChips = attachedHeadlines.map((item) => ({
    id: item.id,
    headline: item.headline,
    severity: item.severity,
  }));

  function handleSend(message: string) {
    if (isSubmitting) {
      onQueueMessage(message);
      return;
    }
    onSubmit(message);
  }

  function canSend(message: string): boolean {
    if (!message.trim()) return false;
    if (shouldPromptForCatalysts) {
      setShowCatalystHint(true);
      return false;
    }
    setShowCatalystHint(false);
    return true;
  }

  function handleAttachOpenChange(open: boolean) {
    if (open === riskFlowDrawerOpen) return;
    if (open) {
      onOpenDrawer();
    } else {
      (onCloseDrawer ?? onOpenDrawer)();
    }
  }

  const narrativeSelector = hasNarrativeSelector ? (
    <NarrativeComposerSelector
      buttonRef={narrativeMenuRef}
      chips={narrativeChips}
      selectedSlugs={selectedNarrativeSlugs}
      isOpen={showNarrativeMenu}
      onToggleOpen={() => setShowNarrativeMenu((open) => !open)}
      onSelect={(slug) => {
        onToggleNarrative?.(slug);
        setShowNarrativeMenu(false);
      }}
    />
  ) : null;

  const providerSlot = (
    <FintheonProviderTrigger
      provider={provider}
      compact={isOverlay}
      onClick={(event) => {
        setProviderAnchorRect(event.currentTarget.getBoundingClientRect());
        setShowProviderModal(true);
      }}
    />
  );

  const toolboxTrigger = !isOverlay ? (
    <button
      type="button"
      onClick={() => setShowToolboxModal((open) => !open)}
      aria-pressed={showToolboxModal}
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        showToolboxModal
          ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
          : "text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
      }`}
      title="Skills and connectors"
    >
      <Plug size={14} />
      {activeIds.length > 0 || selectedNarrativeSlugs?.size ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--fintheon-accent)]" />
      ) : null}
    </button>
  ) : null;

  return (
    <>
      <div className={`${hostClass} narrative-chat-motion`}>
        {caoWolfEnabled ? (
          <NarrativeCaoWolfAvatar runKey={caoWolfRunKey} />
        ) : null}
        <PromptBox
          value={query}
          onValueChange={onQueryChange}
          canSend={canSend}
          onSend={handleSend}
          onPaste={onPaste}
          isProcessing={isSubmitting}
          placeholder={
            mode === "opener"
              ? "What desk narrative are we opening?"
              : isOverlay
                ? "Add a catalyst or instruction..."
                : "Ask how these catalysts connect..."
          }
          thinkHarder={reasoningLevel === "deep" || reasoningLevel === "max"}
          setThinkHarder={(enabled) =>
            onReasoningLevelChange(enabled ? "deep" : "standard")
          }
          reasoningLevel={reasoningLevel}
          onReasoningLevelChange={onReasoningLevelChange}
          activeSkill={null}
          onSelectSkill={() => undefined}
          showSkills={false}
          onToggleSkills={() => undefined}
          compact={isOverlay}
          lastError={validationMessage}
          providerSlot={providerSlot}
          mcpSlot={toolboxTrigger}
          leftToolbarSlot={narrativeSelector}
          toolboxDrawerSlot={
            <FintheonToolboxModal
              open={showToolboxModal}
              onClose={() => setShowToolboxModal(false)}
              skills={SKILLS}
              activeSkill={null}
              onSelectSkill={() => undefined}
              disabledSkills={{}}
              servers={servers}
              activeIds={activeIds}
              onToggleConnector={toggleConnector}
            />
          }
          toolboxOpen={showToolboxModal}
          onInputActivity={() => setShowToolboxModal(false)}
          showAttachSelector
          attachSelectorTitle={attachLabel}
          attachInitialTab="riskflow"
          attachOpen={riskFlowDrawerOpen}
          onAttachOpenChange={handleAttachOpenChange}
          headlineAlerts={riskflowAlerts}
          headlineChips={headlineChips}
          onHeadlineToggle={(chip) => {
            if (attachedHeadlines.some((item) => item.id === chip.id)) {
              onRemoveHeadline(chip.id);
            } else {
              onAttachHeadlines?.([chip]);
            }
          }}
          queueCount={queue.length}
          contextStats={contextStats}
          workDrawerOpen={queue.length > 0}
          workDrawerSlot={
            <RepoChatComposerSurface
              open
              maxHeight="340px"
              className="px-3 py-2"
            >
              <MessageQueue
                queue={queue}
                onEdit={onEditQueue}
                onRemove={onRemoveQueue}
                onReorder={onReorderQueue}
                onSendOne={onSendQueueOne}
                onSendAll={onSendQueueAll}
                storageKey="fintheon:narrative-message-queue"
              />
            </RepoChatComposerSurface>
          }
        />
        {showCatalystHint && shouldPromptForCatalysts ? (
          <div className="pointer-events-none mx-auto mt-2 max-w-[56rem] rounded-md border border-[var(--fintheon-accent)]/20 bg-[#0d0a06]/80 px-3 py-2 text-[11px] leading-4 text-[var(--fintheon-text)]/76">
            Attach {minHeadlines} RiskFlow catalyst
            {minHeadlines === 1 ? "" : "s"} before running this narrative.
          </div>
        ) : null}
      </div>
      <FintheonProviderModal
        open={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        provider={provider}
        onChange={setProvider}
        anchorRect={providerAnchorRect}
      />
    </>
  );
}

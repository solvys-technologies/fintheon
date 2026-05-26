// [codex 2026-05-23] NarrativeFlow domain composer with queue, intelligence, and context stats.
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  GitBranch,
  Loader2,
  Paperclip,
  Plus,
  Plug,
  X,
} from "lucide-react";
import { MessageQueue, type QueuedMessage } from "../chat/MessageQueue";
import {
  FintheonAttachPopup,
  type HeadlineAttachment,
} from "../chat/FintheonAttachPopup";
import { ReasoningLevelSelector } from "../chat/ReasoningLevelSelector";
import { UsageRing } from "../chat/UsageRing";
import { FintheonToolboxModal } from "../chat/FintheonToolboxModal";
import { FintheonProviderModal } from "../chat/FintheonProviderModal";
import { FintheonProviderTrigger } from "../chat/FintheonProviderTrigger";
import { ContextMentionDrawer } from "../chat/ContextMentionDrawer";
import {
  RepoChatComposer,
  RepoChatComposerSurface,
} from "../chat/composer/RepoChatComposer";
import type { ReasoningLevel } from "../chat/reasoning";
import { useHarperProvider } from "../chat/ProviderDropdown";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { SKILLS } from "../../lib/skills";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import {
  formatMentionContext,
  mentionToken,
  type ContextMention,
} from "../../lib/context-mentions";
import { NarrativeCaoWolfAvatar } from "./NarrativeCaoWolfAvatar";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import {
  ALL_NARRATIVES_SLUG,
  hasAllNarratives,
  selectedNarrativeLabel,
  type NarrativeSelectionChip,
} from "./narrative-selection";

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

function getMentionQuery(value: string): string | null {
  const match = value.match(/(^|\s)@([a-zA-Z0-9_.-]{0,48})$/);
  return match ? match[2] : null;
}

function replaceMentionQuery(value: string, item: ContextMention): string {
  const token = mentionToken(item);
  if (/(^|\s)@[a-zA-Z0-9_.-]{0,48}$/.test(value)) {
    return value.replace(/(^|\s)@[a-zA-Z0-9_.-]{0,48}$/, `$1${token} `);
  }
  return `${value}${value.endsWith(" ") || value.length === 0 ? "" : " "}${token} `;
}

export function NarrativeInputBar({
  query,
  attachedHeadlines,
  isSubmitting,
  validationMessage,
  mode = "session",
  minHeadlines = 1,
  submitLabel,
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
  const [focused, setFocused] = useState(false);
  const [showToolboxModal, setShowToolboxModal] = useState(false);
  const [showNarrativeMenu, setShowNarrativeMenu] = useState(false);
  const [showCatalystHint, setShowCatalystHint] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerAnchorRect, setProviderAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const narrativeMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<ContextMention[]>(
    [],
  );
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const { provider, setProvider } = useHarperProvider();
  const isOpener = mode === "opener";
  const isOverlay = mode === "overlay";
  const hasCaoWolfHost = caoWolfReserveSpace || caoWolfEnabled;
  const shouldShowCaoWolf = caoWolfEnabled;
  const catalystCount = attachedHeadlines.length;
  const catalystReady = catalystCount >= minHeadlines;
  const draftReady = query.trim().length > 0;
  const shouldPromptForCatalysts = draftReady && !catalystReady;
  const canSubmit = draftReady && !isSubmitting;
  const canQueue = catalystReady && isSubmitting && draftReady;
  const triggerNarrativeLabel = selectedNarrativeLabel(
    narrativeChips,
    selectedNarrativeSlugs,
  );
  const isAllNarrativesSelected = hasAllNarratives(selectedNarrativeSlugs);
  const hasNarrativeSelector =
    narrativeChips.length > 0 && Boolean(onToggleNarrative);
  const wrapperClass = isOpener
    ? "relative z-20 px-4"
    : isOverlay
      ? "relative z-20 w-full px-2"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4";
  const hostClass = hasCaoWolfHost
    ? `${wrapperClass} narrative-cao-wolf-composer-host`
    : wrapperClass;
  const composerMaxWidth = "56rem";
  const rows = isOpener ? 2 : 1;
  const placeholder = isOpener
    ? "What desk narrative are we opening?"
    : isOverlay
      ? "Add a catalyst or instruction..."
      : "Ask how these catalysts connect...";

  function resizeTextarea(node = textareaRef.current) {
    if (!node) return;
    node.style.height = "auto";
    const nextHeight = Math.min(Math.max(node.scrollHeight, 52), 260);
    node.style.height = `${nextHeight}px`;
    node.style.overflowY = node.scrollHeight > 260 ? "auto" : "hidden";
  }

  function handleAction() {
    const contextSuffix = formatMentionContext(selectedMentions);
    if (canQueue) {
      onQueueMessage(`${query}${contextSuffix}`);
      onQueryChange("");
      setSelectedMentions([]);
      return;
    }
    if (shouldPromptForCatalysts) setShowCatalystHint(true);
    if (canSubmit) {
      onSubmit(contextSuffix);
      setSelectedMentions([]);
    }
  }

  function openProviderModal(event: ReactMouseEvent<HTMLButtonElement>) {
    if (showToolboxModal) setShowToolboxModal(false);
    if (showNarrativeMenu) setShowNarrativeMenu(false);
    if (mentionQuery !== null) setMentionQuery(null);
    if (riskFlowDrawerOpen) (onCloseDrawer ?? onOpenDrawer)();
    setProviderAnchorRect(event.currentTarget.getBoundingClientRect());
    setShowProviderModal(true);
  }

  useEffect(() => {
    resizeTextarea();
  }, [query]);

  useEffect(() => {
    if (!shouldPromptForCatalysts) setShowCatalystHint(false);
  }, [shouldPromptForCatalysts]);

  useEffect(() => {
    if (!showNarrativeMenu) return;
    const close = (event: MouseEvent) => {
      if (!narrativeMenuRef.current?.contains(event.target as Node)) {
        setShowNarrativeMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNarrativeMenu(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showNarrativeMenu]);

  return (
    <>
      <div className={`${hostClass} narrative-chat-motion`}>
        {shouldShowCaoWolf ? (
          <NarrativeCaoWolfAvatar runKey={caoWolfRunKey} />
        ) : null}
        <RepoChatComposer
          format={isOverlay ? "compact" : "full"}
          maxWidth={composerMaxWidth}
          className="pointer-events-auto w-full"
        >
          <FintheonAttachPopup
            open={
              riskFlowDrawerOpen &&
              !showToolboxModal &&
              mentionQuery === null &&
              queue.length === 0
            }
            initialTab="riskflow"
            onClose={onCloseDrawer ?? onOpenDrawer}
            riskflowAlerts={riskflowAlerts}
            onAttachHeadlines={onAttachHeadlines}
          />

          {queue.length > 0 ? (
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
          ) : null}

          {validationMessage ? (
            <div className="pointer-events-auto mb-2 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {validationMessage}
            </div>
          ) : null}

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

          <ContextMentionDrawer
            open={mentionQuery !== null}
            query={mentionQuery ?? ""}
            selected={selectedMentions}
            onClose={() => setMentionQuery(null)}
            onSelect={(item) => {
              setSelectedMentions((current) =>
                current.some((mention) => mention.id === item.id)
                  ? current
                  : [...current, item],
              );
              onQueryChange(replaceMentionQuery(query, item));
              setMentionQuery(null);
            }}
          />

          <div
            className={`fintheon-composer-input narrative-composer-shell relative flex flex-col rounded-2xl border backdrop-blur-xl transition ${
              showToolboxModal ||
              mentionQuery !== null ||
              queue.length > 0 ||
              riskFlowDrawerOpen
                ? "fintheon-composer-input--drawer-open"
                : ""
            } ${
              focused
                ? "border-[var(--fintheon-accent)]/55"
                : query
                  ? "border-[var(--fintheon-accent)]/40"
                  : "border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25"
            }`}
            style={{
              background:
                focused || query ? "rgba(13,12,9,0.98)" : "transparent",
              transition: "border-color 0.2s ease, background 0.2s ease",
            }}
          >
            {attachedHeadlines.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto px-3 pt-3">
                {attachedHeadlines.map((item) => (
                  <span
                    key={item.id}
                    className="narrative-chip-motion inline-flex max-w-[240px] shrink-0 items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/8 px-2 py-1 text-[11px] text-[var(--fintheon-accent)]"
                  >
                    <GitBranch size={12} />
                    <span className="truncate">{item.headline}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveHeadline(item.id)}
                      className="text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
                      title="Remove headline"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={query}
              onChange={(event) => {
                if (showToolboxModal) setShowToolboxModal(false);
                setMentionQuery(getMentionQuery(event.target.value));
                resizeTextarea(event.currentTarget);
                onQueryChange(event.target.value);
              }}
              onPaste={(event) => {
                onPaste?.(event);
                window.requestAnimationFrame(() => resizeTextarea());
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleAction();
                }
              }}
              placeholder={placeholder}
              rows={rows}
              className="max-h-[260px] min-h-[52px] w-full resize-none overflow-y-hidden bg-transparent px-4 py-3 text-[13px] leading-6 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (showToolboxModal) setShowToolboxModal(false);
                    if (showNarrativeMenu) setShowNarrativeMenu(false);
                    onOpenDrawer();
                  }}
                  aria-pressed={riskFlowDrawerOpen}
                  className={`narrative-icon-button flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    riskFlowDrawerOpen
                      ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                      : shouldPromptForCatalysts
                        ? "border border-[var(--fintheon-accent)]/22 bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]"
                        : "text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
                  }`}
                  title={attachLabel}
                >
                  {isOpener ? <Paperclip size={15} /> : <Plus size={15} />}
                </button>
                {hasNarrativeSelector ? (
                  <div ref={narrativeMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (showToolboxModal) setShowToolboxModal(false);
                        if (riskFlowDrawerOpen)
                          (onCloseDrawer ?? onOpenDrawer)();
                        setShowNarrativeMenu((open) => !open);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={showNarrativeMenu}
                      className={`narrative-icon-button flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] transition-colors ${
                        showNarrativeMenu
                          ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                          : "text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
                      }`}
                      title="Select Narrative"
                    >
                      <GitBranch size={13} />
                      {!isOverlay ? (
                        <span className="max-w-[112px] truncate">
                          {triggerNarrativeLabel ?? "Select Narrative"}
                        </span>
                      ) : null}
                      <ChevronDown size={10} className="opacity-55" />
                    </button>
                    {showNarrativeMenu ? (
                      <div
                        role="menu"
                        className="absolute bottom-10 left-0 z-50 w-64 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/16 bg-[#0d0a06]"
                      >
                        <div className="border-b border-[var(--fintheon-accent)]/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
                          Select Narrative
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1">
                          {narrativeChips.map((chip) => {
                            const selected =
                              selectedNarrativeSlugs?.has(chip.slug) ??
                              (chip.slug === ALL_NARRATIVES_SLUG &&
                                isAllNarrativesSelected);
                            const chipColor =
                              chip.color ?? "var(--fintheon-accent)";
                            return (
                              <button
                                key={chip.slug}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onClick={() => {
                                  onToggleNarrative?.(chip.slug);
                                  setShowNarrativeMenu(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left transition ${
                                  selected
                                    ? "text-[var(--fintheon-accent)]"
                                    : "text-[var(--fintheon-text)]/74 hover:bg-[var(--fintheon-accent)]/7 hover:text-[var(--fintheon-text)]"
                                }`}
                                style={
                                  selected
                                    ? {
                                        color:
                                          chip.slug === ALL_NARRATIVES_SLUG
                                            ? "var(--fintheon-accent)"
                                            : chipColor,
                                      }
                                    : undefined
                                }
                              >
                                {selected ? (
                                  <Check size={12} className="shrink-0" />
                                ) : (
                                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-[var(--fintheon-accent)]/12 bg-black/20">
                                    <span
                                      className="h-2.5 w-2.5 rounded-[3px]"
                                      style={{ backgroundColor: chipColor }}
                                    />
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                                  {chip.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!isOverlay ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (showNarrativeMenu) setShowNarrativeMenu(false);
                      if (!showToolboxModal && riskFlowDrawerOpen) {
                        (onCloseDrawer ?? onOpenDrawer)();
                      }
                      setShowToolboxModal((open) => !open);
                    }}
                    aria-pressed={showToolboxModal}
                    className={`narrative-icon-button relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
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
                ) : null}
              </div>

              <div className="flex min-w-0 items-center gap-1">
                <FintheonProviderTrigger
                  provider={provider}
                  compact={isOverlay}
                  onClick={openProviderModal}
                />
                <ReasoningLevelSelector
                  value={reasoningLevel}
                  onChange={onReasoningLevelChange}
                  compact={isOverlay}
                />
                <UsageRing
                  stats={contextStats}
                  draftText={query}
                  queuedCount={queue.length}
                />
                <div className="relative">
                  {showCatalystHint && shouldPromptForCatalysts ? (
                    <div className="pointer-events-none absolute bottom-11 right-0 z-50 w-56 rounded-md border border-[var(--fintheon-accent)]/20 bg-[#0d0a06] px-3 py-2 text-[11px] leading-4 text-[var(--fintheon-text)]/76">
                      Attach {minHeadlines} RiskFlow catalyst
                      {minHeadlines === 1 ? "" : "s"} to build this narrative.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleAction}
                    onFocus={() => setShowCatalystHint(true)}
                    onBlur={() => setShowCatalystHint(false)}
                    onMouseEnter={() => setShowCatalystHint(true)}
                    onMouseLeave={() => setShowCatalystHint(false)}
                    disabled={!canSubmit && !canQueue}
                    className="fintheon-send-button inline-flex h-9 w-9 items-center justify-center rounded-full"
                    title={
                      shouldPromptForCatalysts
                        ? "Attach RiskFlow catalysts"
                        : canQueue
                          ? "Queue narrative request"
                          : (submitLabel ?? "Run narrative request")
                    }
                  >
                    {isSubmitting && !canQueue ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowUp size={16} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </RepoChatComposer>
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

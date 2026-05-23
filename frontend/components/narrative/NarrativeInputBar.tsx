// [codex 2026-05-23] NarrativeFlow domain composer with queue, intelligence, and context stats.
import { useMemo, useState } from "react";
import {
  ArrowUp,
  GitBranch,
  Loader2,
  Paperclip,
  Plus,
  Plug,
  X,
} from "lucide-react";
import { MessageQueue, type QueuedMessage } from "../chat/MessageQueue";
import { ReasoningLevelSelector } from "../chat/ReasoningLevelSelector";
import { UsageRing } from "../chat/UsageRing";
import { FintheonToolboxModal } from "../chat/FintheonToolboxModal";
import type { ReasoningLevel } from "../chat/reasoning";
import { useMcpConnectors } from "../../hooks/useMcpConnectors";
import { SKILLS } from "../../lib/skills";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

interface NarrativeChip {
  slug: string;
  label: string;
}

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
  narrativeChips?: NarrativeChip[];
  selectedNarrativeSlugs?: Set<string>;
  reasoningLevel: ReasoningLevel;
  queue: QueuedMessage[];
  contextStats: NarrativeContextStats;
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

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function keepNarrativeMentionsOnly(
  value: string,
  chips: NarrativeChip[],
): string {
  if (chips.length === 0) return value.replace(/@(?=[a-z0-9_-])/gi, "");
  const allowed = new Set(
    chips.flatMap((chip) => [
      normalizeKey(chip.slug),
      normalizeKey(chip.label),
    ]),
  );
  return value.replace(/@([a-z0-9][a-z0-9_-]*)/gi, (match, raw) =>
    allowed.has(normalizeKey(raw)) ? match : raw,
  );
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
}: NarrativeInputBarProps) {
  const [focused, setFocused] = useState(false);
  const [showToolboxModal, setShowToolboxModal] = useState(false);
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const isOpener = mode === "opener";
  const isOverlay = mode === "overlay";
  const catalystCount = attachedHeadlines.length;
  const catalystReady = catalystCount >= minHeadlines;
  const draftReady = query.trim().length > 0;
  const canSubmit = catalystReady && draftReady && !isSubmitting;
  const canQueue = catalystReady && isSubmitting && draftReady;
  const shellClass = isOpener
    ? "pointer-events-auto mx-auto w-full max-w-3xl"
    : isOverlay
      ? "pointer-events-auto mx-auto w-full max-w-[520px]"
      : "pointer-events-auto mx-auto w-full max-w-4xl";
  const wrapperClass = isOpener
    ? "relative z-20 px-4"
    : isOverlay
      ? "relative z-20 px-2"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4";
  const rows = isOpener ? 2 : 1;
  const placeholder = isOpener
    ? "What desk narrative are we opening?"
    : isOverlay
      ? "Add a catalyst or instruction..."
      : "Ask how these catalysts connect...";

  const statusText = useMemo(() => {
    if (queue.length > 0) return `[${queue.length} QUEUED]`;
    if (isSubmitting) return "[WORKING]";
    if (minHeadlines <= 0) return "[READY]";
    return `[${catalystCount}/${minHeadlines} CATALYSTS]`;
  }, [catalystCount, catalystReady, draftReady, isSubmitting, minHeadlines, queue.length, validationMessage]);

  function handleAction() {
    if (canQueue) {
      onQueueMessage(query);
      onQueryChange("");
      return;
    }
    if (canSubmit) onSubmit();
  }

  return (
    <>
    <div className={wrapperClass}>
      <div className={shellClass}>
        {queue.length > 0 ? (
          <div
            className="fintheon-chat-input-drawer pointer-events-auto px-3 py-2"
            style={{
              maxHeight: "340px",
            }}
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
          </div>
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

        <div
          className={`relative flex flex-col rounded-2xl border backdrop-blur-xl transition ${
            focused
              ? "border-[var(--fintheon-accent)]/55"
              : query
                ? "border-[var(--fintheon-accent)]/40"
                : "border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25"
          }`}
          style={{
            background:
              focused || query
                ? "rgba(13,12,9,0.98)"
                : "transparent",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          {attachedHeadlines.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto px-3 pt-3">
              {attachedHeadlines.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex max-w-[240px] shrink-0 items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/8 px-2 py-1 text-[11px] text-[var(--fintheon-accent)]"
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
            value={query}
            onChange={(event) => {
              if (showToolboxModal) setShowToolboxModal(false);
              onQueryChange(
                keepNarrativeMentionsOnly(event.target.value, narrativeChips),
              );
            }}
            onPaste={onPaste}
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
            className="max-h-[150px] min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-6 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (showToolboxModal) setShowToolboxModal(false);
                  onOpenDrawer();
                }}
                className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
                title="Attach RiskFlow headlines"
              >
                {isOpener ? <Paperclip size={15} /> : <Plus size={15} />}
                {!isOverlay ? attachLabel : null}
              </button>
              {!isOverlay ? (
                <button
                  type="button"
                  onClick={() => setShowToolboxModal((open) => !open)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
                  title="Skills and connectors"
                >
                  <Plug size={14} />
                  {(activeIds.length > 0 || selectedNarrativeSlugs?.size) ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--fintheon-accent)]" />
                  ) : null}
                </button>
              ) : null}
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <ReasoningLevelSelector
                value={reasoningLevel}
                onChange={onReasoningLevelChange}
                compact={isOverlay}
              />
              {statusText ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
                  {statusText}
                </span>
              ) : null}
              <UsageRing
                stats={contextStats}
                draftText={query}
                queuedCount={queue.length}
              />
              <button
                type="button"
                onClick={handleAction}
                disabled={!canSubmit && !canQueue}
                className="fintheon-send-button inline-flex h-9 w-9 items-center justify-center rounded-full"
                title={canQueue ? "Queue narrative request" : (submitLabel ?? "Run narrative request")}
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
    </div>
    </>
  );
}

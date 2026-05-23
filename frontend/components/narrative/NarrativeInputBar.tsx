// [codex 2026-05-23] NarrativeFlow domain composer with queue, intelligence, and context stats.
import { useMemo, useState } from "react";
import {
  GitBranch,
  Loader2,
  Paperclip,
  Plus,
  Send,
  X,
} from "lucide-react";
import { MessageQueue, type QueuedMessage } from "../chat/MessageQueue";
import { ReasoningLevelSelector } from "../chat/ReasoningLevelSelector";
import { UsageRing } from "../chat/UsageRing";
import type { ReasoningLevel } from "../chat/reasoning";
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
    if (validationMessage) return validationMessage;
    if (queue.length > 0) return `[${queue.length} QUEUED]`;
    if (isSubmitting) return "[WORKING]";
    if (!draftReady) return "[ENTER REQUEST]";
    if (minHeadlines <= 0) return "[READY]";
    if (!catalystReady) return `[SELECT ${minHeadlines} CATALYSTS]`;
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
    <div className={wrapperClass}>
      <div className={shellClass}>
        {queue.length > 0 ? (
          <div className="pointer-events-auto mb-2 rounded-lg border border-[var(--fintheon-accent)]/12 bg-[#070604] px-3 py-2">
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

        <div
          className={`rounded-2xl border backdrop-blur-xl transition ${
            focused
              ? "border-[var(--fintheon-accent)]/55"
              : query
                ? "border-[var(--fintheon-accent)]/40"
                : "border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25"
          }`}
          style={{
            background:
              focused || query ? "rgba(13,12,9,0.98)" : "transparent",
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

          {narrativeChips.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {narrativeChips.map((chip) => {
                const isSelected = selectedNarrativeSlugs?.has(chip.slug) ?? false;
                return (
                  <button
                    key={chip.slug}
                    type="button"
                    onClick={() => onToggleNarrative?.(chip.slug)}
                    className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                      isSelected
                        ? "border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
                        : "border-[var(--fintheon-accent)]/12 text-[var(--fintheon-muted)]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <textarea
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
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
                onClick={onOpenDrawer}
                className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
                title="Attach RiskFlow headlines"
              >
                {isOpener ? <Paperclip size={15} /> : <Plus size={15} />}
                {!isOverlay ? attachLabel : null}
              </button>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/50 sm:inline">
                NarrativeFlow
              </span>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <ReasoningLevelSelector
                value={reasoningLevel}
                onChange={onReasoningLevelChange}
                compact={isOverlay}
              />
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
                {statusText}
              </span>
              <UsageRing
                stats={contextStats}
                draftText={query}
                queuedCount={queue.length}
              />
              <button
                type="button"
                onClick={handleAction}
                disabled={!canSubmit && !canQueue}
                className={`inline-flex h-9 items-center justify-center transition ${
                  submitLabel
                    ? "rounded-md px-3 text-[11px] uppercase tracking-[0.12em]"
                    : "w-9 rounded-full"
                } ${
                  canSubmit || canQueue
                    ? "bg-[var(--fintheon-accent)] text-black hover:brightness-110"
                    : "bg-[var(--fintheon-accent)]/25 text-black/40"
                }`}
                title={canQueue ? "Queue narrative request" : "Run narrative request"}
              >
                {isSubmitting && !canQueue ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : submitLabel ? (
                  submitLabel
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

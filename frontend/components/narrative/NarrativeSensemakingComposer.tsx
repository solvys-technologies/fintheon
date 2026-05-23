import { GitBranch, Loader2, Paperclip, Plus, Send, X } from "lucide-react";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

interface NarrativeSensemakingComposerProps {
  query: string;
  attachedHeadlines: NarrativeHeadlineOption[];
  isSubmitting: boolean;
  validationMessage: string | null;
  mode?: "session" | "opener";
  minHeadlines?: number;
  submitLabel?: string;
  attachLabel?: string;
  narrativeChips?: NarrativeChip[];
  selectedNarrativeSlugs?: Set<string>;
  onQueryChange: (value: string) => void;
  onOpenDrawer: () => void;
  onRemoveHeadline: (id: string) => void;
  onSubmit: () => void;
  onToggleNarrative?: (slug: string) => void;
}

export function NarrativeSensemakingComposer({
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
  onQueryChange,
  onOpenDrawer,
  onRemoveHeadline,
  onSubmit,
  onToggleNarrative,
}: NarrativeSensemakingComposerProps) {
  const canSubmit = attachedHeadlines.length >= minHeadlines && !isSubmitting;
  const isOpener = mode === "opener";
  const shellClass = isOpener
    ? "pointer-events-auto mx-auto w-full max-w-3xl"
    : "pointer-events-auto mx-auto max-w-4xl";
  const frameClass = isOpener
    ? "rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]"
    : "rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/96";
  const wrapperClass = isOpener
    ? "relative z-20 px-4"
    : "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4";
  const placeholder = isOpener
    ? "What desk narrative are we opening?"
    : "Ask how these catalysts connect...";

  return (
    <div className={wrapperClass}>
      <div className={shellClass}>
        {validationMessage ? (
          <div className="mb-2 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {validationMessage}
          </div>
        ) : null}

        <div className={frameClass}>
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
            placeholder={placeholder}
            rows={isOpener ? 2 : 1}
            className="max-h-[150px] min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-6 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
              title="Attach RiskFlow headlines"
            >
              {isOpener ? <Paperclip size={15} /> : <Plus size={15} />}
              {attachLabel}
            </button>
            {isOpener ? (
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
                [{attachedHeadlines.length}/{minHeadlines} catalysts]
              </span>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`inline-flex h-9 items-center justify-center transition ${
                submitLabel ? "rounded-md px-3 text-[11px] uppercase tracking-[0.12em]" : "w-9 rounded-full"
              } ${
                canSubmit
                  ? "bg-[var(--fintheon-accent)] text-black hover:brightness-110"
                  : "bg-[var(--fintheon-accent)]/25 text-black/40"
              }`}
              title="Build narrative"
            >
              {isSubmitting ? (
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
  );
}

interface NarrativeChip {
  slug: string;
  label: string;
}

import { GitBranch, Loader2, Plus, Send, X } from "lucide-react";
import type { NarrativeHeadlineOption } from "./sensemaking-types";

interface NarrativeSensemakingComposerProps {
  query: string;
  attachedHeadlines: NarrativeHeadlineOption[];
  isSubmitting: boolean;
  validationMessage: string | null;
  onQueryChange: (value: string) => void;
  onOpenDrawer: () => void;
  onRemoveHeadline: (id: string) => void;
  onSubmit: () => void;
}

export function NarrativeSensemakingComposer({
  query,
  attachedHeadlines,
  isSubmitting,
  validationMessage,
  onQueryChange,
  onOpenDrawer,
  onRemoveHeadline,
  onSubmit,
}: NarrativeSensemakingComposerProps) {
  const canSubmit = attachedHeadlines.length > 0 && !isSubmitting;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
      <div className="pointer-events-auto mx-auto max-w-4xl">
        {validationMessage ? (
          <div className="mb-2 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {validationMessage}
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/96 backdrop-blur-xl">
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
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Ask how these catalysts connect..."
            rows={1}
            className="max-h-[150px] min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-6 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
            >
              <Plus size={15} />
              Headlines
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                canSubmit
                  ? "bg-[var(--fintheon-accent)] text-black hover:brightness-110"
                  : "bg-[var(--fintheon-accent)]/25 text-black/40"
              }`}
              title="Build narrative"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

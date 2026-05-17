import { AlertTriangle, CircleDot, GitBranch, RefreshCw } from "lucide-react";
import type { NarrativeHypothesis } from "../../../backend-hono/src/services/narrative-orchestra/types";

interface NarrativeStorySpineProps {
  hypotheses: NarrativeHypothesis[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  source: "fallback" | "lounge";
  fallbackReason: string | null;
  themeCount: number;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function NarrativeStorySpine({
  hypotheses,
  selectedId,
  isLoading,
  error,
  source,
  fallbackReason,
  themeCount,
  onSelect,
  onRefresh,
}: NarrativeStorySpineProps) {
  return (
    <aside className="t-panel-slide min-h-0 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]" data-open="true">
      <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
            Story Spine
          </p>
          <p className="text-xs text-[var(--fintheon-muted)]">
            {source === "lounge" ? "Lounge" : "Tracker"} · {themeCount} themes
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-[var(--fintheon-accent)]/20 p-2 text-[var(--fintheon-accent)]/75 transition hover:bg-[var(--fintheon-accent)]/10"
          title="Refresh projection"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="max-h-full space-y-2 overflow-y-auto p-2">
        {isLoading ? <StateLine text="[LOADING...]" /> : null}
        {error ? <StateLine text={`[ERROR: ${error}]`} icon={<AlertTriangle size={14} />} /> : null}
        {!isLoading && hypotheses.length === 0 ? (
          <StateLine text="[NO LIVE STORIES]" />
        ) : null}

        {hypotheses.map((hypothesis) => {
          const isSelected = hypothesis.id === selectedId;
          return (
            <button
              key={hypothesis.id}
              type="button"
              onClick={() => onSelect(hypothesis.id)}
              className={`w-full rounded-md border p-3 text-left transition ${
                isSelected
                  ? "border-[var(--fintheon-accent)]/55 bg-[var(--fintheon-accent)]/10"
                  : "border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/50 hover:border-[var(--fintheon-accent)]/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <CircleDot
                  size={15}
                  className={isSelected ? "text-[var(--fintheon-accent)]" : "text-[var(--fintheon-muted)]"}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--fintheon-text)]">
                    {hypothesis.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--fintheon-muted)]">
                    {hypothesis.thesis}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
                <span>{Math.round(hypothesis.confidence * 100)} conf</span>
                <span>{hypothesis.evidence.length} evidence</span>
                <span>{hypothesis.routingDecision.status.replace("_", " ")}</span>
              </div>
            </button>
          );
        })}

        {fallbackReason ? (
          <div className="rounded-md border border-[var(--fintheon-accent)]/10 px-3 py-2 text-xs leading-5 text-[var(--fintheon-muted)]">
            {fallbackReason}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function StateLine({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      {icon ?? <GitBranch size={14} />}
      <span>{text}</span>
    </div>
  );
}

import { MessageSquare, RadioTower } from "lucide-react";
import type { NarrativeHypothesis } from "../../../backend-hono/src/services/narrative-orchestra/types";

interface NarrativeAgentRailProps {
  hypothesis: NarrativeHypothesis | null;
}

export function NarrativeAgentRail({ hypothesis }: NarrativeAgentRailProps) {
  const entries = hypothesis?.deliberationSummary.entries ?? [];
  const consensus = hypothesis?.deliberationSummary.consensus;

  return (
    <aside className="fintheon-rail-surface t-panel-slide min-h-0 p-3" data-open="true">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
            Agent Rail
          </p>
          <p className="text-xs text-[var(--fintheon-muted)]">
            {hypothesis?.deliberationSummary.status ?? "idle"}
          </p>
        </div>
        <RadioTower size={16} className="text-[var(--fintheon-accent)]/70" />
      </div>

      {consensus ? (
        <div className="mb-3 rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/8 p-3 text-xs leading-5 text-[var(--fintheon-text)]">
          {consensus}
        </div>
      ) : null}

      <div className="space-y-2 overflow-y-auto">
        {!hypothesis ? (
          <RailState text="[SELECT STORY]" />
        ) : entries.length === 0 ? (
          <RailState text="[AWAITING DELIBERATION]" />
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-[var(--fintheon-text)]">
                  {entry.agentName}
                </p>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/75">
                  {entry.stance}
                </span>
              </div>
              <p className="line-clamp-4 text-xs leading-5 text-[var(--fintheon-muted)]">
                {entry.summary}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
                {Math.round(entry.confidence * 100)} confidence
              </p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function RailState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/10 px-3 py-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      <MessageSquare size={14} />
      <span>{text}</span>
    </div>
  );
}

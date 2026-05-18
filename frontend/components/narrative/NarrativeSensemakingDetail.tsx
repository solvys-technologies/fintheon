import { Activity, Clock, TrendingUp } from "lucide-react";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "./sensemaking-types";

interface NarrativeSensemakingDetailProps {
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
}

export function NarrativeSensemakingDetail({
  response,
  selectedNodeId,
}: NarrativeSensemakingDetailProps) {
  const selected = getSelected(response, selectedNodeId);
  const catalyst = selected
    ? [...response!.anchorCatalysts, ...response!.relatedCatalysts].find(
        (item) => item.id === selected.catalystId,
      )
    : null;

  return (
    <aside className="w-[330px] shrink-0 border-l border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/92 p-4">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
          Synthesis
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
          {response?.synthesisSummary ?? "Build a narrative map to see related catalysts."}
        </p>
      </div>

      {response?.forecast ? (
        <section className="mb-4 rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/8 p-3">
          <div className="mb-2 flex items-center gap-2 text-[var(--fintheon-accent)]">
            <TrendingUp size={14} />
            <span className="text-[10px] uppercase tracking-[0.16em]">
              Forecastable
            </span>
          </div>
          <p className="text-xs leading-5 text-[var(--fintheon-text)]">
            {response.forecast.outcome}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
            {Math.round(response.forecast.confidence * 100)} confidence · {response.forecast.rationale}
          </p>
        </section>
      ) : null}

      <section className="rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/60 p-3">
        <div className="mb-3 flex items-center gap-2 text-[var(--fintheon-accent)]/75">
          <Activity size={14} />
          <span className="text-[10px] uppercase tracking-[0.16em]">
            Selected Catalyst
          </span>
        </div>
        {catalyst ? (
          <CatalystDetail catalyst={catalyst} />
        ) : (
          <p className="text-xs leading-5 text-[var(--fintheon-muted)]">
            Select a timeline node to inspect the main catalyst and adjacent notable events.
          </p>
        )}
      </section>

      {response ? (
        <section className="mt-4 min-h-0">
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
            Other Notable Catalysts
          </p>
          <div className="max-h-[280px] space-y-2 overflow-y-auto">
            {response.relatedCatalysts.slice(0, 10).map((item) => (
              <article
                key={item.id}
                className="rounded-md border border-[var(--fintheon-accent)]/10 p-2"
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] text-[var(--fintheon-muted)]">
                  <Clock size={11} />
                  <span>{formatDate(item.publishedAt)}</span>
                  <span>{item.relationScore} rel</span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-[var(--fintheon-text)]">
                  {item.headline}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function CatalystDetail({ catalyst }: { catalyst: SensemakingCatalyst }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[var(--fintheon-muted)]">
        <span className="uppercase tracking-[0.14em]">{catalyst.role}</span>
        <span>{formatDate(catalyst.publishedAt)}</span>
      </div>
      <h3 className="text-sm font-medium leading-5 text-[var(--fintheon-text)]">
        {catalyst.headline}
      </h3>
      <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
        {catalyst.agentNote ?? catalyst.summary}
      </p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/65">
        {catalyst.relationReason}
      </p>
    </div>
  );
}

function getSelected(
  response: SensemakingResponse | null,
  selectedNodeId: string | null,
): SensemakingTimelineNode | null {
  if (!response) return null;
  return (
    response.timelineNodes.find((item) => item.id === selectedNodeId) ??
    response.timelineNodes[0] ??
    null
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

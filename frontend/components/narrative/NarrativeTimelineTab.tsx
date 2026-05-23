import type {
  SensemakingCatalyst,
  SensemakingResponse,
} from "./sensemaking-types";
import { safeNarrativeText } from "../../lib/market-impact-format";

interface NarrativeTimelineTabProps {
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  conflictLabels?: Record<string, string>;
  onSelectNode?: (id: string) => void;
}

interface TimelineRow {
  catalyst: SensemakingCatalyst;
  nodeId: string | null;
  conflict: string;
}

export function NarrativeTimelineTab({
  response,
  selectedNodeId,
  conflictLabels = {},
  onSelectNode,
}: NarrativeTimelineTabProps) {
  const rows = buildRows(response, conflictLabels);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--fintheon-accent)]/12 p-4 text-xs leading-5 text-[var(--fintheon-muted)]">
        Timeline rows will appear after catalysts are loaded.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {rows.map((row, index) => {
        const isSelected = row.nodeId === selectedNodeId;
        return (
          <button
            key={row.catalyst.id}
            type="button"
            onClick={() => row.nodeId && onSelectNode?.(row.nodeId)}
            className="grid w-full grid-cols-[18px_minmax(0,1fr)] gap-3 text-left"
          >
            <Ruler isFirst={index === 0} isLast={index === rows.length - 1} />
            <article
              className={`mb-3 rounded-md border p-3 transition ${
                isSelected
                  ? "border-[var(--fintheon-accent)]/50 bg-[var(--fintheon-accent)]/8"
                  : "border-[var(--fintheon-accent)]/12 hover:border-[var(--fintheon-accent)]/28"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                    {formatDateTime(row.catalyst.publishedAt)}
                  </p>
                  <h4 className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[var(--fintheon-text)]">
                    {row.catalyst.headline}
                  </h4>
                </div>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${conflictClass(row.conflict)}`}>
                  {row.conflict}
                </span>
              </div>
              <p className="line-clamp-3 text-[11px] leading-4 text-[var(--fintheon-muted)]">
                {safeNarrativeText(row.catalyst.marketImpact, row.catalyst.summary) ?? "No narrative summary yet."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <MiniChip>{row.catalyst.role === "anchor" ? "MAIN" : "CATALYST"}</MiniChip>
                <MiniChip>{`IV ${row.catalyst.ivScore}`}</MiniChip>
                {row.catalyst.symbols.slice(0, 3).map((symbol) => (
                  <MiniChip key={symbol}>{symbol}</MiniChip>
                ))}
              </div>
            </article>
          </button>
        );
      })}
    </div>
  );
}

function Ruler({ isFirst, isLast }: { isFirst: boolean; isLast: boolean }) {
  return (
    <div className="flex h-full flex-col items-center">
      <span className={`w-px flex-1 bg-[var(--fintheon-accent)] ${isFirst ? "opacity-0" : "opacity-10"}`} />
      <span className="h-2 w-2 rounded-full border border-[var(--fintheon-accent)]/45 bg-[var(--fintheon-bg)]" />
      <span className={`w-px flex-1 bg-[var(--fintheon-accent)] ${isLast ? "opacity-0" : "opacity-20"}`} />
    </div>
  );
}

function MiniChip({ children }: { children: string | number }) {
  return (
    <span className="rounded border border-[var(--fintheon-accent)]/12 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fintheon-muted)]">
      {children}
    </span>
  );
}

function buildRows(
  response: SensemakingResponse | null,
  conflictLabels: Record<string, string>,
): TimelineRow[] {
  if (!response) return [];
  const nodeByCatalyst = new Map(response.timelineNodes.map((node) => [node.catalystId, node.id]));
  return [...response.anchorCatalysts, ...response.relatedCatalysts]
    .sort((left, right) => new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime())
    .map((catalyst) => ({
      catalyst,
      nodeId: nodeByCatalyst.get(catalyst.id) ?? null,
      conflict: conflictLabels[catalyst.id] ?? "NEEDS CLASSIFICATION",
    }));
}

function conflictClass(conflict: string): string {
  const normalized = conflict.toLowerCase();
  if (normalized.includes("conflict")) return "border-red-400/35 text-red-300";
  if (normalized.includes("confirmed")) return "border-emerald-400/35 text-emerald-300";
  return "border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/75";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

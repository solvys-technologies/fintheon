import type {
  SensemakingCatalyst,
  SensemakingResponse,
} from "./sensemaking-types";
import type { CSSProperties } from "react";
import { toNarrativeCatalystCard } from "./sensemaking-catalyst-adapter";
import { RiskFlowCardAnatomy } from "../feed/RiskFlowCardAnatomy";
import {
  catalystDirection,
  catalystFuseScore,
  catalystIvScore,
  catalystSeverityToFuse,
  catalystSourceLabel,
} from "../../lib/catalyst-riskflow-utils";
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
  const groups = groupRowsByDate(rows);
  const anchorCount = rows.filter(
    (row) => row.catalyst.role === "anchor",
  ).length;
  const selectedRow =
    rows.find((row) => row.nodeId === selectedNodeId) ?? rows[0];
  const focusedTitle =
    selectedRow?.catalyst.narrativeThreads[0]?.replaceAll("-", " ") ??
    response?.narrativeGroups[0]?.title ??
    "Focused narrative";

  if (rows.length === 0) {
    return (
      <div className="fading-ruler-bottom px-3 py-4 text-xs leading-5 text-[var(--fintheon-muted)]">
        Timeline rows will appear after catalysts are loaded.
      </div>
    );
  }

  return (
    <div className="narrative-focused-timeline -mx-1 space-y-4 px-1">
      <header className="fading-ruler-bottom px-2 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/75">
              Timeline
            </p>
            <h3 className="mt-1 truncate text-sm font-medium capitalize text-[var(--fintheon-text)]">
              {focusedTitle}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-[var(--fintheon-muted)]">
            {rows.length}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MiniChip>{`${anchorCount} anchors`}</MiniChip>
          <MiniChip>{`${rows.length - anchorCount} related`}</MiniChip>
          <MiniChip>
            {response?.forecast
              ? `${Math.round(response.forecast.confidence * 100)}% watch`
              : "watchlist"}
          </MiniChip>
        </div>
      </header>

      <div className="relative pl-2">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-[5px] top-1 w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(199,159,74,0.24) 10%, rgba(199,159,74,0.14) 86%, transparent)",
          }}
        />
        {groups.map(([dateLabel, groupRows]) => (
          <section key={dateLabel} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-2 pl-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/65">
                {dateLabel}
              </span>
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(to right, rgba(199,159,74,0.16), transparent)",
                }}
              />
            </div>
            <div className="space-y-3">
              {groupRows.map((row, index) => (
                <TimelineEventRow
                  key={row.catalyst.id}
                  row={row}
                  isSelected={row.nodeId === selectedNodeId}
                  staggerIndex={index}
                  onSelectNode={onSelectNode}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TimelineEventRow({
  row,
  isSelected,
  staggerIndex,
  onSelectNode,
}: {
  row: TimelineRow;
  isSelected: boolean;
  staggerIndex: number;
  onSelectNode?: (id: string) => void;
}) {
  const card = toNarrativeCatalystCard(row.catalyst);
  const summary =
    safeNarrativeText(row.catalyst.marketImpact, row.catalyst.summary) ??
    "No narrative summary yet.";

  return (
    <article
      className="narrative-fade-item group relative grid grid-cols-[16px_minmax(0,1fr)] gap-3"
      style={
        { "--narrative-fade-delay": `${staggerIndex * 45}ms` } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className={`relative mt-2 h-2 w-2 rounded-full border bg-[var(--fintheon-bg)] transition ${
          isSelected
            ? "border-[var(--fintheon-accent)]"
            : "border-[var(--fintheon-accent)]/35 group-hover:border-[var(--fintheon-accent)]/60"
        }`}
      />
      <button
        type="button"
        onClick={() => row.nodeId && onSelectNode?.(row.nodeId)}
        className={`fading-ruler-bottom w-full pb-3 text-left transition hover:translate-x-0.5 ${
          isSelected
            ? "text-[var(--fintheon-text)]"
            : "text-[var(--fintheon-muted)]"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/70">
            {formatTime(row.catalyst.publishedAt)}
          </span>
          <span
            className={`shrink-0 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${conflictClass(row.conflict)}`}
          >
            {row.conflict}
          </span>
        </div>
        <RiskFlowCardAnatomy
          title={row.catalyst.headline}
          sourceLabel={catalystSourceLabel(card)}
          timestampLabel={formatDateTime(row.catalyst.publishedAt)}
          severity={catalystSeverityToFuse(card.severity)}
          fuseScore={catalystFuseScore(card)}
          ivScore={catalystIvScore(card)}
          direction={catalystDirection(card)}
          compact
          selected={isSelected}
        />
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
          {summary}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <MiniChip>
            {row.catalyst.role === "anchor" ? "main" : "catalyst"}
          </MiniChip>
          <MiniChip>{`IV ${row.catalyst.ivScore.toFixed(1)}`}</MiniChip>
          {row.catalyst.symbols.slice(0, 2).map((symbol) => (
            <MiniChip key={symbol}>{symbol}</MiniChip>
          ))}
        </div>
      </button>
    </article>
  );
}

function MiniChip({ children }: { children: string | number }) {
  return (
    <span className="rounded bg-[var(--fintheon-accent)]/6 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fintheon-muted)]">
      {children}
    </span>
  );
}

function buildRows(
  response: SensemakingResponse | null,
  conflictLabels: Record<string, string>,
): TimelineRow[] {
  if (!response) return [];
  const nodeByCatalyst = new Map(
    response.timelineNodes.map((node) => [node.catalystId, node.id]),
  );
  return [...response.anchorCatalysts, ...response.relatedCatalysts]
    .sort(
      (left, right) =>
        new Date(left.publishedAt).getTime() -
        new Date(right.publishedAt).getTime(),
    )
    .map((catalyst) => ({
      catalyst,
      nodeId: nodeByCatalyst.get(catalyst.id) ?? null,
      conflict: conflictLabels[catalyst.id] ?? "NEEDS CLASSIFICATION",
    }));
}

function groupRowsByDate(rows: TimelineRow[]): [string, TimelineRow[]][] {
  const groups = new Map<string, TimelineRow[]>();
  for (const row of rows) {
    const label = formatDate(row.catalyst.publishedAt);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return [...groups.entries()];
}

function conflictClass(conflict: string): string {
  const normalized = conflict.toLowerCase();
  if (normalized.includes("conflict")) return "text-red-300";
  if (normalized.includes("confirmed")) return "text-emerald-300";
  return "text-[var(--fintheon-accent)]/75";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

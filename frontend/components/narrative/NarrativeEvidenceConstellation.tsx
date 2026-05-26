import { useMemo, useState } from "react";
import { GitBranch, Send } from "lucide-react";
import type {
  NarrativeEvidence,
  NarrativeHypothesis,
} from "../../../backend-hono/src/services/narrative-orchestra/types";

interface NarrativeEvidenceConstellationProps {
  hypothesis: NarrativeHypothesis | null;
}

export function NarrativeEvidenceConstellation({
  hypothesis,
}: NarrativeEvidenceConstellationProps) {
  const [editText, setEditText] = useState("");
  const [editDirective, setEditDirective] = useState<string | null>(null);
  const chartNodes = useMemo(() => buildChartNodes(hypothesis), [hypothesis]);

  function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    const next = editText.trim();
    if (!next) return;
    setEditDirective(next);
    setEditText("");
  }

  return (
    <section
      className="t-panel-slide flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] p-3"
      data-open="true"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
            Evidence
          </p>
          <h3 className="text-base font-semibold text-[var(--fintheon-text)]">
            {hypothesis?.title ?? "No story selected"}
          </h3>
        </div>
        <div className="rounded border border-[var(--fintheon-accent)]/15 px-2 py-1 text-xs tabular-nums text-[var(--fintheon-accent)]">
          {Math.round((hypothesis?.corroborationScore ?? 0) * 100)} cor
        </div>
      </div>

      {!hypothesis ? (
        <EmptyEvidence text="[SELECT STORY]" />
      ) : hypothesis.evidence.length === 0 ? (
        <EmptyEvidence text="[NO LINKED EVIDENCE]" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 560"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <ChartLines
                nodes={chartNodes}
                hasDirective={Boolean(editDirective)}
              />
            </svg>
            <div className="relative grid h-full grid-cols-[1fr_1.2fr_1fr] gap-3 p-4">
              <ChartColumn
                nodes={chartNodes.filter((node) => node.column === "left")}
              />
              <div className="flex flex-col items-center justify-center gap-4">
                <ChartNode
                  node={chartNodes.find((node) => node.kind === "root")!}
                />
                {editDirective ? (
                  <div className="w-full max-w-[360px] rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                      Operator Edit
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--fintheon-text)]/80">
                      {editDirective}
                    </p>
                  </div>
                ) : null}
              </div>
              <ChartColumn
                nodes={chartNodes.filter((node) => node.column === "right")}
              />
            </div>
          </div>

          <form
            onSubmit={submitEdit}
            className="flex shrink-0 items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] px-3 py-2"
          >
            <GitBranch size={14} className="text-[var(--fintheon-accent)]/70" />
            <input
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              placeholder="Edit rendered chart..."
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/60"
            />
            <button
              type="submit"
              className="inline-flex h-7 items-center gap-1 rounded border border-[var(--fintheon-accent)]/15 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)]"
            >
              <Send size={12} />
              Apply
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function ChartColumn({ nodes }: { nodes: ChartNodeData[] }) {
  return (
    <div className="flex min-h-0 flex-col justify-center gap-3 overflow-hidden">
      {nodes.map((node) => (
        <ChartNode key={node.id} node={node} />
      ))}
    </div>
  );
}

function ChartNode({ node }: { node: ChartNodeData }) {
  return (
    <article
      className={`rounded-md border px-3 py-2 ${
        node.kind === "root"
          ? "w-full max-w-[360px] border-[var(--fintheon-accent)]/45 bg-[var(--fintheon-accent)]/10"
          : "border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
        {node.label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[var(--fintheon-text)]">
        {node.title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
        <span>{node.meta}</span>
        {node.extra ? <span>{node.extra}</span> : null}
      </div>
    </article>
  );
}

function EmptyEvidence({ text }: { text: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-md border border-[var(--fintheon-accent)]/10 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      {text}
    </div>
  );
}

function groupEvidence(evidence: NarrativeEvidence[]) {
  return {
    supports: evidence.filter((item) => item.stance === "supports"),
    contradicts: evidence.filter((item) => item.stance === "contradicts"),
    neutral: evidence.filter((item) => item.stance === "neutral"),
  };
}

function buildChartNodes(
  hypothesis: NarrativeHypothesis | null,
): ChartNodeData[] {
  if (!hypothesis) return [];
  const groups = groupEvidence(hypothesis.evidence);
  const supports = groups.supports
    .slice(0, 3)
    .map((item) => toNode(item, "left", "Supports"));
  const neutral = groups.neutral
    .slice(0, 3)
    .map((item) => toNode(item, "right", "Neutral"));
  const contradicts = groups.contradicts
    .slice(0, 2)
    .map((item) => toNode(item, "right", "Contradicts"));

  return [
    {
      id: hypothesis.id,
      kind: "root",
      column: "center",
      label: "Hypothesis",
      title: hypothesis.title,
      meta: `${Math.round(hypothesis.confidence * 100)} conf`,
      extra: `${hypothesis.evidence.length} evidence`,
    },
    ...supports,
    ...neutral,
    ...contradicts,
  ];
}

function toNode(
  item: NarrativeEvidence,
  column: "left" | "right",
  label: string,
): ChartNodeData {
  return {
    id: item.id,
    kind: "evidence",
    column,
    label,
    title: item.title,
    meta: item.sourceType,
    extra: `${Math.round(item.confidence * 100)}%`,
  };
}

function ChartLines({
  nodes,
  hasDirective,
}: {
  nodes: ChartNodeData[];
  hasDirective: boolean;
}) {
  const leftCount = nodes.filter((node) => node.column === "left").length;
  const rightCount = nodes.filter((node) => node.column === "right").length;
  const leftLines = Array.from(
    { length: leftCount },
    (_, index) => 110 + index * 95,
  );
  const rightLines = Array.from(
    { length: rightCount },
    (_, index) => 110 + index * 95,
  );

  return (
    <g fill="none" stroke="rgba(199,159,74,0.24)" strokeWidth="1">
      {leftLines.map((y) => (
        <path key={`left-${y}`} d={`M 250 ${y} H 420 V 280 H 500`} />
      ))}
      {rightLines.map((y) => (
        <path key={`right-${y}`} d={`M 750 ${y} H 580 V 280 H 500`} />
      ))}
      {hasDirective ? <path d="M 500 280 V 420" strokeDasharray="8 8" /> : null}
    </g>
  );
}

interface ChartNodeData {
  id: string;
  kind: "root" | "evidence";
  column: "left" | "center" | "right";
  label: string;
  title: string;
  meta: string;
  extra?: string;
}

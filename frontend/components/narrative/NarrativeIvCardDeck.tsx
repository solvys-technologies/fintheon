import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { ArbitrumGlyph } from "../icons/ArbitrumGlyph";
import {
  RISK_CATEGORY_LABELS,
  ivHeatColor,
  type AgentDeskRiskCategory,
} from "../../types/agent-desk";
import {
  allSensemakingCatalysts,
  findNodeIdForCatalyst,
} from "./sensemaking-catalyst-adapter";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
} from "./sensemaking-types";
import { useIVScoreData } from "./useIVScoreData";

interface NarrativeIvCardDeckProps {
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface NarrativeIvCard {
  id: string;
  label: string;
  score: number;
  confidence: number;
  count: number;
  description: string;
  nodeId: string | null;
}

export function NarrativeIvCardDeck({
  response,
  selectedNodeId,
  onSelectNode,
}: NarrativeIvCardDeckProps) {
  const { data } = useIVScoreData();
  const cards = buildCards(response);
  const compositeNodeId =
    response?.timelineNodes[0]?.id ?? cards.find((card) => card.nodeId)?.nodeId ?? null;
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 12, y: 58 });
  const [ratingQueued, setRatingQueued] = useState(false);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragged: boolean;
  } | null>(null);

  if (cards.length === 0 && !data) return null;

  const chamber = buildChamberSummary(response, data, cards);
  const style = {
    "--narrative-chamber-x": `${position.x}px`,
    "--narrative-chamber-y": `${position.y}px`,
  } as CSSProperties;

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-chamber-action]")) return;
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.dragged = drag.dragged || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    setPosition({
      x: Math.max(8, drag.originX + dx),
      y: Math.max(44, drag.originY + dy),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.dragged) setExpanded((value) => !value);
  }

  return (
    <section
      className="narrative-chamber-widget absolute z-30 select-none"
      data-expanded={expanded ? "true" : "false"}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <button
        type="button"
        className="narrative-chamber-trigger narrative-fade-item flex items-center gap-2 text-left"
        aria-expanded={expanded}
        data-chamber-action
        onClick={() => setExpanded((value) => !value)}
      >
        <ArbitrumGlyph size={15} className="text-[var(--fintheon-accent)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fintheon-text)]">
          Chamber
        </span>
        <ChevronDown size={12} className={`text-[var(--fintheon-muted)] transition ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="narrative-chamber-panel overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ArbitrumGlyph size={18} className="text-[var(--fintheon-accent)]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
                Chamber
              </p>
            </div>
            <h3 className="max-w-[360px] text-lg leading-6 text-[var(--fintheon-text)]">
              Narrative rating and IV fuse
            </h3>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
            {ratingQueued ? "Queued for CAO" : "Ready"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-5">
          <ChamberMetric label="Chamber Fuse" value={chamber.chamberFuse} suffix="/10" />
          <ChamberMetric label="30D Catalysts" value={chamber.recentCatalystCount} />
          <ChamberMetric label="Composite IV" value={chamber.compositeIv} suffix="/10" />
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1.2fr] gap-5">
          <div className="space-y-2">
            {chamber.items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-chamber-action
                onClick={() => item.nodeId && onSelectNode(item.nodeId)}
                className="group flex w-full items-center justify-between gap-3 text-left"
                aria-pressed={item.nodeId === selectedNodeId}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[var(--fintheon-text)]/88">
                    {item.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                    {item.description}
                  </span>
                </span>
                <span className="font-mono text-sm text-[var(--fintheon-accent)]">{item.score.toFixed(1)}</span>
              </button>
            ))}
          </div>

          <div className="relative pl-5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 top-0 w-px"
              style={{
                background: "linear-gradient(to bottom, transparent, rgba(199,159,74,0.22), transparent)",
              }}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/80">
              Notes to CAO
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
              {chamber.note}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                data-chamber-action
                onClick={() => setRatingQueued(true)}
                className="inline-flex h-8 items-center justify-center gap-1.5 text-xs text-[var(--fintheon-accent)] transition hover:text-[var(--fintheon-text)]"
              >
                <RefreshCw size={13} />
                Rate
              </button>
              <button
                type="button"
                data-chamber-action
                onClick={() => {
                  setRatingQueued(true);
                  compositeNodeId && onSelectNode(compositeNodeId);
                }}
                className="inline-flex h-8 items-center justify-center gap-1.5 text-xs text-[var(--fintheon-accent)] transition hover:text-[var(--fintheon-text)]"
              >
                <Check size={13} />
                Send to Docs
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChamberMetric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <p className="font-mono text-2xl tabular-nums text-[var(--fintheon-text)]">
        {Number.isInteger(value) ? value : value.toFixed(1)}
        <span className="ml-1 text-xs text-[var(--fintheon-muted)]">{suffix}</span>
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
        {label}
      </p>
    </div>
  );
}

function buildChamberSummary(
  response: SensemakingResponse | null,
  data: ReturnType<typeof useIVScoreData>["data"],
  cards: NarrativeIvCard[],
) {
  const catalysts = allSensemakingCatalysts(response);
  const recentCatalysts = catalysts.filter((catalyst) => {
    if (!catalyst.publishedAt) return true;
    const published = new Date(catalyst.publishedAt).getTime();
    if (Number.isNaN(published)) return true;
    return Date.now() - published <= 30 * 24 * 60 * 60 * 1000;
  });
  const ivSource = recentCatalysts.length > 0 ? recentCatalysts : catalysts;
  const compositeIv =
    ivSource.length > 0
      ? ivSource.reduce((total, catalyst) => total + catalyst.ivScore, 0) / ivSource.length
      : data?.score ?? 0;
  const chamberFuse = data?.score ?? compositeIv;
  const chamberItems = [
    {
      id: "chamber-fuse",
      label: "Chamber fuse",
      score: chamberFuse,
      description: data?.prediction?.scenarios?.[0]?.label ?? "Narrative rating from Chamber",
      nodeId: response?.timelineNodes[0]?.id ?? null,
    },
    ...cards.slice(0, 2).map((card) => ({
      id: card.id,
      label: card.label,
      score: card.score,
      description: card.description,
      nodeId: card.nodeId,
    })),
  ];

  return {
    chamberFuse,
    compositeIv,
    recentCatalystCount: recentCatalysts.length,
    items: chamberItems,
    note:
      data?.rationale?.[0] ??
      response?.synthesisSummary ??
      "Chamber will rate the narrative, summarize the pressure points, and relay notes back to CAO for the Docs tab.",
  };
}

function buildCards(response: SensemakingResponse | null): NarrativeIvCard[] {
  const catalysts = allSensemakingCatalysts(response);
  if (!response || catalysts.length === 0) return [];

  const grouped = new Map<string, SensemakingCatalyst[]>();
  for (const catalyst of catalysts) {
    const key = normalizeCategory(catalyst.category);
    grouped.set(key, [...(grouped.get(key) ?? []), catalyst]);
  }

  return [...grouped.entries()]
    .filter(([category]) => category !== "inflation")
    .map(([category, items]) => {
      const lead = [...items].sort((a, b) => b.ivScore - a.ivScore)[0];
      const score =
        items.reduce((total, item) => total + item.ivScore, 0) / items.length;
      const confidence =
        items.reduce((total, item) => total + item.relationScore, 0) /
        items.length;
      return {
        id: category,
        label: category === "macroeconomic" ? "Upcoming Related Events" : getCategoryLabel(category),
        score,
        confidence,
        count: items.length,
        description: lead?.headline ?? "Narrative IV cluster",
        nodeId: lead ? findNodeIdForCatalyst(response, lead.id) : null,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replaceAll("_", "-");
}

function getCategoryLabel(category: string) {
  return (
    RISK_CATEGORY_LABELS[category as AgentDeskRiskCategory] ??
    category.replaceAll("-", " ")
  );
}

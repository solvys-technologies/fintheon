import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { GitBranch, LayoutDashboard, PanelLeftOpen } from "lucide-react";
import type { ZoomLevel } from "../../lib/narrative-types";
import type { Theme } from "../../hooks/useThemes";
import { NarrativeCatalystDrawer } from "./NarrativeCatalystDrawer";
import { NarrativeMermaidView } from "./NarrativeMermaidView";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import { NarrativeSensemakingDetail } from "./NarrativeSensemakingDetail";
import { NarrativeSensemakingMap } from "./NarrativeSensemakingMap";
import type {
  NarrativeHeadlineOption,
  SensemakingOrientation,
  SensemakingRenderMode,
  SensemakingResponse,
} from "./sensemaking-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface NarrativeCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  themes: Theme[];
  isLoading?: boolean;
}

export function NarrativeCanvas({ themes, isLoading = false }: NarrativeCanvasProps) {
  const [headlines, setHeadlines] = useState<NarrativeHeadlineOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orientation, setOrientation] = useState<SensemakingOrientation>("horizontal");
  const [renderMode, setRenderMode] = useState<SensemakingRenderMode>("flow");
  const [response, setResponse] = useState<SensemakingResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/riskflow/feed?limit=120&minMacroLevel=1`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        setHeadlines(mapRiskFlowItems(data.items ?? []));
      })
      .catch(() => {
        if (!cancelled) setHeadlines([]);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedNodeId(response?.timelineNodes[0]?.id ?? null);
  }, [response]);

  const attachedHeadlines = useMemo(
    () => headlines.filter((item) => selectedIds.has(item.id)),
    [headlines, selectedIds],
  );

  const toggleHeadline = useCallback((headline: NarrativeHeadlineOption) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(headline.id)) next.delete(headline.id);
      else next.add(headline.id);
      return next;
    });
    setValidationMessage(null);
  }, []);

  const removeHeadline = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const submitSensemaking = useCallback(async () => {
    if (selectedIds.size === 0) {
      setValidationMessage("Attach at least one RiskFlow headline before building a narrative.");
      setDrawerOpen(true);
      return;
    }

    setIsSubmitting(true);
    setValidationMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/narrative/sensemaking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          attachedHeadlineIds: Array.from(selectedIds),
          orientation,
          renderMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Sensemaking ${res.status}`);
      setResponse(data as SensemakingResponse);
    } catch (err) {
      setValidationMessage(
        err instanceof Error ? err.message : "Narrative sensemaking failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [orientation, query, renderMode, selectedIds]);

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[var(--fintheon-bg)]">
      <NarrativeCatalystDrawer
        open={drawerOpen}
        headlines={headlines}
        relatedCatalysts={response?.relatedCatalysts ?? []}
        selectedIds={selectedIds}
        isLoading={feedLoading || isLoading}
        onClose={() => setDrawerOpen(false)}
        onToggle={toggleHeadline}
      />

      <div className="flex h-full min-h-0">
        <main className="relative min-w-0 flex-1">
          <TopBar
            themes={themes.length}
            orientation={orientation}
            renderMode={renderMode}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOrientationChange={setOrientation}
            onRenderModeChange={setRenderMode}
          />
          <div className="absolute inset-x-0 bottom-[132px] top-[50px]">
            {renderMode === "mermaid" && response ? (
              <NarrativeMermaidView source={response.mermaidSource} />
            ) : (
              <NarrativeSensemakingMap
                response={response}
                orientation={orientation}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            )}
          </div>

          <NarrativeSensemakingComposer
            query={query}
            attachedHeadlines={attachedHeadlines}
            isSubmitting={isSubmitting}
            validationMessage={validationMessage}
            onQueryChange={setQuery}
            onOpenDrawer={() => setDrawerOpen(true)}
            onRemoveHeadline={removeHeadline}
            onSubmit={submitSensemaking}
          />
        </main>

        <NarrativeSensemakingDetail
          response={response}
          selectedNodeId={selectedNodeId}
        />
      </div>
    </div>
  );
}

function TopBar({
  themes,
  orientation,
  renderMode,
  onOpenDrawer,
  onOrientationChange,
  onRenderModeChange,
}: {
  themes: number;
  orientation: SensemakingOrientation;
  renderMode: SensemakingRenderMode;
  onOpenDrawer: () => void;
  onOrientationChange: (value: SensemakingOrientation) => void;
  onRenderModeChange: (value: SensemakingRenderMode) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[50px] items-center justify-between border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]/90 px-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={onOpenDrawer}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/15 px-3 text-xs text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/35 hover:text-[var(--fintheon-accent)]"
      >
        <PanelLeftOpen size={14} />
        Catalysts
      </button>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
        <GitBranch size={13} />
        <span>{themes} themes indexed</span>
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          value={orientation}
          options={[
            ["horizontal", "Left to Right"],
            ["vertical", "Top Down"],
          ]}
          onChange={(value) => onOrientationChange(value as SensemakingOrientation)}
        />
        <Segmented
          value={renderMode}
          options={[
            ["flow", "Map"],
            ["mermaid", "Mermaid"],
          ]}
          onChange={(value) => onRenderModeChange(value as SensemakingRenderMode)}
          icon={<LayoutDashboard size={12} />}
        />
      </div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  icon,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/55 p-1">
      {icon}
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
            value === id
              ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
              : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function mapRiskFlowItems(items: Array<Record<string, unknown>>): NarrativeHeadlineOption[] {
  return items.map((item) => ({
    id: String(item.id ?? item.tweet_id ?? ""),
    headline: String(item.headline ?? item.title ?? "Untitled headline"),
    summary: String(item.body ?? item.summary ?? item.content ?? ""),
    source: String(item.source ?? "RiskFlow"),
    severity: String(item.severity ?? item.impact ?? "medium"),
    publishedAt: String(item.publishedAt ?? item.published_at ?? new Date().toISOString()),
    symbols: Array.isArray(item.symbols) ? item.symbols.map(String) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    narrativeThreads: Array.isArray(item.narrativeThreads)
      ? item.narrativeThreads.map(String)
      : [],
  }));
}

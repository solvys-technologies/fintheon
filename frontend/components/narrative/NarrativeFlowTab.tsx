import { SlidersHorizontal } from "lucide-react";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "./sensemaking-types";

interface NarrativeFlowTabProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
}

const quickActions = ["Compare", "Challenge", "Promote", "Link"];

export function NarrativeFlowTab({
  session,
  response,
  selectedNodeId,
  onOrganize,
  onShowAll,
  onQuickAction,
}: NarrativeFlowTabProps) {
  const selectedNode = getSelectedNode(response, selectedNodeId);
  const selectedCatalyst = getCatalyst(response, selectedNode?.catalystId ?? null);
  const anchorCount = response?.anchorCatalysts.length ?? 0;
  const relatedCount = response?.relatedCatalysts.length ?? 0;
  const generatedAt = response?.generatedAt ?? session?.generatedAt ?? null;
  const workEvents = session?.workEvents ?? [];

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
              Active Narrative
            </p>
            <h3 className="mt-1 truncate text-sm font-medium text-[var(--fintheon-text)]">
              {session?.title ?? selectedCatalyst?.narrativeThreads[0] ?? "Unloaded session"}
            </h3>
          </div>
          <span
            className="h-6 w-6 shrink-0 rounded-full border border-[var(--fintheon-accent)]/35"
            style={{ backgroundColor: session?.color ?? "rgba(199,159,74,0.24)" }}
            aria-label="Narrative color"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Anchors" value={anchorCount} />
          <Metric label="Related" value={relatedCount} />
          <Metric label="Nodes" value={response?.timelineNodes.length ?? 0} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onOrganize}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--fintheon-accent)]/15 px-2 text-[11px] text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/35 hover:text-[var(--fintheon-accent)]"
          >
            <SlidersHorizontal size={13} />
            Organize
          </button>
          <button
            type="button"
            onClick={onShowAll}
            className="inline-flex h-7 items-center rounded-md border border-[var(--fintheon-accent)]/15 px-2 text-[11px] text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/35 hover:text-[var(--fintheon-accent)]"
          >
            All
          </button>
        </div>
      </section>

      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
          Selected Catalyst
        </p>
        {selectedCatalyst ? (
          <div className="mt-2">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Chip>{selectedCatalyst.role === "anchor" ? "MAIN" : "CATALYST"}</Chip>
              <Chip>{selectedCatalyst.category}</Chip>
              <Chip>{selectedCatalyst.sentiment}</Chip>
            </div>
            <h4 className="text-sm font-medium leading-5 text-[var(--fintheon-text)]">
              {selectedCatalyst.headline}
            </h4>
            <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
              {selectedCatalyst.agentNote ?? selectedCatalyst.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onQuickAction?.(action, selectedCatalyst.id)}
                  className="rounded border border-[var(--fintheon-accent)]/16 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/45 hover:text-[var(--fintheon-accent)]"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
            Select a node to stage follow-up actions.
          </p>
        )}
      </section>

      <section className="rounded-md border border-[var(--fintheon-accent)]/12 p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
          <span>Agent Work</span>
          <span>{generatedAt ? formatDateTime(generatedAt) : "Pending"}</span>
        </div>
        <div className="space-y-2">
          {workEvents.length > 0 ? (
            workEvents.map((event) => (
              <article key={event.id} className="rounded-md border border-[var(--fintheon-accent)]/10 p-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--fintheon-muted)]">
                  <span className="uppercase tracking-[0.12em]">{event.agent}</span>
                  <span>{event.status ?? "In Progress"}</span>
                </div>
                <p className="text-xs leading-5 text-[var(--fintheon-text)]/85">
                  {event.summary}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-md border border-[var(--fintheon-accent)]/10 p-3 text-xs leading-5 text-[var(--fintheon-muted)]">
              Agent work events will appear here once the desk data track connects them.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--fintheon-accent)]/10 px-2 py-2">
      <p className="font-mono text-sm tabular-nums text-[var(--fintheon-text)]">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
        {label}
      </p>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded border border-[var(--fintheon-accent)]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/75">
      {children}
    </span>
  );
}

function getSelectedNode(
  response: SensemakingResponse | null,
  selectedNodeId: string | null,
): SensemakingTimelineNode | null {
  if (!response) return null;
  return response.timelineNodes.find((item) => item.id === selectedNodeId) ?? response.timelineNodes[0] ?? null;
}

function getCatalyst(
  response: SensemakingResponse | null,
  catalystId: string | null,
): SensemakingCatalyst | null {
  if (!response || !catalystId) return null;
  return [...response.anchorCatalysts, ...response.relatedCatalysts].find((item) => item.id === catalystId) ?? null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

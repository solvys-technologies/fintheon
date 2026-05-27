import { useState } from "react";
import { BetaState, DeskForecastsView } from "./DeskForecastsView";
import { NarrativeFlowTab } from "./NarrativeFlowTab";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { SensemakingResponse } from "./sensemaking-types";

type FlowView = "catalysts" | "forecasts" | "coliseum" | "resolved";

interface NarrativeFlowViewToggleProps {
  compact?: boolean;
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  themeCount?: number;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onSelectNode?: (id: string) => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
}

const VIEWS: { id: FlowView; label: string; shortLabel: string }[] = [
  { id: "catalysts", label: "Catalysts", shortLabel: "Catalysts" },
  { id: "forecasts", label: "Desk Forecasts", shortLabel: "Forecasts" },
  { id: "coliseum", label: "Coliseum", shortLabel: "Coliseum" },
  { id: "resolved", label: "Resolved", shortLabel: "Resolved" },
];

export function NarrativeFlowViewToggle({
  compact = false,
  session,
  response,
  selectedNodeId,
  themeCount,
  onOrganize,
  onShowAll,
  onSelectNode,
  onQuickAction,
}: NarrativeFlowViewToggleProps) {
  const [view, setView] = useState<FlowView>("catalysts");

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex h-9 shrink-0 items-center overflow-x-auto px-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(199,159,74,0.13) 18%, rgba(199,159,74,0.13) 82%, transparent 100%)",
          }}
        />
        {VIEWS.map((v) => {
          const isActive = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={isActive}
              className={`relative h-full shrink-0 px-2 text-[10px] uppercase tracking-[0.11em] transition ${
                isActive
                  ? "text-[var(--fintheon-accent)]"
                  : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              {compact ? v.shortLabel : v.label}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-0 h-px bg-[var(--fintheon-accent)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "catalysts" ? (
          <div className="p-3">
            <NarrativeFlowTab
              session={session}
              response={response}
              selectedNodeId={selectedNodeId}
              themeCount={themeCount}
              onOrganize={onOrganize}
              onShowAll={onShowAll}
              onSelectNode={onSelectNode}
              onQuickAction={onQuickAction}
            />
          </div>
        ) : null}
        {view === "forecasts" ? <DeskForecastsView /> : null}
        {view === "coliseum" ? (
          <BetaState label="Coliseum — private beta. Social feed and leaderboard available after graduation." />
        ) : null}
        {view === "resolved" ? (
          <BetaState label="Resolved — private beta. Closed forecast archive unlocks after monitor history accrues." />
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { NarrativeDocsTab } from "./NarrativeDocsTab";
import { NarrativeFlowTab } from "./NarrativeFlowTab";
import { NarrativeTimelineTab } from "./NarrativeTimelineTab";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { SensemakingResponse } from "./sensemaking-types";

type WorkDrawerTab = "flow" | "timeline" | "docs";

interface NarrativeWorkDrawerProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  onSelectNode?: (id: string) => void;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
}

const tabs: { id: WorkDrawerTab; label: string }[] = [
  { id: "flow", label: "Flow" },
  { id: "timeline", label: "Timeline" },
  { id: "docs", label: "Docs" },
];

const drawerWidthKey = "narrativeflow:work-drawer-width";
const minWidth = 320;
const maxWidth = 620;

export function NarrativeWorkDrawer({
  session,
  response,
  selectedNodeId,
  onSelectNode,
  onOrganize,
  onShowAll,
  onQuickAction,
}: NarrativeWorkDrawerProps) {
  const [activeTab, setActiveTab] = useState<WorkDrawerTab>("flow");
  const [width, setWidth] = useState(380);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(drawerWidthKey);
    if (!storedValue) return;
    const stored = Number(storedValue);
    if (Number.isFinite(stored)) setWidth(clampWidth(stored));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(drawerWidthKey, String(width));
  }, [width]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragState.current = { startX: event.clientX, startWidth: width };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  function resize(event: PointerEvent) {
    const current = dragState.current;
    if (!current) return;
    setWidth(clampWidth(current.startWidth + current.startX - event.clientX));
  }

  function stopResize() {
    dragState.current = null;
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", resize);
  }

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/95"
      style={{ width }}
    >
      <div
        className="absolute inset-y-0 left-0 w-px cursor-col-resize bg-[var(--fintheon-accent)]/10 transition hover:bg-[var(--fintheon-accent)]/45"
        style={{ touchAction: "none" }}
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize narrative work drawer"
      />

      <div className="flex h-11 shrink-0 items-center border-b border-[var(--fintheon-accent)]/10 px-3">
        <div className="grid h-8 w-full grid-cols-3 rounded-md border border-[var(--fintheon-accent)]/12 p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[4px] text-xs transition ${
                activeTab === tab.id
                  ? "bg-[var(--fintheon-accent)]/12 text-[var(--fintheon-accent)]"
                  : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "flow" ? (
          <NarrativeFlowTab
            session={session}
            response={response}
            selectedNodeId={selectedNodeId}
            onOrganize={onOrganize}
            onShowAll={onShowAll}
            onQuickAction={onQuickAction}
          />
        ) : null}
        {activeTab === "timeline" ? (
          <NarrativeTimelineTab
            response={response}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ) : null}
        {activeTab === "docs" ? (
          <NarrativeDocsTab session={session} response={response} />
        ) : null}
      </div>
    </aside>
  );
}

function clampWidth(value: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
}

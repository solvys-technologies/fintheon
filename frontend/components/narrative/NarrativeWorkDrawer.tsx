import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GitBranch } from "lucide-react";
import { NarrativeDocsTab } from "./NarrativeDocsTab";
import { NarrativeFlowTab } from "./NarrativeFlowTab";
import { NarrativeTimelineTab } from "./NarrativeTimelineTab";
import type { NarrativeTranscriptEntry, NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { SensemakingResponse } from "./sensemaking-types";

type WorkDrawerTab = "flow" | "timeline" | "docs" | "transcript";

interface NarrativeWorkDrawerProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  themeCount?: number;
  onSelectNode?: (id: string) => void;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
}

const tabs: { id: WorkDrawerTab; label: string }[] = [
  { id: "flow", label: "Flow" },
  { id: "timeline", label: "Timeline" },
  { id: "docs", label: "Docs" },
  { id: "transcript", label: "Narratives" },
];

const drawerWidthKey = "narrativeflow:work-drawer-width";
const minWidth = 320;
const maxWidth = 620;

export function NarrativeWorkDrawer({
  session,
  response,
  selectedNodeId,
  themeCount = 0,
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
      className="relative flex h-full min-h-0 shrink-0 flex-col bg-[var(--fintheon-bg)]/95"
      style={{ width }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-px"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(199,159,74,0.04) 8%, rgba(199,159,74,0.16) 50%, rgba(199,159,74,0.04) 92%, transparent 100%)",
        }}
      />
      <div
        className="group absolute inset-y-0 left-0 w-3 -translate-x-1/2 cursor-col-resize transition"
        style={{ touchAction: "none" }}
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize narrative work drawer"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-12 left-1/2 w-px -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(199,159,74,0.35) 18%, rgba(199,159,74,0.48) 50%, rgba(199,159,74,0.35) 82%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative flex h-11 shrink-0 items-center px-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(199,159,74,0.13) 18%, rgba(199,159,74,0.13) 82%, transparent 100%)",
          }}
        />
        <div className="grid h-8 w-full grid-cols-4 rounded-md p-0.5">
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
            themeCount={themeCount}
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
        {activeTab === "transcript" ? (
          <NarrativesTab entries={session?.transcript ?? []} />
        ) : null}
      </div>
    </aside>
  );
}

function NarrativesTab({ entries }: { entries: NarrativeTranscriptEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-[var(--fintheon-accent)]/12 p-4 text-xs leading-5 text-[var(--fintheon-muted)]">
        Narrative prompts and desk turns will appear here after the desk starts working.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
        <GitBranch size={13} />
        Narratives
      </div>
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="rounded-md border border-[var(--fintheon-accent)]/10 p-2"
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--fintheon-muted)]">
            <span className="uppercase tracking-[0.12em]">{entry.speaker}</span>
            <span>{entry.timestamp ? formatShortTime(entry.timestamp) : ""}</span>
          </div>
          <p className="text-[11px] leading-4 text-[var(--fintheon-text)]/85">
            {entry.text}
          </p>
        </article>
      ))}
    </div>
  );
}

function clampWidth(value: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
}

function formatShortTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

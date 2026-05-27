import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Clock, FileText, GitBranch, Tv, type LucideIcon } from "lucide-react";
import { NarrativeDocsTab } from "./NarrativeDocsTab";
import { NarrativeFlowViewToggle } from "./NarrativeFlowViewToggle";
import { NarrativeTimelineTab } from "./NarrativeTimelineTab";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { SensemakingResponse } from "./sensemaking-types";

export type WorkDrawerTab = "canvas" | "flow" | "timeline" | "docs";

interface NarrativeWorkDrawerProps {
  isOpen?: boolean;
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  themeCount?: number;
  onSelectNode?: (id: string) => void;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
  preferredTab?: WorkDrawerTab;
  canvasSlot?: ReactNode;
}

const tabs: { id: WorkDrawerTab; label: string; icon: LucideIcon }[] = [
  { id: "flow", label: "Flow", icon: GitBranch },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "docs", label: "Docs", icon: FileText },
];

const drawerWidthKey = "narrativeflow:work-drawer-width";
const minWidth = 320;
const maxWidthRatio = 0.65;

export function NarrativeWorkDrawer({
  isOpen = true,
  session,
  response,
  selectedNodeId,
  themeCount = 0,
  onSelectNode,
  onOrganize,
  onShowAll,
  onQuickAction,
  preferredTab,
  canvasSlot,
}: NarrativeWorkDrawerProps) {
  const [activeTab, setActiveTab] = useState<WorkDrawerTab>("flow");
  const [width, setWidth] = useState(380);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const visibleTabs = canvasSlot
    ? [{ id: "canvas" as const, label: "Canvas", icon: Tv }, ...tabs]
    : tabs;
  const compactTabs = width <= 430;

  useEffect(() => {
    if (!preferredTab) return;
    setActiveTab(preferredTab);
  }, [preferredTab]);

  useEffect(() => {
    if (!canvasSlot && activeTab === "canvas") setActiveTab("flow");
  }, [activeTab, canvasSlot]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(drawerWidthKey);
    if (!storedValue) return;
    const stored = Number(storedValue);
    if (Number.isFinite(stored)) setWidth(clampWidth(stored));
  }, []);

  useEffect(() => {
    function keepWidthInViewport() {
      setWidth((current) => clampWidth(current));
    }
    window.addEventListener("resize", keepWidthInViewport);
    return () => window.removeEventListener("resize", keepWidthInViewport);
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
  const drawerWidth = `min(${width}px, ${maxWidthRatio * 100}vw, calc(100vw - 64px))`;

  return (
    <aside
      className={`narrative-work-drawer t-panel-slide relative flex h-full min-h-0 shrink-0 flex-col bg-[var(--fintheon-bg)]/95 ${
        isOpen ? "" : "pointer-events-none"
      }`}
      data-open={isOpen ? "true" : "false"}
      style={{
        width: drawerWidth,
        marginRight: isOpen ? 0 : `calc(-1 * ${drawerWidth})`,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      }}
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
        <div
          className="grid h-8 min-w-0 flex-1 overflow-hidden rounded-[9px] bg-transparent"
          style={{
            gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div key={tab.id} className="relative min-w-0 p-[2px]">
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-1/2 h-4 w-px -translate-y-1/2"
                    style={{
                      background:
                        "linear-gradient(to bottom, transparent, rgba(199,159,74,0.2), transparent)",
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={`narrative-work-tab h-full w-full rounded-[7px] border border-transparent bg-transparent px-1.5 text-xs transition ${
                    isActive
                      ? "text-[var(--fintheon-accent)]"
                      : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
                  }`}
                  data-active={isActive ? "true" : "false"}
                  title={tab.label}
                  aria-label={tab.label}
                >
                  <span className="inline-flex min-w-0 items-center justify-center gap-1">
                    <Icon
                      className="shrink-0"
                      size={compactTabs ? 14 : 13}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={compactTabs ? "sr-only" : "truncate"}>
                      {tab.label}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 ${activeTab === "canvas" || activeTab === "flow" ? "overflow-hidden p-0" : "overflow-y-auto p-3"}`}
      >
        {activeTab === "canvas" ? canvasSlot : null}
        {activeTab === "flow" ? (
          <NarrativeFlowViewToggle
            compact={compactTabs}
            session={session}
            response={response}
            selectedNodeId={selectedNodeId}
            themeCount={themeCount}
            onSelectNode={onSelectNode}
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
  const viewportMax =
    typeof window === "undefined"
      ? minWidth * 2
      : Math.floor(window.innerWidth * maxWidthRatio);
  return Math.min(
    Math.max(minWidth, viewportMax),
    Math.max(minWidth, Math.round(value)),
  );
}

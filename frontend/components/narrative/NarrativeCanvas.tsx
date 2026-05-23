import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BriefcaseBusiness,
  Clock,
  Edit3,
  type LucideIcon,
  Map as MapIcon,
  MessageSquareText,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { useMessageQueue } from "../chat/hooks/useMessageQueue";
import {
  normalizeReasoningLevel,
  type ReasoningLevel,
} from "../chat/reasoning";
import type { ZoomLevel } from "../../lib/narrative-types";
import type { Theme } from "../../hooks/useThemes";
import {
  createNarrativeSession,
  fetchNarrativeSession,
  fetchNarrativeSessions,
  refineNarrativeSession,
  updateNarrativeSession,
  type CreateNarrativeSessionPayload,
} from "../../lib/narrative-session-api";
import { NarrativeFlowLanding } from "./NarrativeFlowLanding";
import { NarrativeMap } from "./NarrativeMap";
import { NarrativeMermaidView } from "./NarrativeMermaidView";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import { NarrativeSessionWorkspace, type NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import { NarrativeSensemakingMap } from "./NarrativeSensemakingMap";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import {
  NarrativeWorkspaceTopBar,
  NarrativeWorkspaceViewMenu,
} from "./NarrativeWorkspaceChrome";
import type {
  SensemakingOrientation,
  SensemakingRenderMode,
  SensemakingResponse,
} from "./sensemaking-types";

interface NarrativeCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  themes: Theme[];
  isLoading?: boolean;
  chartMode?: boolean;
}

type NarrativeSurfaceMode = "workspace" | "map";
const NARRATIVE_SWATCHES = ["#c79f4a", "#34D399", "#FBBF24", "#A78BFA", "#14B8A6", "#F97316"];

export function NarrativeCanvas({
  themes,
  isLoading = false,
  chartMode = false,
}: NarrativeCanvasProps) {
  const [sessions, setSessions] = useState<NarrativeSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<NarrativeWorkspaceSession | null>(null);
  const [orientation, setOrientation] = useState<SensemakingOrientation>("horizontal");
  const [renderMode, setRenderMode] = useState<SensemakingRenderMode>("flow");
  const [surfaceMode, setSurfaceMode] = useState<NarrativeSurfaceMode>("workspace");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [response, setResponse] = useState<SensemakingResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [headerActionsHost, setHeaderActionsHost] = useState<HTMLElement | null>(null);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>(() => {
    try {
      return normalizeReasoningLevel(
        localStorage.getItem("fintheon:narrative-reasoning-level"),
      );
    } catch {
      return "standard";
    }
  });
  useEffect(() => {
    let cancelled = false;
    fetchNarrativeSessions()
      .then((items) => {
        if (cancelled) return;
        setSessions(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setSessions([]);
          setValidationMessage(
            err instanceof Error ? err.message : "Narrative sessions failed to load.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedNodeId(response?.timelineNodes[0]?.id ?? null);
  }, [response]);

  useEffect(() => {
    if (chartMode) setOrientation("vertical");
  }, [chartMode]);

  useEffect(() => {
    const syncHeaderHost = () => {
      setHeaderActionsHost(document.getElementById("narrativeflow-header-actions"));
    };
    syncHeaderHost();
    const frame = requestAnimationFrame(syncHeaderHost);
    return () => cancelAnimationFrame(frame);
  }, [surfaceMode, activeSession?.id]);

  const handleCreateSession = useCallback(async (payload: CreateNarrativeSessionPayload) => {
    if (payload.catalystIds.length < 3) {
      setValidationMessage("[SELECT 3 CATALYSTS]");
      return;
    }

    setIsSubmitting(true);
    setValidationMessage(null);
    try {
      const bundle = await createNarrativeSession(payload);
      setActiveSession(bundle.session);
      setResponse(bundle.response);
      setSessions((current) => [toSummary(bundle.session, payload.catalystIds.length), ...current]);
    } catch (err) {
      setValidationMessage(
        err instanceof Error ? err.message : "Narrative session failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleOpenSession = useCallback(async (id: string) => {
    setIsSubmitting(true);
    setValidationMessage(null);
    try {
      const bundle = await fetchNarrativeSession(id);
      setActiveSession(bundle.session);
      setResponse(bundle.response);
      setSurfaceMode("workspace");
      setIsHistoryOpen(false);
    } catch (err) {
      setValidationMessage(err instanceof Error ? err.message : "Narrative session failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleRenameSession = useCallback(async (id: string, title: string, color: string) => {
    setSessions((current) =>
      current.map((session) => (session.id === id ? { ...session, title, color } : session)),
    );
    if (activeSession?.id === id) {
      setActiveSession((session) => (session ? { ...session, title, color } : session));
    }
    try {
      const bundle = await updateNarrativeSession({ id, title, color });
      setActiveSession(bundle.session);
      setResponse(bundle.response);
    } catch (err) {
      setValidationMessage(err instanceof Error ? err.message : "Narrative rename failed.");
    }
  }, [activeSession?.id]);

  const submitWorkspaceText = useCallback(async (text: string) => {
    const sessionId = activeSession?.id;
    const catalystIds = activeSession?.catalystIds ?? [];
    const requestText = text.trim();
    if (!sessionId || catalystIds.length === 0) {
      setValidationMessage("This narrative does not have persisted catalysts yet.");
      return;
    }
    if (!requestText) {
      setValidationMessage("Enter a request for NarrativeFlow to run.");
      return;
    }

    setIsSubmitting(true);
    setValidationMessage(null);
    const pendingTranscript = {
      id: `pending-${Date.now()}`,
      speaker: "user",
      text: requestText,
      timestamp: new Date().toISOString(),
    };
    setActiveSession((session) =>
      session
        ? {
            ...session,
            transcript: [...(session.transcript ?? []), pendingTranscript],
          }
        : session,
    );
    try {
      const bundle = await refineNarrativeSession({
        sessionId,
        query: requestText,
        catalystIds,
        orientation,
        renderMode,
        reasoningLevel,
      });
      const nextResponse = bundle.response;
      setResponse(nextResponse);
      setActiveSession({
        ...bundle.session,
        workEvents: [
          {
            id: `refine-${Date.now()}`,
            agent: "NarrativeFlow",
            status: "complete",
            summary: "Regenerated flow, timeline, and docs from the latest request.",
            timestamp: nextResponse?.generatedAt ?? new Date().toISOString(),
          },
          ...(bundle.session.workEvents ?? []),
        ],
      });
      setWorkspaceQuery("");
    } catch (err) {
      setValidationMessage(err instanceof Error ? err.message : "Narrative request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeSession?.catalystIds,
    activeSession?.id,
    orientation,
    reasoningLevel,
    renderMode,
  ]);

  const {
    queue: workspaceQueue,
    addQueue: addWorkspaceQueue,
    editQueue: editWorkspaceQueue,
    removeQueue: removeWorkspaceQueue,
    reorderQueue: reorderWorkspaceQueue,
    sendOne: sendWorkspaceOne,
    sendAll: sendWorkspaceAll,
  } = useMessageQueue({
    isRunning: isSubmitting,
    sendNow: submitWorkspaceText,
    storageKey: "fintheon:narrative-message-queue",
  });

  const handleWorkspaceRequest = useCallback(() => {
    submitWorkspaceText(workspaceQuery);
  }, [submitWorkspaceText, workspaceQuery]);

  function handleReasoningLevelChange(level: ReasoningLevel) {
    setReasoningLevel(level);
    try {
      localStorage.setItem("fintheon:narrative-reasoning-level", level);
    } catch {
      /* ignore */
    }
  }

  const sessionCatalystIds = new Set(activeSession?.catalystIds ?? []);
  const responseCatalysts = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts]
    : [];
  const sessionCatalysts = responseCatalysts.filter((item) => sessionCatalystIds.has(item.id));
  const workspaceHeadlines = (sessionCatalysts.length > 0 ? sessionCatalysts : response?.anchorCatalysts ?? [])
    .map((item) => ({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        severity: item.category,
        publishedAt: item.publishedAt,
        ivScore: item.ivScore,
        symbols: item.symbols,
        tags: item.tags,
        narrativeThreads: item.narrativeThreads,
      }));
  const resetWorkspace = () => {
    setActiveSession(null);
    setResponse(null);
    setSurfaceMode("workspace");
    setIsHistoryOpen(false);
  };
  const handleQuickAction = useCallback((action: string, catalystId: string | null) => {
    const target = catalystId ? ` for catalyst ${catalystId}` : "";
    setWorkspaceQuery(`${action} this major development${target}.`);
  }, []);
  const chromeActions = (
    <NarrativeChromeActions
      mode={surfaceMode}
      isHistoryOpen={isHistoryOpen}
      onToggleHistory={() => setIsHistoryOpen((value) => !value)}
      onChangeMode={setSurfaceMode}
    />
  );
  const headerActions = (
    <>
      {chromeActions}
      {activeSession && surfaceMode === "workspace" ? (
        <NarrativeWorkspaceViewMenu
          orientation={orientation}
          renderMode={renderMode}
          onOrientationChange={setOrientation}
          onRenderModeChange={setRenderMode}
        />
      ) : null}
    </>
  );

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[var(--fintheon-bg)]">
      {headerActionsHost ? createPortal(headerActions, headerActionsHost) : null}
      {!headerActionsHost && surfaceMode === "workspace" && !activeSession ? (
        <div className="absolute right-3 top-3 z-50">{chromeActions}</div>
      ) : null}

      <NarrativeSessionDrawer
        isOpen={isHistoryOpen}
        isWorkspaceOpen={surfaceMode === "workspace" && Boolean(activeSession)}
        sessions={sessions}
        activeSession={activeSession}
        activeSessionId={activeSession?.id ?? null}
        onClose={() => setIsHistoryOpen(false)}
        onNewSession={resetWorkspace}
        onOpenSession={handleOpenSession}
        onRenameSession={handleRenameSession}
      />

      {surfaceMode === "map" ? (
        <NarrativeMap
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          onOpenSession={handleOpenSession}
        />
      ) : !activeSession ? (
          <NarrativeFlowLanding
            sessions={sessions}
            isSubmitting={isSubmitting || isLoading}
            statusMessage={validationMessage}
            reasoningLevel={reasoningLevel}
            onReasoningLevelChange={handleReasoningLevelChange}
            onCreateSession={handleCreateSession}
            onOpenSession={handleOpenSession}
            onRenameSession={handleRenameSession}
          />
        ) : (
          <NarrativeSessionWorkspace
            session={activeSession}
            response={response}
            selectedNodeId={selectedNodeId}
            themeCount={themes.length}
            onSelectNode={setSelectedNodeId}
            onRename={(title) =>
              activeSession.id && handleRenameSession(activeSession.id, title, activeSession.color ?? "#c79f4a")
            }
            onQuickAction={handleQuickAction}
          >
            <NarrativeWorkspaceTopBar
              orientation={orientation}
              renderMode={renderMode}
              onOrientationChange={setOrientation}
              onRenderModeChange={setRenderMode}
              showViewControls={!headerActionsHost}
            />
            <div className="absolute inset-x-0 bottom-0 top-[50px]">
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
              query={workspaceQuery}
              attachedHeadlines={workspaceHeadlines}
              isSubmitting={isSubmitting}
              validationMessage={validationMessage}
              submitLabel="Ask"
              attachLabel="Catalysts"
              reasoningLevel={reasoningLevel}
              queue={workspaceQueue}
              contextStats={{
                messageCount: activeSession.transcript?.length ?? 0,
                estimatedTokens: estimateNarrativeTokens(
                  workspaceQuery,
                  activeSession,
                  response,
                ),
                connectorCount: workspaceHeadlines.length,
                activeSkillLabel: "NarrativeFlow",
              }}
              onQueryChange={setWorkspaceQuery}
              onOpenDrawer={() => setValidationMessage("Use Sessions to refine the catalyst set.")}
              onRemoveHeadline={() => setValidationMessage("Catalyst refinement is saved from Sessions.")}
              onSubmit={handleWorkspaceRequest}
              onQueueMessage={addWorkspaceQueue}
              onEditQueue={editWorkspaceQueue}
              onRemoveQueue={removeWorkspaceQueue}
              onReorderQueue={reorderWorkspaceQueue}
              onSendQueueOne={sendWorkspaceOne}
              onSendQueueAll={sendWorkspaceAll}
              onReasoningLevelChange={handleReasoningLevelChange}
            />
          </NarrativeSessionWorkspace>
        )}

    </div>
  );
}

function toSummary(
  session: NarrativeWorkspaceSession,
  catalystCount: number,
): NarrativeSessionSummary {
  return {
    id: session.id ?? "new-session",
    title: session.title ?? "Untitled narrative",
    updatedAt: session.generatedAt ?? new Date().toISOString(),
    catalystCount,
    color: session.color ?? "#c79f4a",
    deskLabel: "Priced In Capital",
  };
}

function estimateNarrativeTokens(
  query: string,
  session: NarrativeWorkspaceSession,
  response: SensemakingResponse | null,
): number {
  const parts = [
    query,
    session.title ?? "",
    session.synthesis ?? "",
    session.report ?? "",
    ...(session.transcript ?? []).map((entry) => entry.text),
    ...(response?.anchorCatalysts ?? []).map((item) => item.headline),
    ...(response?.relatedCatalysts ?? []).map((item) => item.headline),
  ];
  return Math.ceil(parts.join("\n").length / 4);
}

function NarrativeChromeActions({
  mode,
  isHistoryOpen,
  onToggleHistory,
  onChangeMode,
}: {
  mode: NarrativeSurfaceMode;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onChangeMode: (mode: NarrativeSurfaceMode) => void;
}) {
  const options: { id: NarrativeSurfaceMode; label: string; icon: LucideIcon }[] = [
    { id: "workspace", label: "Workspace", icon: BriefcaseBusiness },
    { id: "map", label: "Map", icon: MapIcon },
  ];

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleHistory}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] transition duration-150 hover:-translate-y-px ${
          isHistoryOpen
            ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
            : "text-[var(--fintheon-muted)] hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-text)]"
        }`}
        title={isHistoryOpen ? "Close session history" : "Open session history"}
      >
        <PanelLeftOpen size={13} />
        Sessions
      </button>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChangeMode(id)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] transition duration-150 hover:-translate-y-px ${
            mode === id
              ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
              : "text-[var(--fintheon-muted)] hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-text)]"
          }`}
          title={`Show NarrativeFlow ${label}`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

function NarrativeSessionDrawer({
  isOpen,
  isWorkspaceOpen,
  sessions,
  activeSession,
  activeSessionId,
  onClose,
  onNewSession,
  onOpenSession,
  onRenameSession,
}: {
  isOpen: boolean;
  isWorkspaceOpen: boolean;
  sessions: NarrativeSessionSummary[];
  activeSession: NarrativeWorkspaceSession | null;
  activeSessionId: string | null;
  onClose: () => void;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
}) {
  return (
    <aside
      className={`absolute bottom-0 left-0 z-40 w-[360px] overflow-hidden bg-[var(--fintheon-bg)]/96 backdrop-blur-xl transition duration-200 ${
        isWorkspaceOpen ? "top-[50px]" : "top-0"
      } ${
        isOpen
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-full opacity-0"
      }`}
      style={{
        backgroundImage:
          "linear-gradient(to bottom, transparent, rgba(199,159,74,0.18), transparent)",
        backgroundPosition: "right top",
        backgroundRepeat: "no-repeat",
        backgroundSize: "1px 100%",
      }}
    >
      <div
        className="flex h-11 items-center justify-between px-3"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent, rgba(199,159,74,0.15), transparent)",
          backgroundPosition: "left bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 1px",
        }}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[var(--fintheon-accent)]" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
            Narratives
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
          title="Close narratives drawer"
        >
          <X size={14} />
        </button>
      </div>

      <div
        className="p-2"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent, rgba(199,159,74,0.10), transparent)",
          backgroundPosition: "left bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 1px",
        }}
      >
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex h-8 items-center gap-2 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
        >
          <Plus size={13} />
          New session
        </button>
      </div>

      <div className="h-[calc(100%-80px)] overflow-y-auto p-2">
        <DrawerSection label="Narratives">
          {sessions.length === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-[var(--fintheon-muted)]">
              No saved narratives yet.
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <NarrativeSessionDrawerRow
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onOpenSession={onOpenSession}
                  onRenameSession={onRenameSession}
                />
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection label="Chat Threads">
          {(activeSession?.transcript ?? []).length === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-[var(--fintheon-muted)]">
              No chat turns in the active workspace yet.
            </div>
          ) : (
            <div className="space-y-1">
              {(activeSession?.transcript ?? []).map((entry) => (
                <article
                  key={entry.id}
                  className="group px-2 py-2 transition hover:translate-x-0.5"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                    <MessageSquareText size={12} />
                    <span>{entry.speaker}</span>
                    <span>{entry.timestamp ? formatUpdatedAt(entry.timestamp) : "recent"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-text)]/75">
                    {entry.text}
                  </p>
                </article>
              ))}
            </div>
          )}
        </DrawerSection>
      </div>
    </aside>
  );
}

function DrawerSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <div
        className="mb-1 flex items-center gap-2 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/55"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(199,159,74,0.16), transparent)",
          backgroundPosition: "left bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 1px",
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function NarrativeSessionDrawerRow({
  session,
  isActive,
  onOpenSession,
  onRenameSession,
}: {
  session: NarrativeSessionSummary;
  isActive: boolean;
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [color, setColor] = useState(session.color);

  function commitRename() {
    setIsEditing(false);
    onRenameSession(session.id, title.trim() || session.title, color);
  }

  return (
    <article
      className={`group p-2 transition duration-150 hover:translate-x-0.5 ${
        isActive ? "text-[var(--fintheon-accent)]" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            onOpenSession(session.id);
          }}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: session.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-[var(--fintheon-text)]">
              {session.title}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
              <span>{session.catalystCount} catalysts</span>
              <span>{formatUpdatedAt(session.updatedAt)}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[var(--fintheon-muted)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--fintheon-accent)]"
          title="Rename narrative"
        >
          <Edit3 size={13} />
        </button>
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2 pl-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") setIsEditing(false);
            }}
            className="h-8 w-full rounded-[4px] bg-[var(--fintheon-accent)]/6 px-2 text-xs text-[var(--fintheon-text)] outline-none transition focus:bg-[var(--fintheon-accent)]/10"
            aria-label="Rename narrative"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {NARRATIVE_SWATCHES.map((swatch) => {
                const isSelected = swatch.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    className={`h-[18px] w-[18px] rounded-sm transition hover:-translate-y-px ${
                      isSelected ? "ring-1 ring-[var(--fintheon-text)]/70" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={commitRename}
              className="h-7 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:-translate-y-px"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recent";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

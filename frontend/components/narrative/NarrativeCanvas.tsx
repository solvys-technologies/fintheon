import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  PencilLine,
  History,
  MessageSquareText,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import ChatInterface, {
  type ChatInitialMessageRequest,
  type ChatWorkspaceOption,
} from "../ChatInterface";
import {
  normalizeReasoningLevel,
  type ReasoningLevel,
} from "../chat/reasoning";
import type { ZoomLevel } from "../../lib/narrative-types";
import type { Theme } from "../../hooks/useThemes";
import {
  createNarrativeSession,
  deleteNarrativeSession,
  fetchNarrativeSession,
  fetchNarrativeSessions,
  updateNarrativeSession,
  type CreateNarrativeSessionPayload,
} from "../../lib/narrative-session-api";
import { NarrativeFlowLanding } from "./NarrativeFlowLanding";
import { BetaState, DeskForecastsView } from "./DeskForecastsView";
import { DeskMap } from "./DeskMap";
import { NarrativeIvCardDeck } from "./NarrativeIvCardDeck";
import { NarrativeMermaidView } from "./NarrativeMermaidView";
import { NarrativeSessionDrawer as NarrativeSessionDrawerPanel } from "./NarrativeSessionDrawer";
import { NarrativeSessionManageModal } from "./NarrativeSessionManageModal";
import {
  NarrativeSessionWorkspace,
  type NarrativeWorkspaceSession,
} from "./NarrativeSessionWorkspace";
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
import {
  isNarrativeSurfaceMode,
  type NarrativeSurfaceMode,
} from "./narrative-surface-options";
import { useNarrativeAgentActions } from "./useNarrativeAgentActions";
import { ALL_NARRATIVES_SLUG } from "./narrative-selection";

interface NarrativeCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  themes: Theme[];
  isLoading?: boolean;
  chartMode?: boolean;
  surfaceModeOverride?: NarrativeSurfaceMode | null;
}

const NARRATIVE_SWATCHES = [
  "#c79f4a",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#14B8A6",
  "#F97316",
];
const researchRailKey = "narrativeflow:research-rail-open";

export function NarrativeCanvas({
  themes,
  isLoading = false,
  chartMode = false,
  surfaceModeOverride = null,
}: NarrativeCanvasProps) {
  const [sessions, setSessions] = useState<NarrativeSessionSummary[]>([]);
  const [activeSession, setActiveSession] =
    useState<NarrativeWorkspaceSession | null>(null);
  const [orientation, setOrientation] =
    useState<SensemakingOrientation>("horizontal");
  const [renderMode, setRenderMode] = useState<SensemakingRenderMode>("flow");
  const [surfaceMode, setSurfaceMode] =
    useState<NarrativeSurfaceMode>("workspace");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [requestedChatThreadId, setRequestedChatThreadId] = useState<
    string | null
  >(null);
  const [initialChatMessage, setInitialChatMessage] =
    useState<ChatInitialMessageRequest | null>(null);
  const [chatContextId, setChatContextId] = useState<string | null>(null);
  const [response, setResponse] = useState<SensemakingResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [headerActionsHost, setHeaderActionsHost] =
    useState<HTMLElement | null>(null);
  const [managedSession, setManagedSession] =
    useState<NarrativeSessionSummary | null>(null);
  const [managementBusy, setManagementBusy] = useState(false);
  const [isResearchRailOpen, setIsResearchRailOpen] = useState(() => {
    try {
      return localStorage.getItem(researchRailKey) !== "false";
    } catch {
      return true;
    }
  });
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
            err instanceof Error
              ? err.message
              : "Narrative sessions failed to load.",
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
    if (surfaceModeOverride) setSurfaceMode(surfaceModeOverride);
  }, [surfaceModeOverride]);

  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
      if (!isNarrativeSurfaceMode(mode)) return;
      setSurfaceMode(mode);
      setIsHistoryOpen(false);
    };
    window.addEventListener("fintheon:narrative-surface-change", handler);
    return () => {
      window.removeEventListener("fintheon:narrative-surface-change", handler);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fintheon:narrative-surface-state", {
        detail: { mode: surfaceMode },
      }),
    );
  }, [surfaceMode]);

  useEffect(() => {
    const syncHeaderHost = () => {
      setHeaderActionsHost(
        document.getElementById("narrativeflow-header-actions"),
      );
    };
    syncHeaderHost();
    const frame = requestAnimationFrame(syncHeaderHost);
    return () => cancelAnimationFrame(frame);
  }, [surfaceMode, activeSession?.id]);

  useEffect(() => {
    const toggleResearchRail = () => {
      setIsResearchRailOpen((value) => !value);
    };
    window.addEventListener(
      "fintheon:narrative-research-rail-toggle",
      toggleResearchRail,
    );
    return () => {
      window.removeEventListener(
        "fintheon:narrative-research-rail-toggle",
        toggleResearchRail,
      );
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(researchRailKey, String(isResearchRailOpen));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("fintheon:narrative-research-rail-state", {
        detail: {
          open:
            surfaceMode === "workspace" &&
            Boolean(activeSession) &&
            isResearchRailOpen,
          available: Boolean(activeSession && surfaceMode === "workspace"),
        },
      }),
    );
  }, [activeSession, isResearchRailOpen, surfaceMode]);

  const handleCreateSession = useCallback(
    async (payload: CreateNarrativeSessionPayload) => {
      setIsSubmitting(true);
      setValidationMessage(null);
      try {
        const bundle = await createNarrativeSession(payload);
        setActiveSession(bundle.session);
        setResponse(bundle.response);
        setChatContextId(bundle.session.id ?? null);
        setIsResearchRailOpen(true);
        if (payload.query.trim() && bundle.session.id) {
          setInitialChatMessage({
            id: `opener:${bundle.session.id}:${Date.now()}`,
            text: payload.query,
            resetConversation: true,
          });
        }
        setSessions((current) => [
          toSummary(bundle.session, bundle.session.catalystIds?.length ?? 0),
          ...current,
        ]);
      } catch (err) {
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative session failed.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const handleOpenSession = useCallback(async (id: string) => {
    setIsSubmitting(true);
    setValidationMessage(null);
    try {
      const bundle = await fetchNarrativeSession(id);
      setActiveSession(bundle.session);
      setResponse(bundle.response);
      setSurfaceMode("workspace");
    } catch (err) {
      setValidationMessage(
        err instanceof Error ? err.message : "Narrative session failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleRenameSession = useCallback(
    async (id: string, title: string, color: string) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === id ? { ...session, title, color } : session,
        ),
      );
      if (activeSession?.id === id) {
        setActiveSession((session) =>
          session ? { ...session, title, color } : session,
        );
      }
      try {
        const bundle = await updateNarrativeSession({ id, title, color });
        setActiveSession(bundle.session);
        setResponse(bundle.response);
      } catch (err) {
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative rename failed.",
        );
      }
    },
    [activeSession?.id],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      setManagementBusy(true);
      setValidationMessage(null);
      try {
        await deleteNarrativeSession(id);
        setSessions((current) =>
          current.filter((session) => session.id !== id),
        );
        if (activeSession?.id === id) {
          setActiveSession(null);
          setResponse(null);
          setSurfaceMode("workspace");
        }
        setManagedSession(null);
      } catch (err) {
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative delete failed.",
        );
      } finally {
        setManagementBusy(false);
      }
    },
    [activeSession?.id],
  );

  const handleSessionStatus = useCallback(
    async (id: string, status: "active" | "archived") => {
      setManagementBusy(true);
      setValidationMessage(null);
      const previous = sessions.find((session) => session.id === id);
      setSessions((current) =>
        current.map((session) =>
          session.id === id ? { ...session, status } : session,
        ),
      );
      try {
        const bundle = await updateNarrativeSession({ id, status });
        setSessions((current) =>
          current.map((session) =>
            session.id === id
              ? toSummary(
                  bundle.session,
                  previous?.catalystCount ??
                    bundle.session.catalystIds?.length ??
                    0,
                )
              : session,
          ),
        );
        if (status === "archived" && activeSession?.id === id) {
          setActiveSession(null);
          setResponse(null);
          setSurfaceMode("workspace");
        } else if (activeSession?.id === id) {
          setActiveSession(bundle.session);
          setResponse(bundle.response);
        }
        setManagedSession(null);
      } catch (err) {
        setSessions((current) =>
          current.map((session) =>
            session.id === id && previous ? previous : session,
          ),
        );
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative archive failed.",
        );
      } finally {
        setManagementBusy(false);
      }
    },
    [activeSession?.id, sessions],
  );

  const handleCoverChange = useCallback(
    async (cover: {
      coverImageUrl: string | null;
      coverImagePrompt: string | null;
    }) => {
      const id = activeSession?.id;
      if (!id) {
        setValidationMessage(
          "Open a saved narrative session before changing the cover.",
        );
        return;
      }
      setActiveSession((session) =>
        session
          ? {
              ...session,
              coverImageUrl: cover.coverImageUrl,
              coverImagePrompt: cover.coverImagePrompt,
              coverImageUpdatedAt: new Date().toISOString(),
            }
          : session,
      );
      try {
        const bundle = await updateNarrativeSession({
          id,
          coverImageUrl: cover.coverImageUrl,
          coverImagePrompt: cover.coverImagePrompt,
        });
        setActiveSession(bundle.session);
        setResponse(bundle.response);
      } catch (err) {
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative cover failed.",
        );
        throw err;
      }
    },
    [activeSession?.id],
  );

  function handleReasoningLevelChange(level: ReasoningLevel) {
    setReasoningLevel(level);
    try {
      localStorage.setItem("fintheon:narrative-reasoning-level", level);
    } catch {
      /* ignore */
    }
  }

  const resetWorkspace = () => {
    setActiveSession(null);
    setResponse(null);
    setSurfaceMode("workspace");
    setIsHistoryOpen(false);
  };
  const handleQuickAction = useCallback(
    (action: string, catalystId: string | null) => {
      const target = catalystId ? ` for catalyst ${catalystId}` : "";
      window.dispatchEvent(
        new CustomEvent("fintheon:send-chat-text", {
          detail: { text: `${action} this major development${target}.` },
        }),
      );
    },
    [],
  );
  const openResearchRailForNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsResearchRailOpen(true);
  }, []);
  const handleOpenSessionFromMap = useCallback(
    async (id: string) => {
      await handleOpenSession(id);
      setSurfaceMode("map");
    },
    [handleOpenSession],
  );
  const handleOpenWorkspaceThread = useCallback(
    async (sessionId: string, threadId: string) => {
      if (activeSession?.id !== sessionId) await handleOpenSession(sessionId);
      setSurfaceMode("workspace");
      setRequestedChatThreadId(threadId);
    },
    [activeSession?.id, handleOpenSession],
  );
  const handleChatContextChange = useCallback(
    async (id: string) => {
      setChatContextId(id);
      if (id === ALL_NARRATIVES_SLUG) return;
      await handleOpenSession(id);
    },
    [handleOpenSession],
  );
  const handleOpenSessionChat = useCallback(
    async (input: {
      sessionId: string;
      message: string;
      reasoningLevel?: ReasoningLevel;
    }) => {
      setIsSubmitting(true);
      setValidationMessage(null);
      try {
        await handleOpenSession(input.sessionId);
        setChatContextId(input.sessionId);
        setIsResearchRailOpen(true);
        setInitialChatMessage({
          id: `existing:${input.sessionId}:${Date.now()}`,
          text: input.message,
          resetConversation: true,
        });
      } catch (err) {
        setValidationMessage(
          err instanceof Error ? err.message : "Narrative session failed.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [handleOpenSession],
  );
  const hasWorkspaceIvDeck = Boolean(
    response &&
    (response.anchorCatalysts.length > 0 ||
      response.relatedCatalysts.length > 0),
  );
  const railCanvas = activeSession ? (
    <div className="relative h-full min-h-0 overflow-hidden">
      <NarrativeWorkspaceTopBar
        orientation={orientation}
        renderMode={renderMode}
        onOrientationChange={setOrientation}
        onRenderModeChange={setRenderMode}
        showViewControls={false}
      />
      {hasWorkspaceIvDeck ? (
        <NarrativeIvCardDeck
          response={response}
          selectedNodeId={selectedNodeId}
          onSelectNode={openResearchRailForNode}
        />
      ) : null}
      <div
        className={`absolute inset-x-0 bottom-0 ${
          hasWorkspaceIvDeck ? "top-[154px]" : "top-[50px]"
        }`}
      >
        {renderMode === "mermaid" && response ? (
          <NarrativeMermaidView source={response.mermaidSource} />
        ) : (
          <NarrativeSensemakingMap
            response={response}
            orientation={orientation}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onOpenResearchRail={openResearchRailForNode}
          />
        )}
      </div>
      <div className="absolute bottom-3 left-3 z-30">
        <NarrativeWorkspaceViewMenu
          orientation={orientation}
          renderMode={renderMode}
          onOrientationChange={setOrientation}
          onRenderModeChange={setRenderMode}
          menuPlacement="above-left"
        />
      </div>
    </div>
  ) : null;
  const activeSessionSummary =
    sessions.find((session) => session.id === activeSession?.id) ??
    (activeSession
      ? toSummary(activeSession, activeSession.catalystIds?.length ?? 0)
      : null);
  const chatWorkspaceOptions: ChatWorkspaceOption[] = activeSession
    ? [
        activeSessionSummary,
        ...sessions.filter((session) => session.id !== activeSession.id),
      ]
        .filter((session): session is NarrativeSessionSummary =>
          Boolean(session),
        )
        .map((session) => ({
          id: session.id,
          title: session.title,
          status: session.status,
          color: session.color,
          hasArtifacts:
            session.id === activeSession?.id ? Boolean(response) : undefined,
        }))
    : [];
  const chatActiveWorkspaceId = chatContextId ?? activeSession?.id ?? null;
  useNarrativeAgentActions({
    activeSession,
    setActiveSession,
    setResponse,
    setSurfaceMode,
    setIsHistoryOpen,
    setIsResearchRailOpen,
    setValidationMessage,
    openSession: handleOpenSession,
    renameSession: handleRenameSession,
  });
  const chromeActions = (
    <NarrativeChromeActions
      isHistoryOpen={isHistoryOpen}
      onNewSession={resetWorkspace}
      onToggleHistory={() => setIsHistoryOpen((value) => !value)}
    />
  );
  const headerActions = <>{chromeActions}</>;
  const workspaceSurface = !activeSession ? (
    <NarrativeFlowLanding
      sessions={sessions}
      isSubmitting={isSubmitting || isLoading}
      statusMessage={validationMessage}
      reasoningLevel={reasoningLevel}
      onReasoningLevelChange={handleReasoningLevelChange}
      onCreateSession={handleCreateSession}
      onOpenSessionChat={handleOpenSessionChat}
    />
  ) : (
    <NarrativeSessionWorkspace
      session={activeSession}
      response={response}
      selectedNodeId={selectedNodeId}
      themeCount={themes.length}
      isResearchRailOpen={surfaceMode === "workspace" && isResearchRailOpen}
      onSelectNode={openResearchRailForNode}
      onRename={(title, color) =>
        activeSession.id &&
        handleRenameSession(
          activeSession.id,
          title,
          color ?? activeSession.color ?? "#c79f4a",
        )
      }
      onCoverChange={handleCoverChange}
      onQuickAction={handleQuickAction}
      railCanvas={railCanvas}
    >
      <ChatInterface
        surfaceId="narrativeflow"
        workspaceOptions={chatWorkspaceOptions}
        activeWorkspaceId={chatActiveWorkspaceId}
        onWorkspaceChange={handleChatContextChange}
        workspaceSelectorLabel="Attach Narrative"
        requestedConversationId={requestedChatThreadId}
        initialMessageRequest={initialChatMessage}
        onInitialMessageHandled={(id) =>
          setInitialChatMessage((current) =>
            current?.id === id ? null : current,
          )
        }
        emptyState={<NarrativeFlowWorkspaceGreeting session={activeSession} />}
        composerPlacement="center-until-start"
        hideHeader
      />
    </NarrativeSessionWorkspace>
  );

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[var(--fintheon-bg)]">
      {headerActionsHost
        ? createPortal(headerActions, headerActionsHost)
        : null}
      {!headerActionsHost && surfaceMode === "workspace" && !activeSession ? (
        <div className="absolute right-3 top-3 z-50">{chromeActions}</div>
      ) : null}

      <NarrativeSessionDrawerPanel
        isOpen={isHistoryOpen}
        isWorkspaceOpen={
          (surfaceMode === "workspace" || surfaceMode === "map") &&
          Boolean(activeSession)
        }
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        onClose={() => setIsHistoryOpen(false)}
        onNewSession={resetWorkspace}
        onOpenSession={handleOpenSession}
        onOpenThread={handleOpenWorkspaceThread}
        onRenameSession={handleRenameSession}
        onManageSession={setManagedSession}
      />

      <NarrativeSessionManageModal
        open={Boolean(managedSession)}
        session={managedSession}
        isBusy={managementBusy}
        onClose={() => setManagedSession(null)}
        onDelete={handleDeleteSession}
        onArchive={(id) => handleSessionStatus(id, "archived")}
        onRestore={(id) => handleSessionStatus(id, "active")}
      />

      {surfaceMode === "forecasts" ? (
        <DeskForecastsView />
      ) : surfaceMode === "coliseum" ? (
        <BetaState label="Coliseum feed is closed-beta gated." />
      ) : surfaceMode === "resolved" ? (
        <BetaState label="Resolved forecasts will unlock after monitor history accrues." />
      ) : surfaceMode === "map" ? (
        <DeskMap
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          onOpenSession={handleOpenSessionFromMap}
        />
      ) : (
        workspaceSurface
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
    status: session.status ?? "active",
    deskLabel: "Priced In Capital",
  };
}

function NarrativeFlowWorkspaceGreeting({
  session,
}: {
  session: NarrativeWorkspaceSession;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative flex min-h-[620px] w-full flex-col justify-center overflow-hidden px-4 py-10 text-center">
      <div
        className={`pointer-events-none relative -top-16 mx-auto mb-8 w-full max-w-3xl transition duration-500 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <h2
          className={`text-[26px] leading-tight text-[var(--fintheon-text)]/86 ${
            mounted ? "greeting-animate greeting-settle" : ""
          }`}
          style={{ fontFamily: "var(--font-display, var(--font-heading))" }}
        >
          Build the narrative before the market names it.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-[12px] leading-5 text-[var(--fintheon-muted)]/70">
          {session.title ?? "Active narrative"} is open and ready for the next
          desk turn.
        </p>
      </div>
    </div>
  );
}

function NarrativeChromeActions({
  isHistoryOpen,
  onNewSession,
  onToggleHistory,
}: {
  isHistoryOpen: boolean;
  onNewSession: () => void;
  onToggleHistory: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onNewSession}
        className="grid h-8 w-8 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition duration-150 hover:-translate-y-px hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)]"
        title="New session"
        aria-label="New session"
      >
        <StickyNote size={13} />
      </button>
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
        <History size={13} />
      </button>
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
      className={`narrative-session-drawer-motion absolute bottom-0 left-0 z-40 w-[360px] overflow-hidden bg-[var(--fintheon-bg)]/96 backdrop-blur-xl transition duration-200 ${
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
                    <span>
                      {entry.timestamp
                        ? formatUpdatedAt(entry.timestamp)
                        : "recent"}
                    </span>
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
      className={`narrative-session-row group p-2 transition duration-150 hover:translate-x-0.5 ${
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
          <PencilLine size={13} />
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
                      isSelected
                        ? "ring-1 ring-[var(--fintheon-text)]/70"
                        : "opacity-80 hover:opacity-100"
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

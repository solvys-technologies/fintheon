import { useCallback, useEffect, useState } from "react";
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
import { useNarrativeSituationMap } from "../../hooks/useNarrativeSituationMap";
import { NarrativeFlowLanding } from "./NarrativeFlowLanding";
import { NarrativeMermaidView } from "./NarrativeMermaidView";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import { NarrativeSessionWorkspace, type NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import { NarrativeSensemakingMap } from "./NarrativeSensemakingMap";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import {
  NarrativeSituationOverlay,
  NarrativeWorkspaceTopBar,
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
}

export function NarrativeCanvas({ themes, isLoading = false }: NarrativeCanvasProps) {
  const [sessions, setSessions] = useState<NarrativeSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<NarrativeWorkspaceSession | null>(null);
  const [orientation, setOrientation] = useState<SensemakingOrientation>("horizontal");
  const [renderMode, setRenderMode] = useState<SensemakingRenderMode>("flow");
  const [response, setResponse] = useState<SensemakingResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isSituationOpen, setIsSituationOpen] = useState(false);
  const situation = useNarrativeSituationMap(isSituationOpen ? undefined : null);

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

  const handleWorkspaceRequest = useCallback(async () => {
    const sessionId = activeSession?.id;
    const catalystIds = activeSession?.catalystIds ?? [];
    if (!sessionId || catalystIds.length === 0) {
      setValidationMessage("This narrative does not have persisted catalysts yet.");
      return;
    }

    setIsSubmitting(true);
    setValidationMessage(null);
    try {
      const nextResponse = await refineNarrativeSession({
        sessionId,
        query: workspaceQuery,
        catalystIds,
        orientation,
        renderMode,
      });
      setResponse(nextResponse);
      setActiveSession((session) =>
        session
          ? {
              ...session,
              synthesis: nextResponse.synthesisSummary,
              report: nextResponse.forecast?.rationale ?? nextResponse.synthesisSummary,
              generatedAt: nextResponse.generatedAt,
            }
          : session,
      );
      setWorkspaceQuery("");
    } catch (err) {
      setValidationMessage(err instanceof Error ? err.message : "Narrative request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSession?.catalystIds, activeSession?.id, orientation, renderMode, workspaceQuery]);

  const workspaceHeadlines = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts].map((item) => ({
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
      }))
    : [];

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[var(--fintheon-bg)]">
      {!activeSession ? (
        <NarrativeFlowLanding
          sessions={sessions}
          isSubmitting={isSubmitting || isLoading}
          statusMessage={validationMessage}
          onCreateSession={handleCreateSession}
          onOpenSession={handleOpenSession}
          onRenameSession={handleRenameSession}
        />
      ) : (
        <NarrativeSessionWorkspace
          session={activeSession}
          response={response}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onRename={(title) =>
            activeSession.id && handleRenameSession(activeSession.id, title, activeSession.color ?? "#c79f4a")
          }
        >
          <NarrativeWorkspaceTopBar
            themes={themes.length}
            orientation={orientation}
            renderMode={renderMode}
            onBack={() => {
              setActiveSession(null);
              setResponse(null);
              setIsSituationOpen(false);
            }}
            onOpenSituation={() => setIsSituationOpen(true)}
            onOrientationChange={setOrientation}
            onRenderModeChange={setRenderMode}
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
            onQueryChange={setWorkspaceQuery}
            onOpenDrawer={() => setValidationMessage("Use Sessions to refine the catalyst set.")}
            onRemoveHeadline={() => setValidationMessage("Catalyst refinement is saved from Sessions.")}
            onSubmit={handleWorkspaceRequest}
          />
        </NarrativeSessionWorkspace>
      )}

      <NarrativeSituationOverlay
        isOpen={isSituationOpen}
        situation={situation}
        onClose={() => setIsSituationOpen(false)}
      />
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

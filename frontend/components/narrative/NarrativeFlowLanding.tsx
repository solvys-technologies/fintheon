import { useEffect, useMemo, useState } from "react";
import type { HeadlineAttachment } from "../chat/FintheonAttachPopup";
import { useMessageQueue } from "../chat/hooks/useMessageQueue";
import type { ReasoningLevel } from "../chat/reasoning";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import { DEFAULT_NARRATIVE_SESSION_CHIPS } from "../../hooks/useNarrativeSituationMap";
import { useNarrativeRiskFlowHeadlines } from "../../hooks/useNarrativeRiskFlowHeadlines";
import type { AlertSeverity, RiskFlowAlert } from "../../lib/riskflow-feed";

export interface NarrativeCreateSessionInput {
  query: string;
  catalystIds: string[];
  narrativeSlugs: string[];
  title: string;
  color: string;
  reasoningLevel?: ReasoningLevel;
}

interface NarrativeFlowLandingProps {
  sessions?: NarrativeSessionSummary[];
  isSubmitting?: boolean;
  statusMessage?: string | null;
  reasoningLevel: ReasoningLevel;
  onCreateSession: (input: NarrativeCreateSessionInput) => void;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
}

const MIN_CATALYSTS = 3;
const DEFAULT_COLOR = "#c79f4a";
const DEFAULT_SESSIONS: NarrativeSessionSummary[] = [
  {
    id: "desk-session-fed-path",
    title: "Fed path repricing after mixed labor tape",
    updatedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    catalystCount: 7,
    color: "#34D399",
    deskLabel: "Priced In Capital",
  },
  {
    id: "desk-session-inflation-breadth",
    title: "Inflation breadth versus rate-cut confidence",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    catalystCount: 5,
    color: "#FBBF24",
    deskLabel: "Priced In Capital",
  },
  {
    id: "desk-session-employment-slack",
    title: "Employment slack and terminal rate risk",
    updatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    catalystCount: 4,
    color: "#A78BFA",
    deskLabel: "Priced In Capital",
  },
];

export function NarrativeFlowLanding({
  sessions = DEFAULT_SESSIONS,
  isSubmitting = false,
  statusMessage = null,
  reasoningLevel,
  onCreateSession,
  onReasoningLevelChange,
}: NarrativeFlowLandingProps) {
  const { headlines } = useNarrativeRiskFlowHeadlines();
  const [query, setQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNarratives, setSelectedNarratives] = useState<Set<string>>(
    () => new Set(DEFAULT_NARRATIVE_SESSION_CHIPS.map((item) => item.slug)),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isGreetingReady, setIsGreetingReady] = useState(false);
  const [isGreetingLeaving, setIsGreetingLeaving] = useState(false);
  const [isCaoWolfEnabled, setIsCaoWolfEnabled] = useState(true);
  const [caoWolfRunKey, setCaoWolfRunKey] = useState(0);

  const attachedHeadlines = useMemo(
    () => headlines.filter((headline) => selectedIds.has(headline.id)),
    [headlines, selectedIds],
  );

  const riskflowAlerts = useMemo<RiskFlowAlert[]>(
    () =>
      headlines.map((headline) => ({
        id: headline.id,
        headline: headline.headline,
        summary: headline.summary,
        publishedAt: headline.publishedAt,
        source: "backend",
        severity: normalizeSeverity(headline.severity),
        tags: headline.tags,
        symbols: headline.symbols,
      })),
    [headlines],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsGreetingReady(true);
      setCaoWolfRunKey((key) => key + 1);
    }, 560);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleCaoWolfToggle(event: KeyboardEvent) {
      const isRightCommand =
        event.code === "MetaRight" ||
        (event.key === "Meta" && event.location === 2);

      if (!event.altKey || !event.metaKey || !isRightCommand) return;

      event.preventDefault();
      setIsCaoWolfEnabled((current) => {
        const next = !current;
        if (next && isGreetingReady) setCaoWolfRunKey((key) => key + 1);
        return next;
      });
    }

    window.addEventListener("keydown", handleCaoWolfToggle);
    return () => window.removeEventListener("keydown", handleCaoWolfToggle);
  }, [isGreetingReady]);

  useEffect(() => {
    if (!isSubmitting && statusMessage && isGreetingLeaving) {
      setIsGreetingLeaving(false);
    }
  }, [isGreetingLeaving, isSubmitting, statusMessage]);

  function attachHeadlines(items: HeadlineAttachment[]) {
    setSelectedIds((current) => {
      const next = new Set(current);
      items.forEach((item) => next.add(item.id));
      return next;
    });
    setIsPickerOpen(false);
    setValidationMessage(null);
  }

  function removeHeadline(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function toggleNarrative(slug: string) {
    setSelectedNarratives((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function submitSessionWithQuery(nextQuery: string) {
    if (selectedIds.size < MIN_CATALYSTS) {
      setValidationMessage("Attach three RiskFlow catalysts to start.");
      setIsPickerOpen(true);
      return;
    }

    setIsGreetingLeaving(true);
    onCreateSession({
      query: nextQuery,
      catalystIds: Array.from(selectedIds),
      narrativeSlugs: Array.from(selectedNarratives),
      title: deriveTitle(nextQuery, attachedHeadlines),
      color: DEFAULT_COLOR,
      reasoningLevel,
    });
    setQuery("");
  }

  const {
    queue,
    addQueue,
    editQueue,
    removeQueue,
    reorderQueue,
    sendOne,
    sendAll,
  } = useMessageQueue({
    isRunning: isSubmitting,
    sendNow: submitSessionWithQuery,
    storageKey: "fintheon:narrative-opener-queue",
  });

  function handleCreateSession() {
    submitSessionWithQuery(query);
  }

  const greetingPhaseClass = isGreetingLeaving
    ? "-translate-y-8 opacity-0"
    : isGreetingReady
      ? "translate-y-0 opacity-100"
      : "translate-y-4 opacity-0";

  return (
    <div className="narrative-analysis-panel relative flex h-full min-h-[620px] flex-col justify-center overflow-hidden bg-[var(--fintheon-bg)] px-4 py-10">
      <div
        className={`pointer-events-none relative -top-16 mx-auto mb-8 w-full max-w-3xl text-center transition duration-500 ${greetingPhaseClass}`}
      >
        <p
          className="text-[26px] leading-tight text-[var(--fintheon-text)]/86"
          style={{ fontFamily: "var(--font-display, var(--font-heading))" }}
        >
          Build the narrative before the market names it.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-[12px] leading-5 text-[var(--fintheon-muted)]/70">
          Attach at least three RiskFlow catalysts, choose the desk narratives
          that matter, then ask NarrativeFlow to organize the session. Use
          @rate-cut-cycle, @price-stability, or @max-employment to bind the
          request to a narrative.
        </p>
      </div>

      <div
        className={`relative top-6 mx-auto mt-[min(15vh,112px)] w-full max-w-5xl transition duration-500 ${greetingPhaseClass}`}
      >
        <NarrativeSensemakingComposer
          mode="opener"
          query={query}
          attachedHeadlines={attachedHeadlines}
          isSubmitting={isSubmitting}
          validationMessage={validationMessage ?? statusMessage}
          minHeadlines={MIN_CATALYSTS}
          submitLabel="Start"
          attachLabel="RiskFlow"
          narrativeChips={DEFAULT_NARRATIVE_SESSION_CHIPS}
          selectedNarrativeSlugs={selectedNarratives}
          reasoningLevel={reasoningLevel}
          queue={queue}
          riskflowAlerts={riskflowAlerts}
          riskFlowDrawerOpen={isPickerOpen}
          caoWolfEnabled={isGreetingReady && isCaoWolfEnabled}
          caoWolfRunKey={`landing:${caoWolfRunKey}`}
          caoWolfReserveSpace
          onAttachHeadlines={attachHeadlines}
          contextStats={{
            messageCount: sessions.length,
            estimatedTokens: estimateLandingTokens(query, attachedHeadlines),
            connectorCount: attachedHeadlines.length,
            activeSkillLabel: "NarrativeFlow",
          }}
          onQueryChange={setQuery}
          onOpenDrawer={() => setIsPickerOpen((open) => !open)}
          onCloseDrawer={() => setIsPickerOpen(false)}
          onRemoveHeadline={removeHeadline}
          onSubmit={handleCreateSession}
          onQueueMessage={addQueue}
          onEditQueue={editQueue}
          onRemoveQueue={removeQueue}
          onReorderQueue={reorderQueue}
          onSendQueueOne={sendOne}
          onSendQueueAll={sendAll}
          onReasoningLevelChange={onReasoningLevelChange}
          onToggleNarrative={toggleNarrative}
        />

      </div>

    </div>
  );
}

function normalizeSeverity(value: string): AlertSeverity {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }
  return "medium";
}

function deriveTitle(query: string, headlines: NarrativeHeadlineOption[]) {
  const trimmed = query.trim();
  if (trimmed.length > 0) return trimmed.slice(0, 96);
  return headlines[0]?.headline.slice(0, 96) ?? "Untitled narrative";
}

function estimateLandingTokens(
  query: string,
  headlines: NarrativeHeadlineOption[],
): number {
  return Math.ceil(
    `${query}\n${headlines.map((item) => item.headline).join("\n")}`.length / 4,
  );
}

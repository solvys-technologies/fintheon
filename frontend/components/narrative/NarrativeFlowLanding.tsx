import { useEffect, useMemo, useState } from "react";
import type { HeadlineAttachment } from "../chat/FintheonAttachPopup";
import { useMessageQueue } from "../chat/hooks/useMessageQueue";
import type { ReasoningLevel } from "../chat/reasoning";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import { useNarrativeRiskFlowHeadlines } from "../../hooks/useNarrativeRiskFlowHeadlines";
import type { AlertSeverity, RiskFlowAlert } from "../../lib/riskflow-feed";
import {
  ALL_NARRATIVES_LABEL,
  ALL_NARRATIVES_SLUG,
  NO_NARRATIVE_LABEL,
  NO_NARRATIVE_SLUG,
  selectedNarrativeColor as colorForNarrative,
  selectedNarrativeTags,
  type NarrativeSelectionChip,
} from "./narrative-selection";

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

const MIN_CATALYSTS = 0;
const DEFAULT_COLOR = "#c79f4a";

export function NarrativeFlowLanding({
  sessions = [],
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
    () => new Set([NO_NARRATIVE_SLUG]),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isGreetingReady, setIsGreetingReady] = useState(false);
  const [isGreetingLeaving, setIsGreetingLeaving] = useState(false);
  const [isCaoWolfEnabled, setIsCaoWolfEnabled] = useState(true);
  const [caoWolfRunKey, setCaoWolfRunKey] = useState(0);

  const attachedHeadlines = useMemo(
    () => headlines.filter((headline) => selectedIds.has(headline.id)),
    [headlines, selectedIds],
  );

  const narrativeChips = useMemo<NarrativeSelectionChip[]>(() => {
    const sessionChips = sessions.map((session) => ({
      slug: session.id,
      label: session.title,
      color: session.color,
    }));
    const emptyOption = {
      slug: NO_NARRATIVE_SLUG,
      label: NO_NARRATIVE_LABEL,
      color: DEFAULT_COLOR,
    };
    const allOption = {
      slug: ALL_NARRATIVES_SLUG,
      label: ALL_NARRATIVES_LABEL,
      color: DEFAULT_COLOR,
    };
    return sessionChips.length
      ? [emptyOption, allOption, ...sessionChips]
      : [emptyOption];
  }, [sessions]);

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

  useEffect(() => {
    if (narrativeChips.length === 0) return;
    setSelectedNarratives((current) => {
      const validSlugs = new Set(narrativeChips.map((chip) => chip.slug));
      const active = Array.from(current).find((slug) => validSlugs.has(slug));
      return new Set([active ?? NO_NARRATIVE_SLUG]);
    });
  }, [narrativeChips]);

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
    setSelectedNarratives(new Set([slug]));
  }

  function submitSessionWithQuery(nextQuery: string, contextSuffix = "") {
    const enrichedQuery = `${nextQuery}${contextSuffix}`;
    setIsGreetingLeaving(true);
    onCreateSession({
      query: enrichedQuery,
      catalystIds: Array.from(selectedIds),
      narrativeSlugs: selectedNarrativeTags(narrativeChips, selectedNarratives),
      title: deriveTitle(nextQuery, attachedHeadlines),
      color: colorForNarrative(
        narrativeChips,
        selectedNarratives,
        DEFAULT_COLOR,
      ),
      reasoningLevel,
    });
    setQuery("");
    setValidationMessage(null);
    setIsPickerOpen(false);
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

  function handleCreateSession(contextSuffix?: string) {
    submitSessionWithQuery(query, contextSuffix);
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
          Attach RiskFlow catalysts when useful, select a saved narrative only
          when needed, then ask NarrativeFlow to organize the session.
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
          narrativeChips={narrativeChips}
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
  const text = `${query}\n${headlines.map((item) => item.headline).join("\n")}`;
  return Math.ceil(text.length / 4);
}

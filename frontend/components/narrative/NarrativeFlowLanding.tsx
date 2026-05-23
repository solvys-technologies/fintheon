import { useMemo, useState } from "react";
import { useMessageQueue } from "../chat/hooks/useMessageQueue";
import type { ReasoningLevel } from "../chat/reasoning";
import { NarrativeRiskFlowPicker } from "./NarrativeRiskFlowPicker";
import { NarrativeSensemakingComposer } from "./NarrativeSensemakingComposer";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import type { NarrativeHeadlineOption } from "./sensemaking-types";
import { DEFAULT_NARRATIVE_SESSION_CHIPS } from "../../hooks/useNarrativeSituationMap";
import { useNarrativeRiskFlowHeadlines } from "../../hooks/useNarrativeRiskFlowHeadlines";

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
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string, color: string) => void;
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
  onOpenSession,
  onRenameSession,
  onReasoningLevelChange,
}: NarrativeFlowLandingProps) {
  const { headlines, isLoading, error } = useNarrativeRiskFlowHeadlines();
  const [query, setQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNarratives, setSelectedNarratives] = useState<Set<string>>(
    () => new Set(DEFAULT_NARRATIVE_SESSION_CHIPS.map((item) => item.slug)),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const attachedHeadlines = useMemo(
    () => headlines.filter((headline) => selectedIds.has(headline.id)),
    [headlines, selectedIds],
  );

  function toggleHeadline(headline: NarrativeHeadlineOption) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(headline.id)) next.delete(headline.id);
      else next.add(headline.id);
      return next;
    });
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
      setValidationMessage("[SELECT 3 CATALYSTS]");
      setIsPickerOpen(true);
      return;
    }

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

  return (
    <div className="relative flex h-full min-h-[620px] flex-col justify-center overflow-hidden bg-[var(--fintheon-bg)] px-4 py-10">
      <div className="pointer-events-none mx-auto mb-8 w-full max-w-3xl text-center">
        <p
          className="text-[26px] leading-tight text-[var(--fintheon-text)]/86"
          style={{ fontFamily: "var(--font-display, var(--font-heading))" }}
        >
          Build the narrative before the market names it.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-[12px] leading-5 text-[var(--fintheon-muted)]/70">
          Attach at least three RiskFlow catalysts, choose the desk narratives
          that matter, then ask NarrativeFlow to organize the session into a
          workspace and map.
        </p>
      </div>

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
        contextStats={{
          messageCount: sessions.length,
          estimatedTokens: estimateLandingTokens(query, attachedHeadlines),
          connectorCount: attachedHeadlines.length,
          activeSkillLabel: "NarrativeFlow",
        }}
        onQueryChange={setQuery}
        onOpenDrawer={() => setIsPickerOpen(true)}
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

      <div
        className={`overflow-hidden transition duration-300 ${
          isPickerOpen
            ? "mt-8 max-h-80 translate-y-0 opacity-100"
            : "pointer-events-none mt-0 max-h-0 translate-y-6 opacity-0"
        }`}
        aria-hidden={!isPickerOpen}
      >
        <NarrativeRiskFlowPicker
          headlines={headlines}
          selectedIds={selectedIds}
          isLoading={isLoading}
          error={error}
          minSelected={MIN_CATALYSTS}
          onToggle={toggleHeadline}
        />
      </div>
    </div>
  );
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

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { HeadlineAttachment } from "../chat/FintheonAttachPopup";
import { StreamdownChat } from "../chat/slots";
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

interface NarrativePlanAnswers {
  thesis: string;
  evidence: string;
  output: string;
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
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isGreetingReady, setIsGreetingReady] = useState(false);
  const [isGreetingLeaving, setIsGreetingLeaving] = useState(false);
  const [isCaoWolfEnabled, setIsCaoWolfEnabled] = useState(true);
  const [caoWolfRunKey, setCaoWolfRunKey] = useState(0);
  const [planDraft, setPlanDraft] =
    useState<NarrativeCreateSessionInput | null>(null);
  const [planAnswers, setPlanAnswers] = useState<NarrativePlanAnswers>({
    thesis: "",
    evidence: "",
    output: "",
  });
  const [planReviewOpen, setPlanReviewOpen] = useState(false);

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

    const draft = {
      query: nextQuery,
      catalystIds: Array.from(selectedIds),
      narrativeSlugs: Array.from(selectedNarratives),
      title: deriveTitle(nextQuery, attachedHeadlines),
      color: DEFAULT_COLOR,
      reasoningLevel,
    };
    setPlanDraft(draft);
    setPlanAnswers({
      thesis: nextQuery,
      evidence: "",
      output: "",
    });
    setPlanReviewOpen(false);
    setValidationMessage(null);
    setIsPickerOpen(false);
  }

  function updatePlanAnswer(key: keyof NarrativePlanAnswers, value: string) {
    setPlanAnswers((current) => ({ ...current, [key]: value }));
  }

  function cancelPlanMode() {
    setPlanReviewOpen(false);
    setPlanDraft(null);
  }

  function reviewPlanMode() {
    setPlanReviewOpen(true);
  }

  function denyPlanMode() {
    setPlanReviewOpen(false);
  }

  function submitPlanMode() {
    if (!planDraft) return;
    const enrichedQuery = [
      planDraft.query,
      "",
      "Plan-mode intake:",
      `- Core thesis: ${planAnswers.thesis.trim()}`,
      `- Confirmation and invalidation: ${planAnswers.evidence.trim()}`,
      `- Horizon and output: ${planAnswers.output.trim()}`,
    ].join("\n");

    setIsGreetingLeaving(true);
    onCreateSession({
      ...planDraft,
      query: enrichedQuery,
      title: deriveTitle(
        planAnswers.thesis || planDraft.query,
        attachedHeadlines,
      ),
    });
    setPlanDraft(null);
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
        {planDraft ? (
          planReviewOpen ? (
            <NarrativeDeliberationAgentSummary
              prompt={planDraft.query}
              summaryMarkdown={buildPlanSummaryMarkdown({
                answers: planAnswers,
                catalystHeadlines: attachedHeadlines,
                narrativeSlugs: Array.from(selectedNarratives),
              })}
              isSubmitting={isSubmitting}
              onDeny={denyPlanMode}
              onApprove={submitPlanMode}
            />
          ) : (
            <NarrativePlanModeDrawer
              answers={planAnswers}
              isSubmitting={isSubmitting}
              onAnswerChange={updatePlanAnswer}
              onCancel={cancelPlanMode}
              onReview={reviewPlanMode}
            />
          )
        ) : null}
        {!planDraft ? (
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
        ) : null}
      </div>
    </div>
  );
}

function NarrativePlanModeDrawer({
  answers,
  isSubmitting,
  onAnswerChange,
  onCancel,
  onReview,
}: {
  answers: NarrativePlanAnswers;
  isSubmitting: boolean;
  onAnswerChange: (key: keyof NarrativePlanAnswers, value: string) => void;
  onCancel: () => void;
  onReview: () => void;
}) {
  const canReview =
    answers.thesis.trim().length > 0 &&
    answers.evidence.trim().length > 0 &&
    answers.output.trim().length > 0 &&
    !isSubmitting;

  return (
    <div className="pointer-events-auto mx-auto mb-3 max-w-[56rem] rounded-2xl border border-[var(--fintheon-accent)]/22 bg-[#080705]/96 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--fintheon-accent)]/10 pb-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fintheon-accent)]">
            Plan Mode
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--fintheon-text)]/62">
            Answer these before NarrativeFlow summarizes the build.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--fintheon-accent)]/14 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-text)]/52 transition-colors hover:text-[var(--fintheon-text)]"
        >
          Edit prompt
        </button>
      </div>
      <div className="grid gap-2 py-3 md:grid-cols-3">
        <PlanQuestion
          index={1}
          label="Core thesis"
          value={answers.thesis}
          placeholder="What market question are we proving?"
          onChange={(value) => onAnswerChange("thesis", value)}
        />
        <PlanQuestion
          index={2}
          label="Evidence"
          value={answers.evidence}
          placeholder="What confirms or invalidates it?"
          onChange={(value) => onAnswerChange("evidence", value)}
        />
        <PlanQuestion
          index={3}
          label="Output"
          value={answers.output}
          placeholder="Horizon, watchlist, map, forecast, docs..."
          onChange={(value) => onAnswerChange("output", value)}
        />
      </div>
      <div className="flex items-center justify-between border-t border-[var(--fintheon-accent)]/10 pt-3">
        <p className="text-[11px] text-[var(--fintheon-muted)]/70">
          Chat runs naturally after this narrative is built.
        </p>
        <button
          type="button"
          onClick={onReview}
          disabled={!canReview}
          className="rounded-md bg-[var(--fintheon-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#050402] transition-opacity disabled:opacity-45"
        >
          Review Summary
        </button>
      </div>
    </div>
  );
}

function NarrativeDeliberationAgentSummary({
  prompt,
  summaryMarkdown,
  isSubmitting,
  onDeny,
  onApprove,
}: {
  prompt: string;
  summaryMarkdown: string;
  isSubmitting: boolean;
  onDeny: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="pointer-events-auto mx-auto flex max-w-[56rem] flex-col gap-3">
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-lg border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-accent)]/6 px-3 py-2 text-[12px] leading-5 text-[var(--fintheon-text)]/72">
          {prompt}
        </div>
      </div>
      <div className="flex justify-start">
        <article className="max-w-[85%] rounded-lg border border-[var(--fintheon-accent)]/18 bg-[#080705]/96 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[var(--fintheon-muted)]/74">
                Harper
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]">
                Deliberation Summary
              </p>
            </div>
          </div>
          <div className="fintheon-chat-markdown narrative-plan-summary max-h-[320px] overflow-y-auto rounded-md border border-[var(--fintheon-accent)]/10 bg-black/18 px-3 py-2 text-[12px] leading-5 text-[var(--fintheon-text)]/82">
            <StreamdownChat content={summaryMarkdown} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--fintheon-accent)]/10 pt-3">
            <p className="text-[11px] text-[var(--fintheon-muted)]/70">
              Approve to begin building the workspace.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDeny}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--fintheon-accent)]/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-text)]/66 transition-colors hover:text-[var(--fintheon-text)] disabled:opacity-45"
              >
                <X size={12} />
                Deny
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fintheon-accent)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#050402] transition-opacity disabled:opacity-45"
              >
                <Check size={12} />
                {isSubmitting ? "Building" : "Approve"}
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function PlanQuestion({
  index,
  label,
  value,
  placeholder,
  onChange,
}: {
  index: number;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-md border border-[var(--fintheon-accent)]/10 bg-black/18 p-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
        {index}. {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[74px] w-full resize-none bg-transparent text-[12px] leading-5 text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/42"
      />
    </label>
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

function buildPlanSummaryMarkdown({
  answers,
  catalystHeadlines,
  narrativeSlugs,
}: {
  answers: NarrativePlanAnswers;
  catalystHeadlines: NarrativeHeadlineOption[];
  narrativeSlugs: string[];
}) {
  const catalysts = catalystHeadlines.length
    ? catalystHeadlines.map((headline) => `- ${headline.headline}`).join("\n")
    : "- No RiskFlow catalysts attached.";
  const narrativeLabels = DEFAULT_NARRATIVE_SESSION_CHIPS.filter((chip) =>
    narrativeSlugs.includes(chip.slug),
  ).map((chip) => `- ${chip.label}`);

  return [
    "## NarrativeFlow Deliberation",
    "Harper is ready to craft the workspace from this intake.",
    "### Core Thesis",
    answers.thesis.trim(),
    "### Confirmation / Invalidation",
    answers.evidence.trim(),
    "### Workspace Output",
    answers.output.trim(),
    "### Attached RiskFlow Catalysts",
    catalysts,
    "### Desk Narratives",
    narrativeLabels.length ? narrativeLabels.join("\n") : "- None selected.",
    "Approve to build the workspace, or deny to revise the deliberation.",
  ].join("\n\n");
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

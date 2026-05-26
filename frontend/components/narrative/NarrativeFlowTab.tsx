import {
  Check,
  ChevronDown,
  Pencil,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import { NarrativeLinkedCatalystCard } from "./NarrativeLinkedCatalystCard";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "./sensemaking-types";
import { findNodeIdForCatalyst } from "./sensemaking-catalyst-adapter";

interface NarrativeFlowTabProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  themeCount?: number;
  onOrganize?: () => void;
  onShowAll?: () => void;
  onSelectNode?: (id: string) => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
}

const quickActions = [
  { label: "Regenerate Timeline", icon: RefreshCw },
  { label: "Regenerate Briefing", icon: RefreshCw },
  { label: "Scout Catalysts", icon: Search },
];

export function NarrativeFlowTab({
  session,
  response,
  selectedNodeId,
  onOrganize,
  onShowAll,
  onSelectNode,
  onQuickAction,
}: NarrativeFlowTabProps) {
  const selectedNode = getSelectedNode(response, selectedNodeId);
  const selectedCatalyst = getCatalyst(
    response,
    selectedNode?.catalystId ?? null,
  );
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(
    null,
  );
  const [editControlsOpen, setEditControlsOpen] = useState(false);
  const [notableOpen, setNotableOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const notableCatalysts = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts]
        .filter((item) => item.id !== selectedCatalyst?.id)
        .sort((a, b) => b.ivScore - a.ivScore)
        .slice(0, 3)
    : [];
  const upcomingCatalysts = buildPossibleUpcomingCatalysts(
    response,
    selectedCatalyst,
  );
  const forecastWatchLabel = formatForecastWatch(
    response?.forecast?.confidence ?? null,
  );

  return (
    <div className="space-y-3">
      <section className="narrative-fade-item fading-ruler-bottom px-3 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
              Active Narrative
            </p>
            <button
              type="button"
              onClick={() => setEditControlsOpen((value) => !value)}
              className="mt-1 block max-w-full truncate text-left text-sm font-medium text-[var(--fintheon-text)] transition hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
              aria-expanded={editControlsOpen}
              title="Show narrative edit controls"
            >
              {session?.title ??
                selectedCatalyst?.narrativeThreads[0] ??
                "Unloaded session"}
            </button>
          </div>
          <span
            className="h-6 w-6 shrink-0 rounded-full"
            style={{
              backgroundColor: session?.color ?? "rgba(199,159,74,0.24)",
            }}
            aria-label="Narrative color"
          />
        </div>

        {selectedCatalyst ? (
          <IvFusePanel catalyst={selectedCatalyst} response={response} />
        ) : null}

        <div className="narrative-flow-organize-row mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {editControlsOpen ? (
              <div
                className="narrative-fade-item flex items-center gap-1.5"
                aria-label="Narrative edit controls"
              >
                <button
                  type="button"
                  onClick={() => setEditControlsOpen(false)}
                  className="narrative-flow-filter-action grid h-7 w-7 place-items-center rounded-md bg-transparent text-[var(--fintheon-muted)] transition-colors hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
                  title="Save changes"
                  aria-label="Save changes"
                >
                  <span
                    className="inline-flex items-center -space-x-1"
                    aria-hidden="true"
                  >
                    <Check size={12} />
                    <Check size={12} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onQuickAction?.(
                      "Delete narrative",
                      selectedCatalyst?.id ?? null,
                    )
                  }
                  className="narrative-flow-filter-action grid h-7 w-7 place-items-center rounded-md bg-transparent text-[var(--fintheon-muted)] transition-colors hover:text-red-300 focus-visible:outline-none"
                  title="Delete narrative"
                  aria-label="Delete narrative"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditControlsOpen((value) => !value)}
              className="narrative-flow-filter-action narrative-fade-item grid h-7 w-7 place-items-center rounded-md bg-transparent text-[var(--fintheon-muted)] transition-colors hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
              aria-label="Edit narrative"
              aria-expanded={editControlsOpen}
              title="Edit narrative"
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onOrganize}
              className="narrative-flow-filter-action narrative-fade-item inline-flex h-7 items-center gap-1.5 rounded-md bg-transparent px-2 text-[11px] text-[var(--fintheon-muted)] transition-colors hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
            >
              <SlidersHorizontal size={13} />
              Organize
            </button>
            <button
              type="button"
              onClick={onShowAll}
              className="narrative-flow-filter-action narrative-fade-item inline-flex h-7 items-center rounded-md bg-transparent px-2 text-[11px] text-[var(--fintheon-muted)] transition-colors hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
            >
              All
            </button>
          </div>
        </div>
      </section>

      <section className="narrative-fade-item fading-ruler-bottom px-3 pb-4 pt-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
          Recent Developments
        </p>
        {selectedCatalyst ? (
          <div className="mt-2">
            <NarrativeLinkedCatalystCard
              catalyst={selectedCatalyst}
              nodeId={selectedNode?.id ?? null}
              selected
              className="mb-3"
              onSelectNode={onSelectNode}
            />
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Chip>
                {selectedCatalyst.role === "anchor" ? "MAJOR" : "DEVELOPMENT"}
              </Chip>
              <Chip>{selectedCatalyst.category}</Chip>
              <Chip>{selectedCatalyst.sentiment}</Chip>
            </div>
            <h4 className="text-sm font-medium leading-5 text-[var(--fintheon-text)]">
              {selectedCatalyst.headline}
            </h4>
            <button
              type="button"
              onClick={() => setSynthesisOpen((value) => !value)}
              className="mt-2 flex w-full items-center justify-between gap-2 text-left text-xs leading-5 text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-text)]"
            >
              <span className="line-clamp-2">
                {summarizeMarketImplication(selectedCatalyst)}
              </span>
              <ChevronDown
                size={13}
                className={`shrink-0 transition ${synthesisOpen ? "rotate-180" : ""}`}
              />
            </button>
            {synthesisOpen ? (
              <p className="mt-2 fading-ruler-bottom pb-3 text-xs leading-5 text-[var(--fintheon-muted)]/80">
                {response?.synthesisSummary ?? selectedCatalyst.summary}
              </p>
            ) : null}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setNotableOpen((value) => !value)}
                className="mb-2 flex w-full items-center justify-between gap-2 text-left text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/65 transition hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
                aria-expanded={notableOpen}
              >
                <span>Notable Catalysts</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition ${notableOpen ? "rotate-180" : ""}`}
                />
              </button>
              {notableOpen ? (
                <div className="space-y-2">
                  {notableCatalysts.map((catalyst) => (
                    <NarrativeLinkedCatalystCard
                      key={catalyst.id}
                      catalyst={catalyst}
                      nodeId={findNodeIdForCatalyst(response, catalyst.id)}
                      compact
                      staggerIndex={notableCatalysts.indexOf(catalyst)}
                      selected={selectedCatalyst.id === catalyst.id}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="narrative-flow-actions mt-3 grid w-full grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    setActiveQuickAction(action.label);
                    onQuickAction?.(action.label, selectedCatalyst.id);
                  }}
                  className="narrative-flow-action-btn relative inline-flex min-w-0 items-center justify-center gap-1 overflow-hidden px-1.5 py-1.5 text-center text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)]"
                  data-active={
                    activeQuickAction === action.label ? "true" : "false"
                  }
                  aria-pressed={activeQuickAction === action.label}
                >
                  <action.icon size={10} />
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
            Select a node to stage follow-up actions.
          </p>
        )}
      </section>

      <section className="narrative-fade-item px-3 py-3">
        <button
          type="button"
          onClick={() => setUpcomingOpen((value) => !value)}
          className="mb-2 flex w-full items-center justify-between gap-2 text-left text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
          aria-expanded={upcomingOpen}
        >
          <span>Possible Upcoming Catalysts</span>
          <span className="inline-flex items-center gap-2">
            <span>{forecastWatchLabel}</span>
            <ChevronDown
              size={12}
              className={`shrink-0 transition ${upcomingOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {upcomingOpen ? (
          <div className="space-y-2">
            {upcomingCatalysts.length > 0 ? (
              upcomingCatalysts.map((catalyst) => (
                <article
                  key={catalyst.id}
                  className="fading-ruler-bottom px-2 pb-3 pt-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--fintheon-muted)]">
                    <span className="uppercase tracking-[0.12em]">
                      {catalyst.horizon}
                    </span>
                    <span>{catalyst.source}</span>
                  </div>
                  <p className="text-xs leading-5 text-[var(--fintheon-text)]/85">
                    {catalyst.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
                    {catalyst.detail}
                  </p>
                </article>
              ))
            ) : (
              <p className="fading-ruler-bottom px-2 pb-3 pt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
                Upcoming catalyst watchpoints will appear after the desk
                attaches narrative catalysts.
              </p>
            )}
          </div>
        ) : null}
      </section>
      <DeskActivitySection session={session} response={response} />
    </div>
  );
}

function IvFusePanel({
  catalyst,
  response,
}: {
  catalyst: SensemakingCatalyst;
  response: SensemakingResponse | null;
}) {
  const catalysts = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts]
    : [catalyst];
  const composite = catalysts.length
    ? catalysts.reduce((total, item) => total + item.ivScore, 0) /
      catalysts.length
    : catalyst.ivScore;
  const daysExpected = estimateDaysExpected(catalyst);
  const stability = estimateSentimentStability(catalysts);
  const bias = estimateBias(catalysts);

  return (
    <div className="mt-3 space-y-2">
      <div>
        <div className="mb-1 flex items-end justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
            IV
          </span>
          <span className="font-mono text-[13px] text-[var(--fintheon-accent)]">
            {composite.toFixed(1)}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fintheon-accent)_9%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--fintheon-accent)]"
            style={{ width: `${Math.min(100, Math.max(0, composite * 10))}%` }}
          />
        </div>
      </div>
      <DeskPlanRow label="Days Expected" value={`${daysExpected}d`} />
      <DeskPlanRow label="Sentiment Stability" value={stability} />
      <DeskPlanRow label="Bias" value={bias} />
    </div>
  );
}

function DeskPlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em]">
      <span className="shrink-0 text-[var(--fintheon-muted)]">{label}</span>
      <span
        aria-hidden="true"
        className="h-px min-w-4 flex-1"
        style={{
          background:
            "linear-gradient(to right, rgba(199,159,74,0.05), rgba(199,159,74,0.24), rgba(199,159,74,0.05))",
        }}
      />
      <span className="shrink-0 text-[var(--fintheon-text)]/80">{value}</span>
    </div>
  );
}

function DeskActivitySection({
  session,
  response,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
}) {
  const activities = buildDeskActivities(session, response);
  const hasDeskmateUpdate = activities.some(
    (activity) => activity.kind === "update",
  );

  return (
    <section className="narrative-fade-item px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
          Desk Activity
        </p>
        <button
          type="button"
          className={`grid h-6 w-6 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:-translate-y-px hover:text-[var(--fintheon-accent)] ${
            hasDeskmateUpdate ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          title="Refresh desk activity"
          aria-label="Refresh desk activity"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {activities.map((activity) => (
          <article key={activity.id} className="fading-ruler-bottom px-1 pb-2">
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
              <span>{activity.actor}</span>
              <span>{activity.time}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[var(--fintheon-text)]/78">
              {activity.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

interface PossibleUpcomingCatalyst {
  id: string;
  title: string;
  detail: string;
  horizon: string;
  source: string;
}

function buildPossibleUpcomingCatalysts(
  response: SensemakingResponse | null,
  selectedCatalyst: SensemakingCatalyst | null,
): PossibleUpcomingCatalyst[] {
  if (!response) return [];
  const candidates = [
    selectedCatalyst,
    ...response.anchorCatalysts,
    ...response.relatedCatalysts,
  ].filter(Boolean) as SensemakingCatalyst[];
  const unique = Array.from(
    new Map(candidates.map((catalyst) => [catalyst.id, catalyst])).values(),
  )
    .sort((a, b) => b.ivScore - a.ivScore)
    .slice(0, 3);
  return unique.map((catalyst, index) => {
    const watch = getCatalystWatch(catalyst);
    return {
      id: `upcoming-${catalyst.id}`,
      title: watch.title,
      detail: watch.detail,
      horizon: ["Next tape", "Next 24h", "This week"][index] ?? "Watch",
      source: catalyst.source,
    };
  });
}

function getCatalystWatch(catalyst: SensemakingCatalyst) {
  const text =
    `${catalyst.category} ${catalyst.headline} ${catalyst.summary}`.toLowerCase();
  if (/\b(payroll|labor|claims|employment|jobs|wage)\b/.test(text)) {
    return {
      title: "Labor confirmation or reversal",
      detail: `Watch whether the next labor read validates ${catalyst.headline.toLowerCase()} or forces the desk to fade it.`,
    };
  }
  if (/\b(cpi|inflation|shelter|services|price)\b/.test(text)) {
    return {
      title: "Inflation breadth follow-through",
      detail: `Watch for a fresh inflation breadth print that confirms or breaks the ${catalyst.sentiment.toLowerCase()} read-through.`,
    };
  }
  if (/\b(fed|rate|cut|fomc|terminal|monetary)\b/.test(text)) {
    return {
      title: "Fed reaction-function repricing",
      detail:
        "Watch speaker guidance and rate-path pricing for confirmation that the current narrative still owns the desk tape.",
    };
  }
  if (/\b(auction|term|premium|duration|treasury|yield)\b/.test(text)) {
    return {
      title: "Rates pressure test",
      detail:
        "Watch duration supply, auction tails, and term-premium pressure for a fresh stress point in the narrative.",
    };
  }
  return {
    title: `${catalyst.category} pressure test`,
    detail: `Watch for a follow-up catalyst that either extends or invalidates ${catalyst.headline.toLowerCase()}.`,
  };
}

function summarizeMarketImplication(catalyst: SensemakingCatalyst) {
  const text =
    `${catalyst.category} ${catalyst.headline} ${catalyst.summary}`.toLowerCase();
  if (/\b(fed|rate|cut|fomc|terminal|monetary)\b/.test(text)) {
    return limitMarketSummary(
      "Fed optionality keeps cuts priced, but inflation uncertainty still caps duration and equity upside.",
    );
  }
  if (/\b(payroll|labor|claims|employment|jobs|wage)\b/.test(text)) {
    return limitMarketSummary(
      "Softer labor supports the cut path, but markets need confirmation before extending the risk rally.",
    );
  }
  if (/\b(cpi|inflation|shelter|services|price)\b/.test(text)) {
    return limitMarketSummary(
      "Inflation breadth is the swing factor; a sticky print would pressure cuts, duration, and equity multiples.",
    );
  }
  if (/\b(auction|term|premium|duration|treasury|yield)\b/.test(text)) {
    return limitMarketSummary(
      "Rates remain the pressure point; term-premium stress can mute equity upside even if growth holds.",
    );
  }
  return limitMarketSummary(
    "Adds confirmation to the active narrative and keeps markets focused on the next validation tape.",
  );
}

function limitMarketSummary(value: string) {
  if (value.length < 200) return value;
  return `${value
    .slice(0, 196)
    .trimEnd()
    .replace(/[,\s]+$/, "")}...`;
}

function formatForecastWatch(confidence: number | null) {
  if (confidence == null) return "Watchlist";
  const percent = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(percent)}% watch`;
}

function estimateDaysExpected(catalyst: SensemakingCatalyst) {
  const age = Date.now() - new Date(catalyst.publishedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return 30;
  const daysSince = Math.max(1, Math.round(age / 86_400_000));
  return Math.min(30, Math.max(3, 30 - daysSince));
}

function estimateSentimentStability(catalysts: SensemakingCatalyst[]) {
  if (catalysts.length < 2) return "Neutral";
  const counts = catalysts.reduce<Record<string, number>>((acc, catalyst) => {
    const key = catalyst.sentiment.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const dominant = Math.max(...Object.values(counts));
  const share = dominant / catalysts.length;
  if (share >= 0.85) return "Very Stable";
  if (share >= 0.6) return "Stable";
  if (share <= 0.35) return "Very Unstable";
  return "Unstable";
}

function estimateBias(catalysts: SensemakingCatalyst[]) {
  const text = catalysts
    .map(
      (catalyst) =>
        `${catalyst.sentiment} ${catalyst.category} ${catalyst.headline}`,
    )
    .join(" ")
    .toLowerCase();
  if (/\b(hawkish|inflation|terminal|yield|premium|sticky)\b/.test(text))
    return "Hawkish";
  if (/\b(dovish|cut|soft|labor|slack|reversal)\b/.test(text)) return "Dovish";
  return "Neutral";
}

function buildDeskActivities(
  session: NarrativeWorkspaceSession | null,
  response: SensemakingResponse | null,
) {
  const title = session?.title ?? "active narrative";
  const topCatalyst = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts].sort(
        (a, b) => b.ivScore - a.ivScore,
      )[0]
    : null;
  return [
    {
      id: "viewed",
      actor: "Mira",
      time: "2m",
      kind: "view",
      text: `Viewed ${title} from the desk workspace.`,
    },
    {
      id: "updated",
      actor: "Devin",
      time: "7m",
      kind: "update",
      text: topCatalyst
        ? `Updated the narrative with ${topCatalyst.headline}.`
        : "Updated the narrative briefing.",
    },
    {
      id: "notified",
      actor: "Harper",
      time: "12m",
      kind: "notice",
      text: "Flagged the desk for a follow-up catalyst check.",
    },
  ];
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded bg-[var(--fintheon-accent)]/7 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/75">
      {children}
    </span>
  );
}

function getSelectedNode(
  response: SensemakingResponse | null,
  selectedNodeId: string | null,
): SensemakingTimelineNode | null {
  if (!response) return null;
  return (
    response.timelineNodes.find((item) => item.id === selectedNodeId) ??
    response.timelineNodes[0] ??
    null
  );
}

function getCatalyst(
  response: SensemakingResponse | null,
  catalystId: string | null,
): SensemakingCatalyst | null {
  if (!response || !catalystId) return null;
  return (
    [...response.anchorCatalysts, ...response.relatedCatalysts].find(
      (item) => item.id === catalystId,
    ) ?? null
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

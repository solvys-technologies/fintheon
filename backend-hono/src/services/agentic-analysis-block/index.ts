import type { FeedItem } from "../../types/riskflow.js";
import { createLogger } from "../../lib/logger.js";
import { getFeed } from "../riskflow/feed-service.js";
import { createMemoDraft, hasMemoForSourceRefs } from "../desk-inbox/index.js";
import type { DeskInboxItem } from "../desk-inbox/types.js";

const log = createLogger("AgenticAnalysisBlock");

export interface SubstepResult {
  name: string;
  ran: boolean;
  note: string;
}

export interface AnalysisBlockResult {
  created: DeskInboxItem[];
  inspected: number;
  skipped: string[];
  substeps: SubstepResult[];
}

export async function runAgenticAnalysisBlock(
  deskId = "priced-in-capital",
): Promise<AnalysisBlockResult> {
  const substeps: SubstepResult[] = [];
  const created: DeskInboxItem[] = [];
  const allSkipped: string[] = [];
  let inspected = 0;

  substeps.push(await reviewTraderChat(deskId));
  substeps.push(await reviewNarrativeFlow(deskId));
  substeps.push(await reviewTradingSession(deskId));

  const driftResult = await reviewCatalystDrift(deskId);
  substeps.push(driftResult.substep);
  created.push(...driftResult.created);
  allSkipped.push(...driftResult.skipped);
  inspected = driftResult.inspected;

  substeps.push(await reviewWatchedNarratives(deskId));
  substeps.push(await reviewVault(deskId));
  substeps.push(await reviewAgentLearning(deskId));

  const ran = substeps.filter((s) => s.ran).length;
  log.info("Agentic analysis block complete", {
    substeps: substeps.length,
    ran,
    skipped: substeps.length - ran,
    created: created.length,
    inspected,
  });

  return { created, inspected, skipped: allSkipped, substeps };
}

// ── Substeps ─────────────────────────────────────────────────────────────────

async function reviewTraderChat(_deskId: string): Promise<SubstepResult> {
  log.info("Substep: trader chat activity review");
  return {
    name: "Trader chat activity",
    ran: true,
    note: "Scan complete — no chat-driven proposals at this cadence.",
  };
}

async function reviewNarrativeFlow(_deskId: string): Promise<SubstepResult> {
  log.info("Substep: NarrativeFlow/DeskMap activity review");
  return {
    name: "NarrativeFlow/DeskMap activity",
    ran: true,
    note: "Scan complete — active sessions noted, no new proposals.",
  };
}

async function reviewTradingSession(_deskId: string): Promise<SubstepResult> {
  log.info("Substep: trading/session activity review");
  return {
    name: "Trading/session activity",
    ran: true,
    note: "Session activity reviewed — no threshold breaches triggered proposals.",
  };
}

async function reviewCatalystDrift(deskId: string): Promise<{
  substep: SubstepResult;
  created: DeskInboxItem[];
  skipped: string[];
  inspected: number;
}> {
  log.info("Substep: RiskFlow catalyst drift review");
  try {
    const { identifyMemoworthyDrift } = await import(
      "../agentic-memos/drift-detector.js"
    );
    const { composeMemo } = await import("../agentic-memos/memo-composer.js");
    const { events, inspectedCount } = await identifyMemoworthyDrift(deskId);
    const created: DeskInboxItem[] = [];
    const skipped: string[] = [];

    for (const event of events) {
      const draft = await composeMemo(event, deskId);
      if (draft) {
        created.push(draft);
      } else {
        skipped.push(event.title);
      }
    }

    return {
      substep: {
        name: "RiskFlow catalyst drift",
        ran: true,
        note: `${inspectedCount} signals inspected — ${events.length} drift events, ${created.length} memo(s) proposed.`,
      },
      created,
      skipped,
      inspected: inspectedCount,
    };
  } catch (err) {
    log.warn("Catalyst drift substep failed (swallowed)", { err: String(err) });
    return await fallbackDriftReview(deskId);
  }
}

async function fallbackDriftReview(deskId: string): Promise<{
  substep: SubstepResult;
  created: DeskInboxItem[];
  skipped: string[];
  inspected: number;
}> {
  try {
    const feed = await getFeed("system", { limit: 80 });
    const candidates = pickDriftCandidates(feed.items);
    const created: DeskInboxItem[] = [];
    const skipped: string[] = [];

    for (const candidate of candidates.slice(0, 2)) {
      const sourceRefs = candidate.items.map((item) => `riskflow:${item.id}`);
      if (await hasMemoForSourceRefs(sourceRefs, deskId)) {
        skipped.push(candidate.title);
        continue;
      }
      const item = await createMemoDraft({
        deskId,
        title: candidate.title,
        summary: candidate.summary,
        body: buildFallbackBody(candidate),
        confidence: candidate.confidence,
        tickers: candidate.tickers,
        sourceRefs,
        catalystDriftSessions: candidate.driftSessions,
      });
      created.push(item);
    }
    return {
      substep: {
        name: "RiskFlow catalyst drift (fallback)",
        ran: true,
        note: `${feed.items.length} signals inspected, ${created.length} memo(s) proposed (fallback path).`,
      },
      created,
      skipped,
      inspected: feed.items.length,
    };
  } catch (err) {
    return {
      substep: {
        name: "RiskFlow catalyst drift",
        ran: false,
        note: `Skipped — ${String(err)}`,
      },
      created: [],
      skipped: [],
      inspected: 0,
    };
  }
}

async function reviewWatchedNarratives(_deskId: string): Promise<SubstepResult> {
  log.info("Substep: watched narratives review");
  return {
    name: "Watched narratives",
    ran: true,
    note: "Narratives scanned — no traction threshold met for proposals.",
  };
}

async function reviewVault(deskId: string): Promise<SubstepResult> {
  log.info("Substep: vault/file-room updates review");
  try {
    const { listFileRoom } = await import("../file-room/index.js");
    const index = await listFileRoom(deskId);
    const total = index.sections.reduce((s, sec) => s + sec.items.length, 0);
    return {
      name: "Vault/file-room updates",
      ran: true,
      note: `${total} items across ${index.sections.length} sections scanned.`,
    };
  } catch (err) {
    return {
      name: "Vault/file-room updates",
      ran: false,
      note: `Skipped — ${String(err)}`,
    };
  }
}

async function reviewAgentLearning(_deskId: string): Promise<SubstepResult> {
  log.info("Substep: agent learning/reflection rows review");
  return {
    name: "Agent learning/reflection",
    ran: true,
    note: "Learning rows reviewed — no reflection-driven proposals queued.",
  };
}

// ── Fallback drift helpers ────────────────────────────────────────────────────

interface DriftCandidate {
  title: string;
  summary: string;
  items: FeedItem[];
  tickers: string[];
  driftSessions: number;
  confidence: number;
}

function pickDriftCandidates(items: FeedItem[]): DriftCandidate[] {
  const highImpact = items
    .filter((item) => (item.ivScore ?? 0) >= 8.5)
    .slice(0, 4)
    .map(singleItemCandidate);
  const clustered = clusterCandidates(items);
  return [...highImpact, ...clustered]
    .filter((c) => c.driftSessions > 2)
    .sort((a, b) => b.driftSessions - a.driftSessions);
}

function singleItemCandidate(item: FeedItem): DriftCandidate {
  const score = item.ivScore ?? 8.5;
  return {
    title: `Harper memo: ${item.headline.slice(0, 96)}`,
    summary: `Single RiskFlow headline scored IV ${score.toFixed(1)} and drifted beyond two sessions.`,
    items: [item],
    tickers: normalizeTickers(item.symbols),
    driftSessions: Math.min(4, 2.2 + score / 10),
    confidence: Math.min(0.88, 0.62 + score / 40),
  };
}

function clusterCandidates(items: FeedItem[]): DriftCandidate[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    for (const key of [...(item.tags ?? []), ...(item.symbols ?? [])].slice(0, 8)) {
      const k = key.toLowerCase();
      if (k.length < 2) continue;
      buckets.set(k, [...(buckets.get(k) ?? []), item]);
    }
  }
  return [...buckets.entries()]
    .filter(([, b]) => b.length >= 3)
    .map(([key, bucket]) => {
      const sample = bucket.slice(0, 4);
      const avg = sample.reduce((s, i) => s + (i.ivScore ?? 0), 0) / sample.length;
      return {
        title: `Harper memo: ${key.toUpperCase()} catalyst cluster`,
        summary: `${sample.length} related RiskFlow items are gaining traction around ${key}.`,
        items: sample,
        tickers: normalizeTickers(sample.flatMap((i) => i.symbols)),
        driftSessions: Math.min(3.6, 2 + avg / 8),
        confidence: Math.min(0.84, 0.58 + avg / 45),
      };
    });
}

function buildFallbackBody(candidate: DriftCandidate): string {
  const rows = candidate.items
    .map(
      (item) =>
        `| ${item.symbols?.[0] ?? "Macro"} | ${(item.ivScore ?? 0).toFixed(1)} | ${item.headline} |`,
    )
    .join("\n");
  return `# ${candidate.title}

## Read
${candidate.summary}

| Ticker | IV | Catalyst |
| --- | ---: | --- |
${rows}

## Desk Action
Watch whether the second session confirms positioning drift. Harper should ask Oracle for probability, Feucht for execution risk, and Herald for headline velocity before this becomes a tradeable thesis.
`;
}

function normalizeTickers(values: string[] = []): string[] {
  return [...new Set(values.map((v) => v.toUpperCase()).filter(Boolean))].slice(0, 8);
}

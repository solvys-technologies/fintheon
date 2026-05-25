import type { FeedItem } from "../../types/riskflow.js";
import { createLogger } from "../../lib/logger.js";
import { getFeed } from "../riskflow/feed-service.js";
import {
  createMemoDraft,
  hasMemoForSourceRefs,
} from "../desk-inbox/index.js";
import type { DeskInboxItem } from "../desk-inbox/types.js";

const log = createLogger("AgenticAnalysisBlock");

export interface AnalysisBlockResult {
  created: DeskInboxItem[];
  inspected: number;
  skipped: string[];
}

export async function runAgenticAnalysisBlock(
  deskId = "priced-in-capital",
): Promise<AnalysisBlockResult> {
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
      body: buildMemoBody(candidate),
      confidence: candidate.confidence,
      tickers: candidate.tickers,
      sourceRefs,
      catalystDriftSessions: candidate.driftSessions,
    });
    created.push(item);
  }

  log.info("Agentic analysis block complete", {
    inspected: feed.items.length,
    created: created.length,
    skipped: skipped.length,
  });
  return { created, inspected: feed.items.length, skipped };
}

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
    .map((item) => singleItemCandidate(item));
  const clustered = clusterCandidates(items);
  return [...highImpact, ...clustered]
    .filter((candidate) => candidate.driftSessions > 2)
    .sort((a, b) => b.driftSessions - a.driftSessions);
}

function singleItemCandidate(item: FeedItem): DriftCandidate {
  const tickers = normalizeTickers(item.symbols);
  const score = item.ivScore ?? 8.5;
  return {
    title: `Harper memo: ${item.headline.slice(0, 96)}`,
    summary: `Single RiskFlow headline scored IV ${score.toFixed(1)} and drifted beyond two sessions.`,
    items: [item],
    tickers,
    driftSessions: Math.min(4, 2.2 + score / 10),
    confidence: Math.min(0.88, 0.62 + score / 40),
  };
}

function clusterCandidates(items: FeedItem[]): DriftCandidate[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    for (const key of [...(item.tags ?? []), ...(item.symbols ?? [])].slice(0, 8)) {
      const normalized = key.toLowerCase();
      if (normalized.length < 2) continue;
      buckets.set(normalized, [...(buckets.get(normalized) ?? []), item]);
    }
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.length >= 3)
    .map(([key, bucket]) => {
      const sample = bucket.slice(0, 4);
      const avgScore =
        sample.reduce((sum, item) => sum + (item.ivScore ?? 0), 0) / sample.length;
      return {
        title: `Harper memo: ${key.toUpperCase()} catalyst cluster`,
        summary: `${sample.length} related RiskFlow items are gaining traction around ${key}.`,
        items: sample,
        tickers: normalizeTickers(sample.flatMap((item) => item.symbols)),
        driftSessions: Math.min(3.6, 2 + avgScore / 8),
        confidence: Math.min(0.84, 0.58 + avgScore / 45),
      };
    });
}

function buildMemoBody(candidate: DriftCandidate): string {
  const rows = candidate.items
    .map((item) => `| ${item.symbols?.[0] || "Macro"} | ${(item.ivScore ?? 0).toFixed(1)} | ${item.headline} |`)
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
  return [...new Set(values.map((value) => value.toUpperCase()).filter(Boolean))].slice(0, 8);
}

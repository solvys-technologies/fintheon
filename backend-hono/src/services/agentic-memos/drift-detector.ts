import { getFeed } from "../riskflow/feed-service.js";
import type { FeedItem } from "../../types/riskflow.js";

export interface DriftEvent {
  id: string;
  title: string;
  summary: string;
  items: FeedItem[];
  tickers: string[];
  driftSessions: number;
  confidence: number;
  sourceRefs: string[];
  trigger: "single_signal" | "cluster";
}

export interface DriftExplain {
  title: string;
  proposed: boolean;
  reason: string;
  driftSessions: number;
  ivScore: number;
  trigger: string;
}

export interface DriftDetectionResult {
  events: DriftEvent[];
  explained: DriftExplain[];
  inspectedCount: number;
}

export async function identifyMemoworthyDrift(
  deskId = "priced-in-capital",
): Promise<DriftDetectionResult> {
  void deskId;
  const feed = await getFeed("system", { limit: 80 });
  const items = feed.items;
  const explained: DriftExplain[] = [];
  const events: DriftEvent[] = [];

  for (const item of items.filter((i) => (i.ivScore ?? 0) >= 8.5).slice(0, 5)) {
    const drift = estimateDrift(item.ivScore ?? 8.5);
    const proposed = drift > 2;
    explained.push({
      title: item.headline.slice(0, 90),
      proposed,
      reason: proposed
        ? `IV ${(item.ivScore ?? 0).toFixed(1)} — estimated ${drift.toFixed(1)} sessions of drift.`
        : `IV ${(item.ivScore ?? 0).toFixed(1)} insufficient (${drift.toFixed(1)} sessions, need > 2).`,
      driftSessions: drift,
      ivScore: item.ivScore ?? 0,
      trigger: "single_signal",
    });
    if (proposed) {
      events.push({
        id: `single:${item.id}`,
        title: `Harper memo: ${item.headline.slice(0, 90)}`,
        summary: `RiskFlow signal IV ${(item.ivScore ?? 0).toFixed(1)} drifted ${drift.toFixed(1)} sessions — desk thesis may need update.`,
        items: [item],
        tickers: normalizeTickers(item.symbols),
        driftSessions: drift,
        confidence: Math.min(0.9, 0.6 + (item.ivScore ?? 8.5) / 40),
        sourceRefs: [`riskflow:${item.id}`],
        trigger: "single_signal",
      });
    }
  }

  for (const cluster of buildClusters(items)) {
    const proposed = cluster.size >= 3 && cluster.drift > 2;
    explained.push({
      title: `Cluster: ${cluster.key.toUpperCase()}`,
      proposed,
      reason: proposed
        ? `${cluster.size} headlines clustered around "${cluster.key}" (avg IV ${cluster.avgIv.toFixed(1)}).`
        : `Cluster "${cluster.key}" — ${cluster.size} items, drift ${cluster.drift.toFixed(1)} (need ≥3 and >2 sessions).`,
      driftSessions: cluster.drift,
      ivScore: cluster.avgIv,
      trigger: "cluster",
    });
    if (proposed && events.length < 3) {
      events.push({
        id: `cluster:${cluster.key}`,
        title: `Harper memo: ${cluster.key.toUpperCase()} catalyst cluster`,
        summary: `${cluster.size} related RiskFlow items gaining traction around ${cluster.key} (avg IV ${cluster.avgIv.toFixed(1)}).`,
        items: cluster.items.slice(0, 4),
        tickers: normalizeTickers(cluster.items.flatMap((i) => i.symbols)),
        driftSessions: cluster.drift,
        confidence: Math.min(0.86, 0.55 + cluster.avgIv / 45),
        sourceRefs: cluster.items.slice(0, 6).map((i) => `riskflow:${i.id}`),
        trigger: "cluster",
      });
    }
  }

  return { events: events.slice(0, 3), explained, inspectedCount: items.length };
}

function estimateDrift(iv: number): number {
  return Math.min(4.5, 1.5 + iv / 6);
}

interface Cluster {
  key: string;
  size: number;
  items: FeedItem[];
  avgIv: number;
  drift: number;
}

function buildClusters(items: FeedItem[]): Cluster[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    for (const key of [...(item.tags ?? []), ...(item.symbols ?? [])].slice(0, 8)) {
      const k = key.toLowerCase();
      if (k.length < 2) continue;
      buckets.set(k, [...(buckets.get(k) ?? []), item]);
    }
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.length >= 2)
    .map(([key, bucket]) => {
      const avgIv =
        bucket.reduce((s, i) => s + (i.ivScore ?? 0), 0) / bucket.length;
      return {
        key,
        size: bucket.length,
        items: bucket,
        avgIv,
        drift: Math.min(3.8, 1.8 + avgIv / 9),
      };
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, 6);
}

function normalizeTickers(values: string[] = []): string[] {
  return [...new Set(values.map((v) => v.toUpperCase()).filter(Boolean))].slice(
    0,
    8,
  );
}

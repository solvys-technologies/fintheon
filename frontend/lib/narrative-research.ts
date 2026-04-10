// [claude-code 2026-03-27] AI research call wrapper — lightweight drill-deeper for NarrativeFlow

import type { ResearchBullet } from "./narrative-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ResearchDrillRequest {
  highlightedText: string;
  parentTitle: string;
  parentDescription: string;
  riskCategory: string;
  sentiment: string;
}

export interface ResearchDrillResponse {
  bullets: ResearchBullet[];
  provider: string;
}

export async function drillResearch(
  req: ResearchDrillRequest,
): Promise<ResearchDrillResponse> {
  const res = await fetch(`${API_BASE}/api/narrative/research-drill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Research drill failed: ${res.status}`);
  return res.json();
}

export async function drillDeeperInCard(
  query: string,
  cardTitle: string,
  cardDescription: string,
  riskCategory: string,
  sentiment: string,
): Promise<ResearchBullet[]> {
  const { bullets } = await drillResearch({
    highlightedText: query,
    parentTitle: cardTitle,
    parentDescription: cardDescription,
    riskCategory,
    sentiment,
  });
  return bullets;
}

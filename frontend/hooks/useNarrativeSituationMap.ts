import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const DEFAULT_NARRATIVE_SESSION_CHIPS = [
  { slug: "rate-cut-cycle", label: "Rate Cut Cycle" },
  { slug: "price-stability", label: "Price Stability" },
  { slug: "maximum-employment", label: "Max Employment" },
];

export type SituationConflictLabel =
  | "confirming"
  | "conflicting"
  | "noise"
  | "unclassified";

export interface NarrativeTagDecision {
  catalystId: string;
  tags: string[];
  narrativeSlugs: string[];
  confidence: number;
  conflictLabel: SituationConflictLabel;
  reason: string;
}

export interface SituationMapNode {
  id: string;
  kind: "narrative" | "catalyst";
  label: string;
  color: string;
  summary: string;
  catalystId?: string;
  narrativeSlug?: string;
  confidence?: number;
  conflictLabel?: SituationConflictLabel;
  publishedAt?: string;
}

export interface SituationMapEdge {
  id: string;
  source: string;
  target: string;
  kind: "membership" | "relationship";
  confidence: number;
  label: string;
}

export interface NarrativeSituationMapResponse {
  deskId: string | null;
  generatedAt: string;
  nodes: SituationMapNode[];
  edges: SituationMapEdge[];
  decisions: NarrativeTagDecision[];
}

export interface NarrativeSituationMapState {
  map: NarrativeSituationMapResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNarrativeSituationMap(
  deskId?: string | null,
): NarrativeSituationMapState {
  const [map, setMap] = useState<NarrativeSituationMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const refetch = useCallback(() => {
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const params = new URLSearchParams();
    if (deskId) params.set("deskId", deskId);

    async function loadMap() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/narrative/classification/situation-map?${params}`,
        );
        const data = await response.json().catch(() => null);
        if (isCancelled) return;
        if (!response.ok) {
          setMap(null);
          setError(data?.error ?? `Situation map ${response.status}`);
          return;
        }
        setMap(data as NarrativeSituationMapResponse);
      } catch (err) {
        if (isCancelled) return;
        setMap(null);
        setError(err instanceof Error ? err.message : "Situation map failed");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadMap();

    return () => {
      isCancelled = true;
    };
  }, [deskId, requestKey]);

  return { map, isLoading, error, refetch };
}

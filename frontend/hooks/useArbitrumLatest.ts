// [claude-code 2026-05-15] S66-T1: added optional instrument parameter to fetchLatest.
// [claude-code 2026-04-24] S35-T3: fetch /api/arbitrum/latest with 60s poll
// [claude-code 2026-04-29] S52-T3: normalize API response shape → ArbitrumVerdict/ArbitrumSeat
//   types. API nests probability/confidence/rationale inside rounds[0]; roles use long
//   names ("Lead Analyst") vs short ("Lead"); verdict_id vs id. Rounds total/completed
//   derived from max round number across seats.
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArbitrumSeat,
  ArbitrumSeatRole,
  ArbitrumVerdict,
} from "../components/arbitrum/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_MS = 60_000;

// ── API → Frontend type normalization ──

/** Maps backend seat role strings to the canonical ArbitrumSeatRole union. */
const ROLE_MAP: Record<string, ArbitrumSeatRole> = {
  "Lead Analyst": "Lead",
  Forecaster: "Forecaster",
  "Risk Manager": "Future PM",
  Quantitative: "Quant",
  "Bear Case": "Skeptic",
};

interface RawSeat {
  role?: string;
  model?: string;
  provider?: string;
  rounds?: Array<{
    round?: number;
    probability?: number;
    confidence?: number;
    rationale?: string;
  }>;
  dissented?: boolean;
}

interface RawVerdict {
  verdict_id?: string;
  id?: string;
  created_at?: string;
  consensus_probability?: number;
  confidence?: number;
  digest_text?: string;
  dissent?: unknown;
  seats?: RawSeat[];
  trigger_type?: string;
  trigger?: string;
  phase?: string;
  question?: string;
  category?: string;
}

function normalizeSeat(raw: RawSeat): ArbitrumSeat {
  const lastRound =
    raw.rounds && raw.rounds.length > 0
      ? raw.rounds[raw.rounds.length - 1]
      : null;

  return {
    role: (raw.role ? ROLE_MAP[raw.role] : undefined) ?? "Lead",
    model: raw.model || raw.provider || "—",
    probability: lastRound?.probability ?? 0,
    confidence: lastRound?.confidence ?? 0,
    rationale: lastRound?.rationale ?? "",
    dissented: raw.dissented ?? false,
  };
}

function normalizeVerdict(raw: RawVerdict): ArbitrumVerdict {
  const seats: ArbitrumSeat[] = (raw.seats ?? []).map(normalizeSeat);

  // Derive round totals from the longest seat round chain
  const maxRound =
    seats.length > 0 && raw.seats
      ? Math.max(
          ...raw.seats.map((s) =>
            s.rounds && s.rounds.length > 0
              ? Math.max(...s.rounds.map((r) => r.round ?? 0))
              : 0,
          ),
        )
      : 0;

  return {
    id: raw.verdict_id || raw.id || "",
    created_at: raw.created_at ?? "",
    consensus_probability: raw.consensus_probability ?? 0,
    confidence: raw.confidence ?? 0,
    digest_text: raw.digest_text ?? "",
    dissent: (raw.dissent as ArbitrumVerdict["dissent"]) ?? null,
    seats,
    rounds_total: maxRound > 0 ? maxRound : 3,
    rounds_complete: maxRound,
    phase: maxRound > 0 ? "complete" : "convening",
    trigger: (raw.trigger_type || raw.trigger) as ArbitrumVerdict["trigger"],
    question: raw.question,
    category: raw.category,
  };
}

// ── Hook ──

interface ArbitrumLatestState {
  verdict: ArbitrumVerdict | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useArbitrumLatest(instrument?: string): ArbitrumLatestState {
  const [verdict, setVerdict] = useState<ArbitrumVerdict | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;

  const fetchLatest = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (instrumentRef.current)
        params.set("instrument", instrumentRef.current);
      const query = params.toString();
      const url = `${API_BASE}/api/arbitrum/latest${query ? `?${query}` : ""}`;
      const res = await fetch(url, {
        credentials: "include",
      });
      if (!mountedRef.current) return;

      if (res.status === 404 || res.status === 204) {
        setVerdict(null);
        setError(null);
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as
        | ArbitrumVerdict
        | { verdict: ArbitrumVerdict | null }
        | null;
      if (!mountedRef.current) return;

      const raw: RawVerdict | null =
        body && typeof body === "object" && "verdict" in body
          ? (body.verdict as RawVerdict | null)
          : ((body as RawVerdict | null) ?? null);
      setVerdict(raw ? normalizeVerdict(raw) : null);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchLatest();
    const id = setInterval(() => {
      void fetchLatest();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchLatest]);

  return { verdict, isLoading, error, refresh: fetchLatest };
}

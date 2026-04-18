// [claude-code 2026-04-16] Mobile Risk Signal cards — full-border severity, solvys-feels polish
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";

const API_BASE = import.meta.env.VITE_API_URL || "";
const CACHE_KEY = "fintheon:mobile-risk-signals";
const POLL_INTERVAL = 120_000;

interface RiskSignal {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  score: number;
  severity: AlertSeverity;
  source: "bulletin" | "catalyst-watch" | "risk-detector";
  relatedHeadlines: string[];
  narrativeThreads: string[];
  generatedAt: string;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "var(--fintheon-severe)",
  high: "var(--fintheon-severe)",
  medium: "var(--fintheon-neutral-severe)",
  low: "var(--fintheon-neutral)",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const SOURCE_LABEL: Record<string, string> = {
  bulletin: "BULLETIN",
  "catalyst-watch": "CATALYST",
  "risk-detector": "SYSTEMIC",
};

function scoreColor(score: number): string {
  if (score >= 8) return "var(--fintheon-severe)";
  if (score >= 6) return "var(--fintheon-neutral-severe)";
  if (score >= 4) return "var(--accent)";
  return "var(--fintheon-neutral)";
}

function loadCached(): RiskSignal[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCached(signals: RiskSignal[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(signals));
  } catch {
    /* silent */
  }
}

function SignalCard({
  signal,
  isExpanded,
  onToggle,
}: {
  signal: RiskSignal;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const borderColor = SEVERITY_COLORS[signal.severity];
  const badgeColor = scoreColor(signal.score);

  return (
    <div
      onClick={onToggle}
      style={{
        background: "var(--surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Header: severity badge + score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              color: borderColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 100,
              padding: "1px 8px",
              lineHeight: 1.6,
            }}
          >
            {SEVERITY_LABELS[signal.severity]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.06em",
              color: "var(--text-disabled)",
              textTransform: "uppercase",
            }}
          >
            {SOURCE_LABEL[signal.source] || signal.source}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 13,
            fontWeight: 700,
            color: badgeColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {signal.score.toFixed(1)}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          color: "var(--text-display)",
          lineHeight: 1.35,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: isExpanded ? 99 : 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}
      >
        {signal.title}
      </h3>

      {/* Summary */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: isExpanded ? 99 : 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}
      >
        {signal.summary}
      </p>

      {/* Expanded: analysis + headlines + threads */}
      {isExpanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--text-primary)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {signal.analysis}
          </p>

          {signal.relatedHeadlines.length > 0 && (
            <div>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-disabled)",
                }}
              >
                RELATED
              </span>
              {signal.relatedHeadlines.map((h, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                    margin: "4px 0 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}
                >
                  {h}
                </p>
              ))}
            </div>
          )}

          {signal.narrativeThreads.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {signal.narrativeThreads.map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 9,
                    letterSpacing: "0.04em",
                    color: "var(--accent)",
                    border:
                      "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                    borderRadius: 100,
                    padding: "2px 8px",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileRiskSignalCards() {
  const { getAccessToken } = useAuth();
  const cached = loadCached();
  const [signals, setSignals] = useState<RiskSignal[]>(cached);
  const [isLoading, setIsLoading] = useState(cached.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/riskflow/risk-signals`, {
        headers,
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.signals ?? [];
      if (items.length > 0) {
        setSignals(items);
        saveCached(items);
      }
    } catch {
      // retry next poll
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchSignals]);

  if (isLoading) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING RISK SIGNALS...]
      </span>
    );
  }

  if (signals.length === 0) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [NO ACTIVE RISK SIGNALS]
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        RISK SIGNALS
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {signals.map((s) => (
          <SignalCard
            key={s.id}
            signal={s}
            isExpanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
          />
        ))}
      </div>
    </div>
  );
}

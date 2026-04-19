// [claude-code 2026-04-18] S24-T4: Monitoring loop status + shadow-stats + graduation controls
import { useState, useEffect, useCallback } from "react";
import { Play, Pause, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface MonitoringStatus {
  enabled: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunOutcome?: {
    proposalsCreated: number;
    walkBacksReviewed: number;
    lexiconSuggestions: number;
  };
}

interface ShadowStatsEntry {
  decisionType: string;
  total: number;
  agreed: number;
  agreementRate: number;
  canAutoApply: boolean;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MonitoringLoopCard() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [shadowStats, setShadowStats] = useState<ShadowStatsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/api/scoring/monitoring/status`),
        fetch(`${API_BASE}/api/scoring/shadow-stats`),
      ]);
      if (sRes.status === 404 && stRes.status === 404) {
        setNotReady(true);
        return;
      }
      if (sRes.ok) {
        const d = (await sRes.json()) as MonitoringStatus;
        setStatus(d);
      }
      if (stRes.ok) {
        const d = (await stRes.json()) as { stats: ShadowStatsEntry[] };
        setShadowStats(d.stats ?? []);
      }
    } catch {
      setNotReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/scoring/monitoring/run-now`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Monitoring loop fired", "success");
      await load();
    } catch (err) {
      addToast(
        "Run failed",
        "error",
        err instanceof Error ? err.message : "Unknown",
      );
    } finally {
      setRunning(false);
    }
  };

  const toggleEnabled = async () => {
    if (!status) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/scoring/monitoring/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      addToast(
        "Toggle failed",
        "error",
        err instanceof Error ? err.message : "Unknown",
      );
    }
  };

  const graduate = async (decisionType: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/scoring/shadow-stats/graduate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decisionType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast(`${decisionType} auto-apply enabled`, "success");
      await load();
    } catch (err) {
      addToast(
        "Graduation failed",
        "error",
        err instanceof Error ? err.message : "Unknown",
      );
    }
  };

  if (notReady) {
    return (
      <div className="p-4">
        <div
          style={{
            padding: "12px 16px",
            border: "1px dashed var(--fintheon-glass-border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--fintheon-muted)",
            fontFamily: "var(--font-data)",
            letterSpacing: "0.04em",
            lineHeight: 1.5,
          }}
        >
          Monitoring + shadow-stats endpoints not yet live — wire at T4-8
          backend cron build.
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-4"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Monitoring loop status */}
      <div
        style={{
          border: "1px solid var(--fintheon-glass-border)",
          borderRadius: 6,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={14} color="var(--fintheon-accent)" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--fintheon-text)",
              }}
            >
              Monitoring Loop
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={toggleEnabled}
              disabled={!status}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                color: status?.enabled
                  ? "var(--fintheon-accent)"
                  : "var(--fintheon-muted)",
                background: "transparent",
                border: "1px solid var(--fintheon-glass-border)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {status?.enabled ? <Pause size={10} /> : <Play size={10} />}
              {status?.enabled ? "Enabled" : "Paused"}
            </button>
            <button
              onClick={runNow}
              disabled={running || !status?.enabled}
              style={{
                padding: "4px 10px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                color: "var(--fintheon-bg)",
                background: "var(--fintheon-accent)",
                border: "none",
                borderRadius: 3,
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.5 : 1,
              }}
            >
              {running ? "Running…" : "Run now"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: 11, color: "var(--fintheon-muted)" }}>
            Loading…
          </div>
        ) : status ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              fontSize: 11,
              fontFamily: "var(--font-data)",
              color: "var(--fintheon-muted)",
            }}
          >
            <div>
              Last run:{" "}
              <span style={{ color: "var(--fintheon-text)" }}>
                {fmtTime(status.lastRunAt)}
              </span>
            </div>
            <div>
              Next run:{" "}
              <span style={{ color: "var(--fintheon-text)" }}>
                {fmtTime(status.nextRunAt)}
              </span>
            </div>
            {status.lastRunOutcome && (
              <>
                <div>
                  Proposals:{" "}
                  <span style={{ color: "var(--fintheon-text)" }}>
                    {status.lastRunOutcome.proposalsCreated}
                  </span>
                </div>
                <div>
                  Walk-backs:{" "}
                  <span style={{ color: "var(--fintheon-text)" }}>
                    {status.lastRunOutcome.walkBacksReviewed}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Shadow-mode graduation tracker */}
      <div
        style={{
          border: "1px solid var(--fintheon-glass-border)",
          borderRadius: 6,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <CheckCircle2 size={14} color="var(--fintheon-accent)" />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fintheon-text)",
            }}
          >
            Shadow-mode graduation
          </span>
        </div>
        {shadowStats.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--fintheon-muted)" }}>
            No shadow decisions recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shadowStats.map((s) => (
              <div
                key={s.decisionType}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "var(--fintheon-bg)",
                  border: "1px solid var(--fintheon-glass-border)",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      color: "var(--fintheon-text)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.decisionType}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--fintheon-muted)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {s.agreed}/{s.total} agreed ·{" "}
                    {Math.round(s.agreementRate * 100)}%
                  </span>
                </div>
                {s.canAutoApply ? (
                  <span
                    style={{
                      padding: "4px 10px",
                      fontSize: 10,
                      fontFamily: "var(--font-data)",
                      letterSpacing: "0.04em",
                      color: "var(--fintheon-bg)",
                      background: "var(--fintheon-accent)",
                      borderRadius: 3,
                    }}
                  >
                    AUTO-APPLY
                  </span>
                ) : s.agreementRate >= 0.85 && s.total >= 30 ? (
                  <button
                    onClick={() => void graduate(s.decisionType)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 10,
                      fontFamily: "var(--font-data)",
                      color: "var(--fintheon-accent)",
                      background: "transparent",
                      border: "1px solid var(--fintheon-accent)",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    Graduate
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--fintheon-muted)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {s.total < 30 ? `need ${30 - s.total} more` : "below 85%"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

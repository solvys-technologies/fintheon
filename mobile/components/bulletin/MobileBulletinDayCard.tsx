// [claude-code 2026-04-26] S45-T2: Mobile parity tab for the Day Card preview.
//   Mon–Fri rows. No expansion — tap is a no-op on mobile bulletin (the Day
//   Card lives on the dashboard, reachable via the main nav). Mobile keeps its
//   own inline copy because the mobile bundle does not import from frontend/
//   (separate vite build, separate token system) — same pattern as
//   CatalystImage / RiskFlowCard memory pin. Field names mirror T1 backend
//   WeekDayEntry: day / ivScore / windowCount / eventName.
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { WeekDayEntry } from "../../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "";

function ivColor(score: number | null): string {
  if (score == null) return "var(--text-disabled)";
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#fb923c";
  if (score >= 4) return "#facc15";
  return "#34d399";
}

function truncate(s: string, n = 26): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export function MobileBulletinDayCard() {
  const { getAccessToken } = useAuth();
  const [days, setDays] = useState<WeekDayEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/day-plan/week`, {
          headers,
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const json = (await res.json()) as
          | WeekDayEntry[]
          | { days: WeekDayEntry[] };
        const items = Array.isArray(json) ? json : (json.days ?? []);
        if (!cancelled) {
          setDays(items);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        Mon–Fri at a glance.
      </span>
      {!loaded ? (
        <span style={emptyStyle}>[LOADING WEEK…]</span>
      ) : days.length === 0 ? (
        <span style={emptyStyle}>[NO PLAN DATA]</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {days.map((d, i) => (
            <div key={d.date}>
              {i > 0 && <span style={fadingRulerStyle} aria-hidden />}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    width: 36,
                    flexShrink: 0,
                  }}
                >
                  {d.day}
                </span>
                <span
                  style={{
                    fontFamily:
                      "'Doto', 'Readable Digits', var(--font-data, monospace)",
                    fontSize: 16,
                    fontWeight: 600,
                    color: ivColor(d.ivScore),
                    fontVariantNumeric: "tabular-nums",
                    width: 40,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {d.ivScore == null ? "—" : d.ivScore.toFixed(1)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    width: 28,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {d.windowCount}w
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                  title={d.eventName ?? undefined}
                >
                  {truncate(d.eventName ?? "—")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  color: "var(--text-disabled)",
  textAlign: "center",
  padding: "20px 0",
};

const fadingRulerStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 1,
  background:
    "linear-gradient(to right, transparent 0%, rgba(199,159,74,0) 5%, rgba(199,159,74,0.35) 50%, rgba(199,159,74,0) 95%, transparent 100%)",
};

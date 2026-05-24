// [claude-code 2026-03-30] S10: Briefing dropdown selector + countdown timer
// [claude-code 2026-03-12] Made scrollable, removed line-clamp, renders markdown-style formatting
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, RefreshCw, ChevronDown, Clock } from "lucide-react";
import { useBackend } from "../../lib/backend";

/** Markdown renderer for brief text — headers, bold labels, bullets, dividers */
function BriefContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1.5" />;

        // --- dividers
        if (/^-{3,}$/.test(trimmed)) {
          return <hr key={i} className="border-zinc-800 my-1" />;
        }

        // ## Markdown headers
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="text-[10px] font-bold text-[var(--fintheon-accent)] tracking-wide uppercase mt-2 mb-0.5"
            >
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={i}
              className="text-xs font-bold text-[var(--fintheon-text)] tracking-wide uppercase mt-2 mb-0.5"
            >
              {trimmed.slice(2)}
            </h2>
          );
        }

        // **Bold Label:** value  OR  **Bold Label** — value
        const labelMatch = trimmed.match(/^\*\*(.+?)\*\*[:\s—–-]+(.*)$/);
        if (labelMatch) {
          return (
            <div key={i}>
              <span className="text-[10px] font-bold text-[var(--fintheon-accent)]">
                {labelMatch[1]}:
              </span>
              {labelMatch[2] && (
                <span className="text-[10px] text-zinc-400 ml-1">
                  {renderInlineBold(labelMatch[2])}
                </span>
              )}
            </div>
          );
        }

        // Bullet points
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-[10px] text-[var(--fintheon-accent)]/60 shrink-0">
                -
              </span>
              <span className="text-[10px] leading-relaxed text-zinc-400">
                {renderInlineBold(trimmed.slice(2))}
              </span>
            </div>
          );
        }

        // Numbered lists
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {match[1]}.
                </span>
                <span className="text-[10px] leading-relaxed text-zinc-400">
                  {renderInlineBold(match[2])}
                </span>
              </div>
            );
          }
        }

        // Plain text
        return (
          <p key={i} className="text-[10px] leading-relaxed text-zinc-400">
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineBold(text: string): (string | React.ReactElement)[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-semibold text-zinc-300">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// Brief schedule (ET hours) — used for countdown
const BRIEF_SCHEDULE = [
  { type: "MDB", label: "Dawn Dispatch", hour: 6, minute: 30 },
  { type: "ADB", label: "Midday Dispatch", hour: 11, minute: 0 },
  { type: "PMDB", label: "Dusk Dispatch", hour: 17, minute: 15 },
] as const;

interface TodayBrief {
  id: string;
  type: string;
  label: string;
  content: string;
  createdAt: string;
}

function getNextBriefCountdown(): { label: string; hoursAway: number } | null {
  const now = new Date();
  const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etStr);
  const etMinutes = et.getHours() * 60 + et.getMinutes();
  const day = et.getDay();

  // No briefs on weekends
  if (day === 0 || day === 6) {
    // Next is Monday MDB
    const daysUntilMon = day === 0 ? 1 : 2;
    return {
      label: "Dawn Dispatch (Mon)",
      hoursAway: daysUntilMon * 24 - et.getHours() + 6,
    };
  }

  for (const sched of BRIEF_SCHEDULE) {
    const schedMinutes = sched.hour * 60 + sched.minute;
    if (etMinutes < schedMinutes) {
      const diff = schedMinutes - etMinutes;
      return { label: sched.label, hoursAway: Math.ceil(diff / 60) };
    }
  }

  // All today's briefs have passed — next is tomorrow's MDB
  return {
    label: "Dawn Dispatch",
    hoursAway: Math.ceil((24 * 60 - etMinutes + 6 * 60 + 30) / 60),
  };
}

export function BriefMiniWidget() {
  const backend = useBackend();
  const [todayBriefs, setTodayBriefs] = useState<TodayBrief[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [countdown, setCountdown] = useState(getNextBriefCountdown);

  const API_BASE = (backend as any)?.baseUrl || "http://localhost:8080";

  const fetchTodayBriefs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/data/briefs/today`);
      const data = await res.json();
      const briefs: TodayBrief[] = data.briefs ?? [];
      setTodayBriefs(briefs);
      // Auto-select the most recent
      if (briefs.length > 0 && !selectedId) {
        setSelectedId(briefs[0].id);
      }
    } catch {
      // Try legacy endpoint
      try {
        const res = await backend.data.getMdbBrief();
        const text = res.items?.[0]?.detail ?? "";
        if (text) {
          setTodayBriefs([
            {
              id: "latest",
              type: res.briefType ?? "MDB",
              label:
                res.briefType === "MDB"
                  ? "Dawn Dispatch"
                  : (res.briefType ?? "Brief"),
              content: text,
              createdAt: new Date().toISOString(),
            },
          ]);
          setSelectedId("latest");
        }
      } catch {
        /* silent */
      }
    } finally {
      setLoaded(true);
    }
  }, [backend, API_BASE, selectedId]);

  useEffect(() => {
    fetchTodayBriefs();
    const interval = setInterval(() => {
      fetchTodayBriefs();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchTodayBriefs]);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(
      () => setCountdown(getNextBriefCountdown()),
      60_000,
    );
    return () => clearInterval(interval);
  }, []);

  const activeBrief = useMemo(
    () =>
      todayBriefs.find((b) => b.id === selectedId) ?? todayBriefs[0] ?? null,
    [todayBriefs, selectedId],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTodayBriefs();
    setRefreshing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/data/brief/generate`, {
        method: "POST",
      });
      if (res.ok) {
        // Refetch to get the new brief
        await fetchTodayBriefs();
      }
    } catch {
      /* silent */
    } finally {
      setGenerating(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "320px", resize: "vertical", overflow: "auto" }}
    >
      {/* Header with dropdown */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 relative">
          <FileText className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />

          {/* Dropdown trigger */}
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)] hover:text-[var(--fintheon-text)] transition-colors"
          >
            {activeBrief?.label ?? "Briefings"}
            {todayBriefs.length > 1 && (
              <ChevronDown
                className={`w-2.5 h-2.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && todayBriefs.length > 1 && (
            <div className="fintheon-dropdown-surface absolute top-full left-0 mt-1 z-50 min-w-[180px] py-1 bg-[#0a0a07] border border-zinc-800">
              {todayBriefs.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(b.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[10px] transition-colors ${
                    b.id === selectedId
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-[9px] text-zinc-600 ml-2">
                    {formatTime(b.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="AI Generate brief"
          ></button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="Refresh brief"
          >
            <RefreshCw
              className={`w-2.5 h-2.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
        />
      )}

      {/* Brief content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pr-1">
        {!loaded ? (
          <div className="text-[10px] text-zinc-600 py-2">Loading brief...</div>
        ) : activeBrief?.content ? (
          <div className="pl-2">
            <BriefContent text={activeBrief.content} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="text-[10px] text-zinc-600">No brief available</div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-semibold text-[var(--fintheon-accent)] hover:text-[var(--fintheon-text)] transition-colors disabled:opacity-40"
            >
              Generate Brief
            </button>
          </div>
        )}
      </div>

      {/* Countdown to next brief */}
      {countdown && (
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-zinc-800/50">
          <Clock className="w-2.5 h-2.5 text-zinc-600" />
          <span className="text-[9px] text-zinc-600">
            Next: <span className="text-zinc-500">{countdown.label}</span> in{" "}
            <span className="text-[var(--fintheon-accent)]/70 font-medium">
              {countdown.hoursAway}h
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

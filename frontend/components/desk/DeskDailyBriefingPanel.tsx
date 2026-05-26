import { ChevronDown, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface TodayBrief {
  id: string;
  type: string;
  label: string;
  content: string;
  createdAt: string;
}

export function DeskDailyBriefingPanel() {
  const [todayBriefs, setTodayBriefs] = useState<TodayBrief[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayBriefs = useCallback(async () => {
    const apiBase = API_BASE.replace(/\/$/, "");
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/data/briefs/today`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { briefs?: TodayBrief[] };
      const briefs = data.briefs ?? [];
      setTodayBriefs(briefs);
      setSelectedId((current) =>
        current && briefs.some((brief) => brief.id === current)
          ? current
          : pickDefaultBriefId(briefs),
      );
    } catch {
      try {
        const response = await fetch(`${apiBase}/api/data/brief`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as {
          items?: Array<{ detail?: string }>;
          briefType?: string;
        };
        const content = data.items?.[0]?.detail ?? "";
        const type = data.briefType ?? "MDB";
        const brief = content
          ? [
              {
                id: "latest",
                type,
                label: labelForBriefType(type),
                content,
                createdAt: new Date().toISOString(),
              },
            ]
          : [];
        setTodayBriefs(brief);
        setSelectedId(brief[0]?.id ?? null);
      } catch {
        setTodayBriefs([]);
        setSelectedId(null);
        setError("Brief unavailable.");
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchTodayBriefs();
    const interval = window.setInterval(fetchTodayBriefs, 60_000);
    return () => window.clearInterval(interval);
  }, [fetchTodayBriefs]);

  const activeBrief = useMemo(
    () =>
      todayBriefs.find((brief) => brief.id === selectedId) ??
      todayBriefs[0] ??
      null,
    [selectedId, todayBriefs],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTodayBriefs();
    setRefreshing(false);
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <header className="flex shrink-0 items-center justify-between gap-3 px-1 py-1">
        <div className="relative flex min-w-0 items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--fintheon-accent)]" />
          <button
            type="button"
            onClick={() => setDropdownOpen((open) => !open)}
            className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fintheon-accent)] transition-colors hover:text-[var(--fintheon-text)]"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <span className="truncate">
              {activeBrief?.label ?? "Dawn Dispatch"}
            </span>
            {todayBriefs.length > 1 ? (
              <ChevronDown
                className={`h-2.5 w-2.5 shrink-0 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            ) : null}
          </button>
          {dropdownOpen && todayBriefs.length > 1 ? (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[190px] border border-[var(--fintheon-accent)]/12 bg-[#0a0a07] py-1">
              {todayBriefs.map((brief) => (
                <button
                  key={brief.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(brief.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[10px] transition-colors ${
                    brief.id === selectedId
                      ? "bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-accent)]"
                      : "text-zinc-400 hover:bg-zinc-800/45 hover:text-zinc-200"
                  }`}
                >
                  <span className="font-semibold">{brief.label}</span>
                  <span className="font-mono text-[9px] text-zinc-600">
                    {formatBriefTime(brief.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)] disabled:opacity-40"
          title="Refresh brief"
          aria-label="Refresh brief"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </header>

      {dropdownOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          aria-label="Close brief selector"
          onClick={() => setDropdownOpen(false)}
        />
      ) : null}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!loaded ? (
          <p className="text-[13px] italic text-[var(--fintheon-text)]/35">
            Loading brief...
          </p>
        ) : activeBrief?.content ? (
          <BriefContent text={activeBrief.content} />
        ) : (
          <p className="text-[13px] text-[var(--fintheon-text)]/42">
            {error ?? "No brief available."}
          </p>
        )}
      </div>
    </section>
  );
}

function BriefContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => (
        <BriefLine key={`${index}-${line.slice(0, 12)}`} line={line} />
      ))}
    </div>
  );
}

function BriefLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="h-1.5" />;
  if (/^-{3,}$/.test(trimmed)) {
    return <hr className="my-1 border-zinc-800" />;
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h3 className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[var(--fintheon-accent)]">
        {trimmed.slice(3)}
      </h3>
    );
  }
  if (trimmed.startsWith("# ")) {
    return (
      <h2 className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--fintheon-text)]">
        {trimmed.slice(2)}
      </h2>
    );
  }
  const labelMatch = trimmed.match(/^([^:]{3,42}):\s*(.*)$/);
  if (labelMatch) {
    return (
      <p className="text-[10.5px] leading-relaxed text-zinc-400">
        <span className="font-semibold text-[var(--fintheon-accent)]">
          {labelMatch[1]}:
        </span>{" "}
        {renderInlineBold(labelMatch[2])}
      </p>
    );
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return (
      <p className="pl-2 text-[10.5px] leading-relaxed text-zinc-400">
        <span className="text-[var(--fintheon-accent)]/65">- </span>
        {renderInlineBold(trimmed.slice(2))}
      </p>
    );
  }
  return (
    <p className="text-[10.5px] leading-relaxed text-zinc-400">
      {renderInlineBold(trimmed)}
    </p>
  );
}

function renderInlineBold(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${index}-${part}`} className="font-semibold text-zinc-300">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function labelForBriefType(type: string) {
  if (type === "MDB") return "Dawn Dispatch";
  if (type === "ADB") return "Midday Dispatch";
  if (type === "PMDB") return "Dusk Dispatch";
  return type || "Brief";
}

function pickDefaultBriefId(briefs: TodayBrief[]) {
  const usableBrief = briefs.find((brief) => isUsableBrief(brief.content));
  return usableBrief?.id ?? briefs[0]?.id ?? null;
}

function isUsableBrief(content: string) {
  const normalized = content.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    !normalized.startsWith("api call failed") &&
    !normalized.includes("insufficient balance")
  );
}

function formatBriefTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

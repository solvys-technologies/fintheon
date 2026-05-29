import {
  ChevronDown,
  FileText,
  Moon,
  Newspaper,
  RefreshCw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StreamdownChat } from "../chat/slots";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface TodayBrief {
  id: string;
  type: string;
  label: string;
  content: string;
  createdAt: string;
}

interface BriefOption {
  id: string;
  type: string;
  label: string;
  brief: TodayBrief | null;
  disabled: boolean;
  timeLabel: string;
  countdown: string | null;
  Icon: LucideIcon;
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
      const now = new Date();
      const briefs = (data.briefs ?? []).filter(
        (brief) => isUsableBrief(brief.content) && isBriefVisible(brief, now),
      );
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
  const briefOptions = useMemo(
    () => buildBriefOptions(todayBriefs),
    [todayBriefs],
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
          <FileText className="h-4 w-4 shrink-0 text-[var(--fintheon-accent)]" />
          <button
            type="button"
            onClick={() => setDropdownOpen((open) => !open)}
            className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.17em] text-[var(--fintheon-accent)] transition-colors hover:text-[var(--fintheon-text)]"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <span className="truncate">
              {activeBrief
                ? labelForBriefType(activeBrief.type)
                : "Dawn Dispatch"}
            </span>
            {briefOptions.length > 1 ? (
              <ChevronDown
                className={`h-2.5 w-2.5 shrink-0 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            ) : null}
          </button>
          {dropdownOpen && briefOptions.length > 1 ? (
            <div className="absolute left-0 top-full z-50 mt-2 min-w-[245px] overflow-hidden rounded-xl border border-[var(--fintheon-accent)]/14 bg-[#0a0a07]/95 py-1 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-150">
              {briefOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    if (!option.brief) return;
                    setSelectedId(option.brief.id);
                    setDropdownOpen(false);
                  }}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-[10px] transition-colors ${
                    option.brief?.id === selectedId
                      ? "text-[var(--fintheon-accent)]"
                      : option.disabled
                        ? "text-zinc-700"
                        : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <option.Icon className="h-3 w-3" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {option.label}
                    </span>
                    {option.countdown ? (
                      <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-[0.12em] text-zinc-600">
                        {option.countdown}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-600">
                    {option.timeLabel}
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

      <div className="mt-2 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]">
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
  return (
    <StreamdownChat
      content={prepareDeskBriefMarkdown(text)}
      className="fintheon-desk-brief-markdown text-[10.5px] leading-relaxed text-zinc-400"
    />
  );
}

function labelForBriefType(type: string) {
  if (type === "MDB") return "Morning Daily Brief";
  if (type === "ADB") return "Afternoon Daily Brief";
  if (type === "PMDB") return "Post-Market Daily Brief";
  if (type === "TWT") return "The Weekly Tribune";
  return type || "Dawn Dispatch";
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
    !normalized.startsWith("error:") &&
    !normalized.startsWith("failed to") &&
    !normalized.includes("insufficient balance") &&
    !normalized.includes("http 402") &&
    !normalized.includes("ai chain exhausted")
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

function prepareDeskBriefMarkdown(text: string) {
  return text.replace(
    /(^|\n)(\s*(?:[-*]\s*)?)(\d{1,2}:\d{2}):/g,
    (_match, prefix: string, lead: string, time: string) =>
      `${prefix}${lead}<brief-time>${time}</brief-time>`,
  );
}

function buildBriefOptions(briefs: TodayBrief[]): BriefOption[] {
  const byType = new Map(briefs.map((brief) => [brief.type, brief]));
  const now = new Date();
  const options: BriefOption[] = [
    scheduledOption("MDB", "Morning Daily Brief", "06:30", Sun, byType, now),
    scheduledOption("ADB", "Afternoon Daily Brief", "10:45", Sun, byType, now),
    scheduledOption(
      "PMDB",
      "Post-Market Daily Brief",
      "17:15",
      Moon,
      byType,
      now,
    ),
  ];
  const weekly = byType.get("TWT");
  if (weekly) {
    options.push({
      id: weekly.id,
      type: "TWT",
      label: "The Weekly Tribune",
      brief: weekly,
      disabled: false,
      Icon: Newspaper,
      timeLabel: formatBriefTime(weekly.createdAt),
      countdown: null,
    });
  }
  return options;
}

function scheduledOption(
  type: string,
  label: string,
  clock: string,
  Icon: LucideIcon,
  byType: Map<string, TodayBrief>,
  now: Date,
): BriefOption {
  const brief = byType.get(type) ?? null;
  const scheduledAt = scheduledToday(clock);
  const isPending = !brief && now.getTime() >= scheduledAt.getTime();
  return {
    id: brief?.id ?? `${type}-upcoming`,
    type,
    label,
    brief,
    disabled: !brief,
    Icon,
    timeLabel: brief
      ? formatBriefTime(brief.createdAt)
      : formatClockLabel(clock),
    countdown: brief
      ? null
      : isPending
        ? "Awaiting publish"
        : `${formatDurationUntil(scheduledAt, now)} until`,
  };
}

function scheduledToday(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function formatClockLabel(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

function formatDurationUntil(target: Date, now: Date) {
  const delta = Math.max(0, target.getTime() - now.getTime());
  const minutes = Math.ceil(delta / 60_000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function isBriefVisible(brief: TodayBrief, now: Date) {
  if (brief.type === "TWT") return true;
  return now.getTime() < dailyBriefExpiresAt(brief.createdAt).getTime();
}

function dailyBriefExpiresAt(createdAt: string) {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return new Date(0);
  const expires = new Date(created);
  expires.setDate(created.getDate() + 1);
  expires.setHours(7, 50, 0, 0);
  return expires;
}

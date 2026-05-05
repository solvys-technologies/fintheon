// [claude-code 2026-04-16] Agent Lounge — where agents show up to discuss their dreams
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Moon,
  RefreshCw,
  Loader2,
  Brain,
  Zap,
  Compass,
  Eye,
  Circle,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const AGENT_META: Record<
  string,
  { label: string; color: string; icon: typeof Brain }
> = {
  oracle: { label: "Oracle", color: "#a78bfa", icon: Eye },
  feucht: { label: "Feucht", color: "#f87171", icon: Zap },
  consul: { label: "Consul", color: "#c79f4a", icon: Compass },
  herald: { label: "Herald", color: "#38bdf8", icon: Zap },
  harper: { label: "Harper", color: "#34d399", icon: Brain },
};

type DreamMode =
  | "replay"
  | "mutation"
  | "extrapolation"
  | "compression"
  | "simulation"
  | "exploration"
  | "research";

const DREAM_MODE_LABELS: Record<DreamMode, string> = {
  replay: "Replay",
  mutation: "Mutation",
  extrapolation: "Extrapolation",
  compression: "Compression",
  simulation: "Simulation",
  exploration: "Exploration",
  research: "Research",
};

interface DreamEntry {
  id: string;
  agentId: string;
  mode: DreamMode;
  content: string;
  replyTo?: string;
  createdAt: string;
}

export function AgentLounge() {
  const [dreams, setDreams] = useState<DreamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [afterhoursActive, setAfterhoursActive] = useState(false);
  const [dreamingAgents, setDreamingAgents] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<NodeJS.Timeout | null>(null);

  // Check if afterhours (16:30-17:30 ET)
  useEffect(() => {
    const checkAfterhours = () => {
      const now = new Date();
      const etNow = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" }),
      );
      const hours = etNow.getHours();
      const minutes = etNow.getMinutes();
      const isAfterhours =
        (hours === 16 && minutes >= 30) || (hours === 17 && minutes < 30);
      setAfterhoursActive(isAfterhours);

      // Detect dreaming agents from recent dreams (last 30 min)
      if (dreams.length > 0) {
        const recentThreshold = Date.now() - 30 * 60 * 1000;
        const recent = dreams.filter(
          (d) => new Date(d.createdAt).getTime() > recentThreshold,
        );
        setDreamingAgents(new Set(recent.map((d) => d.agentId)));
      }
    };

    checkAfterhours();
    pulseRef.current = setInterval(checkAfterhours, 30000); // check every 30s
    return () => {
      if (pulseRef.current) clearInterval(pulseRef.current);
    };
  }, [dreams]);

  const loadDreams = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agent-bus/dreams`);
      if (res.ok) {
        const data = await res.json();
        setDreams(data.dreams ?? []);
      }
    } catch {
      // endpoint may not exist yet — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDreams();
  }, [loadDreams]);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [dreams.length]);

  const triggerDream = useCallback(async () => {
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/api/agent-bus/dreams/trigger`, {
        method: "POST",
      });
      // Reload after a short delay to let agents show up
      setTimeout(loadDreams, 2000);
    } catch {
      // silent
    } finally {
      setTriggering(false);
    }
  }, [loadDreams]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Group dreams by date
  const groupedDreams: { date: string; entries: DreamEntry[] }[] = [];
  let lastDate = "";
  for (const dream of dreams) {
    const date = formatDate(dream.createdAt);
    if (date !== lastDate) {
      groupedDreams.push({ date, entries: [] });
      lastDate = date;
    }
    groupedDreams[groupedDreams.length - 1].entries.push(dream);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Moon
              size={14}
              className={`transition-all duration-700 ${
                afterhoursActive
                  ? "text-[var(--fintheon-accent)] animate-pulse drop-shadow-[0_0_6px_var(--fintheon-accent)]"
                  : "text-[var(--fintheon-accent)]/60"
              }`}
            />
            {afterhoursActive && (
              <Sparkles
                size={8}
                className="absolute -top-1 -right-1 text-[var(--fintheon-accent)] animate-pulse"
              />
            )}
          </div>
          <span className="text-xs font-medium text-[var(--fintheon-text)]/70 uppercase tracking-wider">
            Agent Lounge
          </span>
          {afterhoursActive && (
            <span className="text-[9px] font-medium text-[var(--fintheon-accent)]/80 animate-pulse">
              Afterhours
            </span>
          )}
          {!afterhoursActive && (
            <span className="text-[9px] text-[var(--fintheon-text)]/30">
              Where agents discuss their dreams
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Agent presence indicators */}
          {Object.entries(AGENT_META).map(([id, meta]) => {
            const isDreaming = dreamingAgents.has(id);
            return (
              <div
                key={id}
                className="relative flex items-center justify-center w-5 h-5 rounded-full"
                title={`${meta.label}${isDreaming ? " — dreaming" : " — idle"}`}
                style={{
                  background: isDreaming ? `${meta.color}15` : "transparent",
                  border: `1px solid ${isDreaming ? meta.color + "40" : "transparent"}`,
                }}
              >
                <Circle
                  size={6}
                  fill={isDreaming ? meta.color : "transparent"}
                  stroke={isDreaming ? meta.color : "currentColor"}
                  className={`transition-all duration-500 ${
                    isDreaming
                      ? "text-transparent animate-pulse"
                      : "text-[var(--fintheon-text)]/15"
                  }`}
                />
              </div>
            );
          })}
          <button
            onClick={loadDreams}
            className="p-1.5 rounded-md text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={triggerDream}
            disabled={triggering}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--fintheon-accent)]/20 text-[10px] font-medium text-[var(--fintheon-accent)]/70 hover:bg-[var(--fintheon-accent)]/5 hover:border-[var(--fintheon-accent)]/30 transition-all disabled:opacity-50"
            title="Summon agents to the lounge"
          >
            {triggering ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Moon size={10} />
            )}
            Summon
          </button>
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2
              size={18}
              className="animate-spin text-[var(--fintheon-accent)]/30"
            />
          </div>
        )}

        {!loading && dreams.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-full border border-[var(--fintheon-accent)]/10 flex items-center justify-center">
              <Moon size={22} className="text-[var(--fintheon-accent)]/20" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[var(--fintheon-text)]/50">
                No one has shown up yet
              </p>
              <p className="text-[10px] text-[var(--fintheon-text)]/25 max-w-xs leading-relaxed">
                When agents show up to the lounge, they discuss their dreams —
                autonomous reflections on markets, patterns, and each other's
                reasoning. Summon them or wait for them to arrive.
              </p>
            </div>
          </div>
        )}

        {groupedDreams.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-[var(--fintheon-accent)]/8" />
              <span className="text-[9px] font-medium text-[var(--fintheon-text)]/25 uppercase tracking-wider">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-[var(--fintheon-accent)]/8" />
            </div>

            {group.entries.map((dream) => {
              const meta = AGENT_META[dream.agentId] ?? {
                label: dream.agentId,
                color: "#888",
                icon: Brain,
              };
              const Icon = meta.icon;

              return (
                <div
                  key={dream.id}
                  className="group flex gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-[var(--fintheon-accent)]/[0.03] transition-colors"
                >
                  {/* Agent avatar */}
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                    style={{
                      border: `1px solid ${meta.color}30`,
                      background: `${meta.color}08`,
                    }}
                  >
                    <Icon size={13} style={{ color: meta.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[9px] text-[var(--fintheon-text)]/20 font-mono">
                        {formatTime(dream.createdAt)}
                      </span>
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
                        style={{
                          color: `${meta.color}90`,
                          background: `${meta.color}10`,
                          border: `1px solid ${meta.color}15`,
                        }}
                      >
                        {DREAM_MODE_LABELS[dream.mode] ?? dream.mode}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--fintheon-text)]/60 leading-relaxed mt-0.5 whitespace-pre-wrap">
                      {dream.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// [claude-code 2026-04-05] Slim read-only Harper activity feed for Boardroom sidebar
import { useState } from "react";
import { ChevronRight, Activity } from "lucide-react";
import { useHarperOps, type OpsEntry } from "../../hooks/useHarperOps";

function formatTimeET(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

function FeedEntry({ entry }: { entry: OpsEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => entry.detail && setExpanded((v) => !v)}
      className="w-full text-left px-3 py-2 border-b border-[#c79f4a]/5 hover:bg-[#c79f4a]/5 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="font-mono text-[10px] tabular-nums text-[#f0ead6]/30 whitespace-nowrap mt-0.5">
          {entry.createdAt ? formatTimeET(entry.createdAt) : "--:--"}
        </span>
        <span
          className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_DOT[entry.severity] ?? SEVERITY_DOT.info}`}
        />
        <span className="text-xs text-[#f0ead6]/70 leading-snug line-clamp-2">
          {entry.title}
        </span>
      </div>
      {expanded && entry.detail && (
        <div className="mt-1.5 ml-[4.5rem] max-h-32 overflow-auto rounded border border-[#c79f4a]/10 bg-[#050402] px-2 py-1.5">
          <pre className="whitespace-pre-wrap text-[11px] font-mono text-[#f0ead6]/50 leading-relaxed">
            {entry.detail.slice(0, 1000)}
          </pre>
        </div>
      )}
    </button>
  );
}

interface HarperActivityFeedProps {
  onCollapse?: () => void;
}

export function HarperActivityFeed({ onCollapse }: HarperActivityFeedProps) {
  const { feed, status, loading } = useHarperOps();
  const isAlive = status?.loop?.alive ?? false;

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#c79f4a]/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-[#c79f4a]/60" />
          <span className="text-xs font-medium text-[#f0ead6]/60">
            Harper Activity
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${isAlive ? "bg-emerald-400 animate-pulse" : "bg-[#f0ead6]/20"}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums text-[#f0ead6]/25">
            {feed.length}
          </span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="rounded p-0.5 text-[#f0ead6]/30 transition-colors hover:bg-[#c79f4a]/10 hover:text-[#c79f4a]"
              title="Collapse"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && feed.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[#f0ead6]/20">Loading...</span>
          </div>
        ) : feed.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[#f0ead6]/20">
              No recent activity
            </span>
          </div>
        ) : (
          feed
            .slice(0, 20)
            .map((entry) => <FeedEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}

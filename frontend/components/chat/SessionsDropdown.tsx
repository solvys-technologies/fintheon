// [claude-code 2026-04-18] Attach Supabase JWT to conversations list + delete fetches —
//   post-migration all 106 convo rows live under a real sub and RLS blocks unauth reads, so the
//   dropdown was showing a frozen spinner (fetch resolved but data.conversations was empty and
//   the list renderer short-circuited). Handle non-OK responses explicitly so the spinner clears
//   even when the backend returns 401/500. Auto-focus uses setTimeout(0) instead of rAF so the
//   dropdown has committed to the DOM before focus() fires (Electron portal ordering issue).
// [claude-code 2026-04-04] Sessions dropdown — compact history panel anchored under trigger button
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  MessageSquare,
  Loader2,
  Trash2,
} from "lucide-react";
import { API_BASE_URL } from "./constants";
import { getAccessToken } from "../../lib/supabase";

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
  isArchived: boolean;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDate(
  sessions: ConversationSummary[],
): Record<string, ConversationSummary[]> {
  const groups: Record<string, ConversationSummary[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  for (const s of sessions) {
    const d = new Date(s.lastMessageAt);
    let label: string;
    if (d.toDateString() === today) label = "Today";
    else if (d.toDateString() === yesterday) label = "Yesterday";
    else if (d > weekAgo) label = "This Week";
    else label = "Older";

    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }
  return groups;
}

interface SessionsDropdownProps {
  onClose: () => void;
  onSelectSession: (conversationId: string) => void;
  onNewSession: () => void;
  currentConversationId?: string;
}

export function SessionsDropdown({
  onClose,
  onSelectSession,
  onNewSession,
  currentConversationId,
}: SessionsDropdownProps) {
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch sessions on mount — with JWT so RLS returns the user's convos, not an empty set.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE_URL}/api/ai/conversations`, {
          headers,
        });
        if (cancelled) return;
        if (!res.ok) {
          console.warn(
            `[SessionsDropdown] conversations fetch failed (${res.status})`,
          );
          setSessions([]);
          return;
        }
        const data = await res.json();
        setSessions(data.conversations ?? []);
      } catch (err) {
        if (!cancelled)
          console.warn("[SessionsDropdown] conversations fetch error:", err);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus search on mount — setTimeout(0) lets the dropdown commit to the DOM first;
  // rAF was racing Electron's portal mount on the first open and silently no-oping.
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filter by search
  const filtered = search.trim()
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()),
      )
    : sessions;

  const grouped = groupByDate(filtered);
  const flatFiltered = Object.values(grouped).flat();

  // Keyboard navigation within dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
        onSelectSession(flatFiltered[selectedIndex].id);
      }
    },
    [flatFiltered, selectedIndex, onSelectSession],
  );

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/ai/conversations/${id}`, {
        method: "DELETE",
        headers,
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      className="absolute right-0 top-full mt-1 z-50 w-[280px] rounded-lg border overflow-hidden"
      style={{
        borderColor:
          "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
        backgroundColor: "#0a0a08",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        maxHeight: "350px",
      }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor:
            "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
        }}
      >
        <Search size={12} className="text-zinc-500 shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sessions..."
          className="flex-1 bg-transparent text-[11px] text-[var(--fintheon-text)] placeholder:text-zinc-600 outline-none"
        />
      </div>

      {/* Session list */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "290px", scrollbarWidth: "thin" }}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2
              size={14}
              className="animate-spin"
              style={{ color: "var(--fintheon-accent)" }}
            />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <MessageSquare size={16} className="mb-1.5 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">
              {search ? "No matching sessions" : "No sessions yet"}
            </p>
          </div>
        )}

        {!loading &&
          Object.entries(grouped).map(([dateLabel, items]) => {
            const groupStartIndex = flatFiltered.indexOf(items[0]);
            return (
              <div key={dateLabel}>
                <div
                  className="px-3 py-1 text-[10px] font-semibold tracking-widest uppercase sticky top-0"
                  style={{
                    color: "var(--fintheon-accent)",
                    backgroundColor: "#0a0a08",
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--fintheon-accent) 6%, transparent)",
                  }}
                >
                  {dateLabel}
                </div>
                {items.map((session, i) => {
                  const flatIndex = groupStartIndex + i;
                  const isSelected = flatIndex === selectedIndex;
                  const isActive = session.id === currentConversationId;
                  return (
                    <button
                      key={session.id}
                      data-index={flatIndex}
                      onClick={() => onSelectSession(session.id)}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors group/item"
                      style={{
                        backgroundColor: isSelected
                          ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
                          : "transparent",
                        borderLeft: isActive
                          ? "2px solid var(--fintheon-accent)"
                          : "2px solid transparent",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className="text-[11px] font-medium truncate"
                            style={{
                              color: isActive
                                ? "var(--fintheon-accent)"
                                : "var(--fintheon-text)",
                            }}
                          >
                            {session.title}
                          </span>
                          <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                            {formatRelativeDate(session.lastMessageAt)}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {session.messageCount} msg
                          {session.messageCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 transition-all text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </button>
                  );
                })}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-1.5 text-center border-t"
        style={{
          borderColor:
            "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
          backgroundColor:
            "color-mix(in srgb, #0a0a08 95%, var(--fintheon-accent) 5%)",
        }}
      >
        <span
          className="text-[9px] tracking-wider uppercase"
          style={{ color: "var(--fintheon-muted)", opacity: 0.6 }}
        >
          Sessions reset daily at 6PM ET
        </span>
      </div>
    </div>
  );
}

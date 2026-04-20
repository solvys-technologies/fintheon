// [claude-code 2026-04-03] S14-T3: Rework to dual-mode — standard CRUD + read-only Fileroom (context bank)
// [claude-code 2026-04-01] S13-T3: Shared Memory standalone panel — view/edit team memory

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Loader2,
  Brain,
  Save,
  ChevronRight,
  User,
  BookOpen,
  Link2,
} from "@/components/shared/iso-icons";
import { useBackend } from "../../lib/backend";
import type { SharedMemoryEntry } from "../../lib/services";

const CATEGORIES = [
  "regime",
  "research",
  "narrative",
  "calibration",
  "custom",
] as const;

interface SharedMemoryPanelProps {
  mode?: "standard" | "fileroom";
}

export function SharedMemoryPanel({
  mode = "standard",
}: SharedMemoryPanelProps) {
  const backend = useBackend();
  const [entries, setEntries] = useState<SharedMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selected, setSelected] = useState<SharedMemoryEntry | null>(null);

  // CRUD state — only used in standard mode
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState<string>("custom");
  const [newTtl, setNewTtl] = useState("");
  const [saving, setSaving] = useState(false);

  const isFileroom = mode === "fileroom";

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backend.memory.listShared({
        category: categoryFilter || undefined,
        search: search || undefined,
      });
      setEntries(res.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [backend, categoryFilter, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleAdd = useCallback(async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(newValue);
      } catch {
        parsed = { text: newValue };
      }
      await backend.memory.setShared(newKey.trim(), {
        value: parsed,
        category: newCategory,
        ttlHours: newTtl ? Number(newTtl) : undefined,
      });
      setNewKey("");
      setNewValue("");
      setNewTtl("");
      setShowAdd(false);
      fetchEntries();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [backend, newKey, newValue, newCategory, newTtl, fetchEntries]);

  const handleDelete = useCallback(
    async (key: string) => {
      await backend.memory.deleteShared(key);
      setSelected(null);
      fetchEntries();
    },
    [backend, fetchEntries],
  );

  // ── Fileroom mode: read-only context bank with side-by-side layout ──
  if (isFileroom) {
    return (
      <div className="flex h-full bg-[#050402]">
        {/* Left: Card preview list */}
        <div className="flex flex-col w-72 flex-shrink-0 border-r border-[#c79f4a]/10">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#c79f4a]/10">
            <Brain size={16} className="text-[#c79f4a]" />
            <h2 className="text-sm font-medium text-[#f0ead6]">Fileroom</h2>
            <span className="text-[10px] text-[#f0ead6]/30 ml-auto">
              {entries.length} items
            </span>
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#c79f4a]/5">
            <div className="flex-1 flex items-center gap-1 bg-[#0a0a08] border border-[#c79f4a]/10 rounded px-2 py-1">
              <Search size={12} className="text-[#f0ead6]/25" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search context bank..."
                className="flex-1 bg-transparent text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#0a0a08] border border-[#c79f4a]/10 rounded px-2 py-1 text-xs text-[#f0ead6]/70 outline-none"
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Entry cards */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-[#c79f4a]" />
              </div>
            )}
            {!loading && entries.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[#f0ead6]/25">
                No context bank items
              </div>
            )}
            {!loading &&
              entries.map((entry) => {
                const isActive = selected?.id === entry.id;
                const valuePreview =
                  typeof entry.value === "object"
                    ? (((entry.value as Record<string, unknown>)
                        ?.text as string) ??
                      JSON.stringify(entry.value).slice(0, 80))
                    : String(entry.value).slice(0, 80);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelected(isActive ? null : entry)}
                    className={`w-full text-left px-4 py-2.5 border-b border-[#c79f4a]/5 transition-colors ${
                      isActive
                        ? "bg-[#c79f4a]/8 border-l-2 border-l-[#c79f4a]"
                        : "hover:bg-[#c79f4a]/5 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#f0ead6]/80 truncate">
                        {entry.key}
                      </span>
                      <ChevronRight
                        size={10}
                        className={`text-[#f0ead6]/20 ml-auto flex-shrink-0 transition-transform ${isActive ? "rotate-90" : ""}`}
                      />
                    </div>
                    <div className="text-[10px] text-[#f0ead6]/30 mt-0.5 truncate">
                      {valuePreview}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1 rounded bg-[#c79f4a]/10 text-[#c79f4a]/60">
                        {entry.category}
                      </span>
                      {entry.agentName && (
                        <span className="text-[9px] text-[#f0ead6]/25">
                          {entry.agentName}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right: Detail view */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-[#f0ead6]/20">
              <Brain size={32} className="mb-2 opacity-30" />
              <p className="text-xs">Select an item to view details</p>
            </div>
          ) : (
            <div className="p-5">
              {/* Title + category */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[#f0ead6]">
                  {selected.key}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c79f4a]/10 text-[#c79f4a]/70">
                    {selected.category}
                  </span>
                  <span className="text-[10px] text-[#f0ead6]/25">
                    Updated {new Date(selected.updatedAt).toLocaleString()}
                  </span>
                  {selected.ttlHours && (
                    <span className="text-[10px] text-[#f0ead6]/25">
                      {selected.ttlHours}h TTL
                    </span>
                  )}
                </div>
              </div>

              {/* Full content (read-only) */}
              <div className="mb-4">
                <pre className="text-xs text-[#f0ead6]/60 whitespace-pre-wrap font-mono bg-[#0a0a08] rounded-lg p-3 border border-[#c79f4a]/10">
                  {JSON.stringify(selected.value, null, 2)}
                </pre>
              </div>

              {/* Linked agent badge */}
              {selected.agentName && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[#0a0a08] border border-[#c79f4a]/10">
                  <User size={12} className="text-[#c79f4a]/60" />
                  <span className="text-xs text-[#f0ead6]/50">
                    Linked Agent
                  </span>
                  <span className="text-xs font-medium text-[#c79f4a]">
                    {selected.agentName}
                  </span>
                </div>
              )}

              {/* Rules of engagement (placeholder — needs DB column) */}
              <div className="mb-3 px-3 py-2 rounded-lg bg-[#0a0a08] border border-[#c79f4a]/10">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={12} className="text-[#c79f4a]/60" />
                  <span className="text-xs text-[#f0ead6]/50">
                    Rules of Engagement
                  </span>
                </div>
                <p className="text-[10px] text-[#f0ead6]/30 italic">
                  {((selected.value as Record<string, unknown>)
                    ?.rules_of_engagement as string) ??
                    "No usage rules defined — pending DB migration"}
                </p>
              </div>

              {/* Event citations (placeholder — needs DB column) */}
              <div className="px-3 py-2 rounded-lg bg-[#0a0a08] border border-[#c79f4a]/10">
                <div className="flex items-center gap-2 mb-1">
                  <Link2 size={12} className="text-[#c79f4a]/60" />
                  <span className="text-xs text-[#f0ead6]/50">
                    Event Citations
                  </span>
                </div>
                {(() => {
                  const citations = (selected.value as Record<string, unknown>)
                    ?.event_citations as
                    | Array<{ headline: string; date: string }>
                    | undefined;
                  if (!citations || citations.length === 0) {
                    return (
                      <p className="text-[10px] text-[#f0ead6]/30 italic">
                        No event citations — pending DB migration
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      {citations.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[10px]"
                        >
                          <span className="text-[#f0ead6]/40">{c.date}</span>
                          <span className="text-[#f0ead6]/60">
                            {c.headline}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Standard mode: original CRUD panel ──
  return (
    <div className="flex flex-col h-full bg-[#050402]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#c79f4a]/10">
        <Brain size={16} className="text-[#c79f4a]" />
        <h2 className="text-sm font-medium text-[#f0ead6]">Shared Memory</h2>
        <span className="text-[10px] text-[#f0ead6]/30 ml-auto">
          {entries.length} entries
        </span>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#c79f4a]/5">
        <div className="flex-1 flex items-center gap-1 bg-[#0a0a08] border border-[#c79f4a]/10 rounded px-2 py-1">
          <Search size={12} className="text-[#f0ead6]/25" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys and values..."
            className="flex-1 bg-transparent text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#0a0a08] border border-[#c79f4a]/10 rounded px-2 py-1 text-xs text-[#f0ead6]/70 outline-none"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="p-1 rounded text-[#c79f4a]/60 hover:text-[#c79f4a] hover:bg-[#c79f4a]/10 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="px-4 py-2 border-b border-[#c79f4a]/10 bg-[#0a0a08]/50 space-y-1.5">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key (e.g. market-regime-current)"
            className="w-full bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1 text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none"
          />
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value (JSON or text)"
            rows={3}
            className="w-full bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1 text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none resize-none font-mono"
          />
          <div className="flex items-center gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1 text-xs text-[#f0ead6]/70 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newTtl}
              onChange={(e) => setNewTtl(e.target.value)}
              placeholder="TTL (hours)"
              className="w-20 bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1 text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newKey.trim() || !newValue.trim()}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-[#c79f4a] border border-[#c79f4a]/20 hover:bg-[#c79f4a]/10 disabled:opacity-30 transition-colors"
            >
              {saving ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Save size={10} />
              )}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[#c79f4a]" />
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-[#f0ead6]/25">
            No shared memory entries
          </div>
        )}
        {!loading &&
          entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() =>
                setSelected(selected?.id === entry.id ? null : entry)
              }
              className={`w-full text-left px-4 py-2 border-b border-[#c79f4a]/5 hover:bg-[#c79f4a]/5 transition-colors ${
                selected?.id === entry.id ? "bg-[#c79f4a]/8" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#f0ead6]/80 truncate">
                  {entry.key}
                </span>
                <span className="text-[9px] px-1 rounded bg-[#c79f4a]/10 text-[#c79f4a]/60">
                  {entry.category}
                </span>
                {entry.ttlHours && (
                  <span className="text-[9px] text-[#f0ead6]/25 ml-auto">
                    {entry.ttlHours}h TTL
                  </span>
                )}
              </div>
              {entry.agentName && (
                <div className="text-[10px] text-[#f0ead6]/30 mt-0.5">
                  {entry.agentName}
                </div>
              )}
              {selected?.id === entry.id && (
                <div className="mt-2">
                  <pre className="text-[10px] text-[#f0ead6]/50 whitespace-pre-wrap font-mono bg-[#050402] rounded p-2 max-h-32 overflow-y-auto">
                    {JSON.stringify(entry.value, null, 2)}
                  </pre>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] text-[#f0ead6]/20">
                      Updated {new Date(entry.updatedAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry.key);
                      }}
                      className="ml-auto p-1 rounded text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}

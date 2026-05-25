// [claude-code 2026-05-07] SoulFileroomPanel — stacked chevron agent soul cards with editable detail pane for the Fileroom.
import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Save,
  Loader2,
  Brain,
  User,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import type { SoulMeta, SoulContent } from "../../lib/services/soul";

const AGENT_COLORS: Record<string, string> = {
  harper: "#c79f4a",
  oracle: "#8b5cf6",
  feucht: "#ef4444",
  consul: "#3b82f6",
  herald: "#84cc16",
};

interface SoulFileroomPanelProps {}

export function SoulFileroomPanel({}: SoulFileroomPanelProps) {
  const backend = useBackend();
  const [souls, setSouls] = useState<SoulMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Detail pane state
  const [soulContent, setSoulContent] = useState<SoulContent | null>(null);
  const [editContent, setEditContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchSouls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backend.soul.list();
      setSouls(res.souls ?? []);
    } catch {
      setSouls([]);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    fetchSouls();
  }, [fetchSouls]);

  const fetchContent = useCallback(
    async (agentId: string) => {
      setContentLoading(true);
      setHasUnsavedChanges(false);
      setSaveMessage(null);
      try {
        const res = await backend.soul.get(agentId);
        setSoulContent(res);
        setEditContent(res.content);
      } catch {
        setSoulContent(null);
        setEditContent("");
      } finally {
        setContentLoading(false);
      }
    },
    [backend],
  );

  const handleSelect = (agentId: string) => {
    if (selectedId === agentId) {
      // Toggle expand in the stack
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(agentId)) next.delete(agentId);
        else next.add(agentId);
        return next;
      });
      return;
    }
    setSelectedId(agentId);
    setExpandedIds((prev) => new Set([...prev, agentId]));
    fetchContent(agentId);
  };

  const handleSave = async () => {
    if (!selectedId || !editContent.trim()) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await backend.soul.update(selectedId, editContent);
      setHasUnsavedChanges(false);
      setSaveMessage({ type: "success", text: "Saved" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: "error", text: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (value: string) => {
    setEditContent(value);
    setHasUnsavedChanges(true);
  };

  // Keyboard shortcut Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && selectedId) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, selectedId, editContent]);

  const selectedSoul = souls.find((s) => s.agent_id === selectedId);

  return (
    <div className="flex h-full bg-[var(--fintheon-bg)] t-fade-in">
      {/* Left: Stacked chevron cards — glass surface */}
      <div className="relative flex flex-col w-[420px] min-w-[400px] flex-shrink-0 bg-[var(--fintheon-surface)]/40 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--fintheon-accent)]/10">
          <Brain size={16} className="text-[var(--fintheon-accent)]" />
          <h2 className="text-sm font-medium text-[var(--fintheon-text)]">
            Agent Souls
          </h2>
          <span className="text-[10px] text-[var(--fintheon-text)]/30 ml-auto tabular-nums">
            {souls.length} agents
          </span>
        </div>

        {/* Stacked chevron cards */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[#c79f4a]" />
            </div>
          )}
          {!loading && souls.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[#f0ead6]/25">
              No agent souls found
            </div>
          )}
          {!loading &&
            souls.map((soul) => {
              const isActive = selectedId === soul.agent_id;
              const isExpanded = expandedIds.has(soul.agent_id);
              const accentColor = AGENT_COLORS[soul.agent_id] ?? "#c79f4a";
              return (
                <div
                  key={soul.agent_id}
                  className="border-b border-[#c79f4a]/5"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(soul.agent_id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
                      isActive
                        ? "bg-[#c79f4a]/8 border-l-2 border-l-[var(--fintheon-accent)]"
                        : "hover:bg-[#c79f4a]/5 border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Agent avatar dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    />
                    {/* Agent info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[var(--fintheon-text)]/90 truncate">
                        {soul.name}
                      </div>
                      <div className="text-[10px] text-[var(--fintheon-text)]/30 truncate mt-0.5">
                        {soul.role}
                      </div>
                    </div>
                    {/* Chevron */}
                    <ChevronDown
                      size={12}
                      className={`text-[var(--fintheon-text)]/20 flex-shrink-0 transition-transform duration-200 ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                  </button>

                  {/* Expanded: inline preview of the first few lines */}
                  {isExpanded && !isActive && (
                    <div className="px-4 pb-3 pl-10">
                      <div className="text-[10px] text-[var(--fintheon-text)]/25 font-mono leading-relaxed">
                        {soul.model_prefer && (
                          <span>Model: {soul.model_prefer} — </span>
                        )}
                        Click to load full content
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Right: Detail view */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--fintheon-text)]/20">
            <User size={32} className="mb-2 opacity-30" />
            <p className="text-xs">
              Select an agent to view and edit their soul
            </p>
          </div>
        ) : contentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={16} className="animate-spin text-[#c79f4a]" />
          </div>
        ) : soulContent ? (
          <div className="p-5 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    AGENT_COLORS[selectedSoul?.agent_id ?? ""] ?? "#c79f4a",
                }}
              />
              <h3 className="text-sm font-bold text-[var(--fintheon-text)]">
                {selectedSoul?.name ?? selectedId}
              </h3>
              <span className="text-[10px] text-[var(--fintheon-text)]/25 ml-auto tabular-nums">
                {selectedSoul?.role ?? ""}
              </span>
            </div>

            {/* File label */}
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/70 font-mono">
                {selectedId}.md
              </span>
              <span className="text-[10px] text-[var(--fintheon-text)]/20">
                backend-hono/src/services/ai/soul/
              </span>
              {hasUnsavedChanges && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]">
                  Unsaved
                </span>
              )}
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0 mb-3">
              <textarea
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-full resize-none bg-[#0a0a08] border border-[var(--fintheon-accent)]/10 rounded-lg p-4 text-xs text-[var(--fintheon-text)]/80 font-mono leading-relaxed outline-none focus:border-[var(--fintheon-accent)]/30 transition-colors"
                spellCheck={false}
                placeholder="Agent soul content..."
              />
            </div>

            {/* Footer bar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Save feedback */}
              {saveMessage && (
                <div
                  className={`flex items-center gap-1.5 text-[10px] ${
                    saveMessage.type === "success"
                      ? "text-[var(--fintheon-accent)]"
                      : "text-red-400"
                  }`}
                >
                  {saveMessage.type === "success" ? (
                    <Check size={11} />
                  ) : (
                    <AlertTriangle size={11} />
                  )}
                  {saveMessage.text}
                </div>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  color: "#c79f4a",
                  borderColor: "rgba(199, 159, 74, 0.2)",
                }}
              >
                {saving ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Save size={10} />
                )}
                Save Soul
              </button>
              <span className="text-[9px] text-[var(--fintheon-text)]/15">
                Ctrl+S
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--fintheon-text)]/20">
            <AlertTriangle size={24} className="mb-2 opacity-30" />
            <p className="text-xs">Failed to load soul content</p>
          </div>
        )}
      </div>
    </div>
  );
}

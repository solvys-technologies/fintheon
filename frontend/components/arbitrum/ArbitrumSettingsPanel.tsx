// [claude-code 2026-05-01] S56 Track A: Arbitrum settings + health panel overlay.
// Scoped to the chamber container, gated by DevPasswordGate first-time-per-session.
// Health view: 3 expandable chevron rows. Editor mode: per-seat prompt textareas,
// source checkboxes, category filter dropdown. Save/Reset with confirmation.
import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { X, Check, RotateCcw } from "lucide-react";
import { isDevAuthenticated } from "../../lib/dev-settings-auth";
import { DevPasswordGate } from "../settings/DevPasswordGate";
import { useArbitrumHealth } from "../../hooks/useArbitrumHealth";
import { useArbitrumSeatOverrides } from "../../hooks/useArbitrumSeatOverrides";
import { ROLE_DISPLAY_NAMES } from "./ChamberSeats";
import type { SeatOverride } from "./types";

const SEAT_IDS = ["lead", "forecaster", "risk", "quant", "bear"] as const;

const CONTEXT_SOURCE_OPTIONS = [
  { id: "econ_calendar", label: "Econ Calendar" },
  { id: "commentary_watch", label: "Commentary Watch" },
  { id: "riskflow_feed", label: "RiskFlow Feed" },
  { id: "iv_simulation", label: "IV Simulation" },
  { id: "scored_items", label: "Scored Items" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "macro", label: "Macro" },
  { value: "geopolitics", label: "Geopolitics" },
  { value: "earnings", label: "Earnings" },
  { value: "fomc", label: "FOMC" },
  { value: "commodity", label: "Commodity" },
  { value: "volatility", label: "Volatility" },
  { value: "sector", label: "Sector Rotation" },
];

type PanelMode = "health" | "editor";

interface SeatEditState {
  seat_id: string;
  override_prompt: string;
  context_sources: string[];
  category_filter: string;
}

interface ArbitrumSettingsPanelProps {
  onClose: () => void;
}

export function ArbitrumSettingsPanel({ onClose }: ArbitrumSettingsPanelProps) {
  const [authed, setAuthed] = useState(() => isDevAuthenticated());
  const [mode, setMode] = useState<PanelMode>("health");
  const [activeSeat, setActiveSeat] = useState<string>("lead");

  const {
    health,
    isLoading: healthLoading,
    refresh: refreshHealth,
  } = useArbitrumHealth();
  const {
    overrides,
    isLoading: overridesLoading,
    error: overridesError,
    load: loadOverrides,
    save: saveOverrides,
    reset: resetOverrides,
  } = useArbitrumSeatOverrides();

  const [editState, setEditState] = useState<Map<string, SeatEditState>>(
    new Map(),
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!authed) return;
    void refreshHealth();
    void loadOverrides();
  }, [authed, refreshHealth, loadOverrides]);

  useEffect(() => {
    if (overrides.length === 0) return;
    const map = new Map<string, SeatEditState>();
    for (const o of overrides) {
      map.set(o.seat_id, {
        seat_id: o.seat_id,
        override_prompt: o.override_prompt ?? "",
        context_sources: o.context_sources ?? [],
        category_filter: o.category_filter ?? "all",
      });
    }
    // Fill any missing seats
    for (const sid of SEAT_IDS) {
      if (!map.has(sid)) {
        map.set(sid, {
          seat_id: sid,
          override_prompt: "",
          context_sources: [],
          category_filter: "all",
        });
      }
    }
    setEditState(map);
  }, [overrides]);

  if (!authed) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--fintheon-bg)]/90 backdrop-blur-[2px] p-4">
        <DevPasswordGate onAuthenticated={() => setAuthed(true)} />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const patches = [...editState.values()].map((s) => ({
      seat_id: s.seat_id,
      override_prompt: s.override_prompt,
      context_sources: s.context_sources,
      category_filter: s.category_filter,
    }));
    const ok = await saveOverrides(patches);
    setSaveMsg(ok ? "Saved" : "Save failed");
    setTimeout(() => setSaveMsg(null), 2000);
    setSaving(false);
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    const ok = await resetOverrides(SEAT_IDS.slice());
    if (ok) {
      for (const sid of SEAT_IDS) {
        editState.set(sid, {
          seat_id: sid,
          override_prompt: "",
          context_sources: [],
          category_filter: "all",
        });
      }
      setEditState(new Map(editState));
    }
  };

  const updateSeatField = (
    seatId: string,
    field: keyof SeatEditState,
    value: string | string[],
  ) => {
    setEditState((prev) => {
      const next = new Map(prev);
      const existing = next.get(seatId);
      if (!existing) return next;
      next.set(seatId, { ...existing, [field]: value });
      return next;
    });
  };

  const toggleContextSource = (seatId: string, sourceId: string) => {
    const seat = editState.get(seatId);
    if (!seat) return;
    const current = seat.context_sources;
    const next = current.includes(sourceId)
      ? current.filter((s) => s !== sourceId)
      : [...current, sourceId];
    updateSeatField(seatId, "context_sources", next);
  };

  const currentEdit = editState.get(activeSeat);
  const agentName =
    ROLE_DISPLAY_NAMES[
      (SEAT_IDS.indexOf(activeSeat as (typeof SEAT_IDS)[number]) >= 0
        ? ["Lead", "Forecaster", "Future PM", "Quant", "Skeptic"][
            SEAT_IDS.indexOf(activeSeat as (typeof SEAT_IDS)[number])
          ]
        : "Lead") as keyof typeof ROLE_DISPLAY_NAMES
    ] ?? activeSeat;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 overflow-hidden"
      onKeyDown={handleKeyDown}
      style={{
        background: "color-mix(in srgb, var(--fintheon-bg) 92%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-label="Arbitrum Settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/15 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)]">
            {mode === "health" ? "Health" : "Edit Agent Instructions"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded"
          aria-label="Close settings"
        >
          <X className="w-4 h-4 text-[var(--fintheon-text)]/60" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {mode === "health" ? (
          <div className="flex flex-col gap-3">
            {/* Context Injection */}
            <button
              onClick={() => toggleRow("context")}
              className="w-full text-left border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/75">
                  Context Injection
                </span>
                <span className="text-[10px] text-[var(--fintheon-text)]/40 font-mono">
                  {expandedRows.has("context") ? "▼" : "▶"}
                </span>
              </div>
              {expandedRows.has("context") && health && (
                <div className="mt-2 space-y-1 text-[10px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      Econ Context
                    </span>
                    <StatusDot
                      on={health.context_injection.econ_context_loaded}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      Commentary
                    </span>
                    <StatusDot
                      on={health.context_injection.commentary_loaded}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      IV Simulation
                    </span>
                    <StatusDot
                      on={health.context_injection.iv_simulation_present}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      RiskFlow Feed
                    </span>
                    <StatusDot
                      on={health.context_injection.riskflow_feed_injected}
                    />
                  </div>
                </div>
              )}
            </button>

            {/* API Status */}
            <button
              onClick={() => toggleRow("api")}
              className="w-full text-left border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/75">
                  API Status
                </span>
                <span className="text-[10px] text-[var(--fintheon-text)]/40 font-mono">
                  {expandedRows.has("api") ? "▼" : "▶"}
                </span>
              </div>
              {expandedRows.has("api") && health && (
                <div className="mt-2 space-y-1 text-[10px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      DeepSeek Key
                    </span>
                    <StatusDot on={health.api_status.deepseek_api_key_set} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--fintheon-text)]/50">
                      DeepSeek Reachable
                    </span>
                    <StatusDot on={health.api_status.deepseek_reachable} />
                  </div>
                  {health.api_status.last_latency_ms != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--fintheon-text)]/50">
                        Last Latency
                      </span>
                      <span className="text-[var(--fintheon-text)]/70">
                        {health.api_status.last_latency_ms}ms
                      </span>
                    </div>
                  )}
                  {health.api_status.last_error && (
                    <div className="text-[var(--fintheon-bearish)] text-[9px]">
                      {health.api_status.last_error}
                    </div>
                  )}
                </div>
              )}
            </button>

            {/* Last Confidence */}
            <button
              onClick={() => toggleRow("confidence")}
              className="w-full text-left border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/75">
                  Last Confidence Reading
                </span>
                <span className="text-[10px] text-[var(--fintheon-text)]/40 font-mono">
                  {expandedRows.has("confidence") ? "▼" : "▶"}
                </span>
              </div>
              {expandedRows.has("confidence") &&
                health &&
                health.last_confidence && (
                  <div className="mt-2 space-y-1 text-[10px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--fintheon-text)]/50">
                        Chamber Confidence
                      </span>
                      <span className="text-[var(--fintheon-text)]/70">
                        {(
                          health.last_confidence.chamber_confidence * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--fintheon-text)]/50">
                        State
                      </span>
                      <span className="text-[var(--fintheon-text)]/70 uppercase">
                        {health.chamber_state}
                      </span>
                    </div>
                  </div>
                )}
              {expandedRows.has("confidence") &&
                health &&
                !health.last_confidence && (
                  <div className="mt-2 text-[10px] text-[var(--fintheon-text)]/35 font-mono">
                    No verdict recorded yet.
                  </div>
                )}
            </button>

            {healthLoading && (
              <div className="text-[9px] text-[var(--fintheon-text)]/35">
                Loading health...
              </div>
            )}

            {/* CTA to editor */}
            <button
              onClick={() => setMode("editor")}
              className="mt-2 px-3 py-2 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors self-start"
            >
              Edit Agent Instructions
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Seat tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {SEAT_IDS.map((sid) => {
                const agent =
                  ROLE_DISPLAY_NAMES[
                    (
                      [
                        "Lead",
                        "Forecaster",
                        "Future PM",
                        "Quant",
                        "Skeptic",
                      ] as const
                    )[SEAT_IDS.indexOf(sid)]
                  ] ?? sid;
                return (
                  <button
                    key={sid}
                    onClick={() => setActiveSeat(sid)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono border-b-2 transition-colors shrink-0 ${
                      activeSeat === sid
                        ? "border-[var(--fintheon-accent)] text-[var(--fintheon-accent)]"
                        : "border-transparent text-[var(--fintheon-text)]/45 hover:text-[var(--fintheon-text)]/70"
                    }`}
                  >
                    {agent}
                  </button>
                );
              })}
            </div>

            {/* Seat editor */}
            {currentEdit && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/50 mb-1 font-mono">
                    Prompt Override
                  </label>
                  <textarea
                    value={currentEdit.override_prompt}
                    onChange={(e) =>
                      updateSeatField(
                        activeSeat,
                        "override_prompt",
                        e.target.value,
                      )
                    }
                    rows={6}
                    className="w-full bg-[#0b0b08] border border-[var(--fintheon-accent)]/20 p-2 text-[11px] font-mono text-[var(--fintheon-text)]/80 resize-y outline-none focus:border-[var(--fintheon-accent)]/50"
                    style={{ fontFamily: "Doto, ui-monospace, monospace" }}
                    placeholder="Additional instructions for this seat..."
                  />
                </div>

                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/50 mb-1.5 font-mono">
                    Context Sources
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTEXT_SOURCE_OPTIONS.map((opt) => {
                      const checked = currentEdit.context_sources.includes(
                        opt.id,
                      );
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-1 px-2 py-1 text-[9px] border cursor-pointer ${
                            checked
                              ? "border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8"
                              : "border-[var(--fintheon-accent)]/15 text-[var(--fintheon-text)]/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleContextSource(activeSeat, opt.id)
                            }
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/50 mb-1 font-mono">
                    Category Filter
                  </label>
                  <select
                    value={currentEdit.category_filter}
                    onChange={(e) =>
                      updateSeatField(
                        activeSeat,
                        "category_filter",
                        e.target.value,
                      )
                    }
                    className="w-full bg-[#0b0b08] border border-[var(--fintheon-accent)]/20 p-2 text-[11px] font-mono text-[var(--fintheon-text)]/80 outline-none focus:border-[var(--fintheon-accent)]/50"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/20 disabled:opacity-40 transition-colors"
              >
                <Check className="w-3 h-3" />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/15 text-[var(--fintheon-text)]/50 hover:text-[var(--fintheon-text)]/80 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={() => setMode("health")}
                className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/40 hover:text-[var(--fintheon-text)]/70 transition-colors ml-auto"
              >
                Back to Health
              </button>
            </div>

            {saveMsg && (
              <div
                className={`text-[10px] ${
                  saveMsg === "Saved"
                    ? "text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-bearish)]"
                }`}
              >
                {saveMsg}
              </div>
            )}

            {overridesError && (
              <div className="text-[10px] text-[var(--fintheon-bearish)]">
                {overridesError}
              </div>
            )}

            {/* Reset confirmation */}
            {showResetConfirm && (
              <div className="border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] p-3">
                <p className="text-[10px] text-[var(--fintheon-text)]/70 mb-2">
                  Reset ALL seat overrides to factory defaults? This cannot be
                  undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1 text-[10px] uppercase tracking-wider bg-[var(--fintheon-bearish)]/15 text-[var(--fintheon-bearish)] border border-[var(--fintheon-bearish)]/30"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-text)]/50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ on }: { on: boolean }) {
  const color = on ? "var(--fintheon-accent)" : "var(--fintheon-muted)";
  const symbol = on ? "●" : "○";
  return (
    <span className="text-[10px]" style={{ color }}>
      {symbol}
    </span>
  );
}

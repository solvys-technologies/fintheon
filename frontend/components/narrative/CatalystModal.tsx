// [claude-code 2026-03-28] S7: Proper dropdowns for instruments, tag autocomplete, styled selects
// [claude-code 2026-03-28] S5-T3: Rich add/edit modal for catalyst cards
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { useNarrative } from "../../contexts/NarrativeContext";
import type {
  CatalystCard,
  NarrativeCategory,
} from "../../lib/narrative-types";

const CATEGORIES: { value: NarrativeCategory; label: string }[] = [
  { value: "geopolitical", label: "Geopolitical" },
  { value: "monetary", label: "Monetary" },
  { value: "macroeconomic", label: "Macroeconomic" },
  { value: "earnings", label: "Earnings" },
  { value: "market-structure", label: "Market Structure" },
  { value: "supply-chain", label: "Supply Chain" },
  { value: "black-swan", label: "Black Swan" },
];

const ALL_INSTRUMENTS = [
  "/NQ",
  "/ES",
  "/YM",
  "/RTY",
  "/CL",
  "/GC",
  "/ZB",
  "/ZN",
  "/VX",
  "/6E",
  "/6J",
  "/NG",
  "/MNQ",
  "/MES",
  "/MCL",
  "DXY",
  "BTC",
  "SPY",
  "IWM",
  "TLT",
  "GLD",
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "AMD",
  "PLTR",
  "ASML",
  "JPMC",
  "WMT",
  "XLE",
  "XLF",
  "VIX",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCNH",
];

const DIRECTIONS = ["bullish", "bearish", "neutral"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const STATUSES = ["active", "monitoring", "resolved"] as const;

interface CatalystModalProps {
  open: boolean;
  onClose: () => void;
  editCard?: CatalystCard | null;
}

export function CatalystModal({ open, onClose, editCard }: CatalystModalProps) {
  const { state, dispatch } = useNarrative();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NarrativeCategory | "">("");
  const [directionBias, setDirectionBias] = useState<
    "bullish" | "bearish" | "neutral"
  >("neutral");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [instruments, setInstruments] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"active" | "monitoring" | "resolved">(
    "active",
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState("");
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false);
  const instrumentDropdownRef = useRef<HTMLDivElement>(null);

  // Populate fields when editing
  useEffect(() => {
    if (!open) return;
    if (editCard) {
      setTitle(editCard.title);
      setDescription(editCard.description);
      setCategory(editCard.category ?? "");
      setDirectionBias(editCard.directionBias ?? "neutral");
      setSeverity(editCard.severity);
      setInstruments((editCard.narrativeIds ?? []).join(", "));
      setDate(
        editCard.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      );
      setEndDate(editCard.dateRange?.end ?? "");
      setStatus((editCard.status as typeof status) ?? "active");
      setTags(editCard.tags ?? []);
    } else {
      setTitle("");
      setDescription("");
      setCategory("");
      setDirectionBias("neutral");
      setSeverity("medium");
      setInstruments("");
      setDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setStatus("active");
      setTags([]);
    }
    setCategoryError(false);
  }, [open, editCard]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const raw = tagInput.trim().replace(/,$/, "");
        if (raw && !tags.includes(raw)) setTags((prev) => [...prev, raw]);
        setTagInput("");
      }
    },
    [tagInput, tags],
  );

  const removeTag = useCallback((t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  }, []);

  // Parse selected instruments from comma-separated string
  const selectedInstruments = useMemo(
    () =>
      instruments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [instruments],
  );

  const toggleInstrument = useCallback((inst: string) => {
    setInstruments((prev) => {
      const list = prev
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.includes(inst)) return list.filter((i) => i !== inst).join(", ");
      return [...list, inst].join(", ");
    });
  }, []);

  const filteredInstruments = useMemo(
    () =>
      instrumentFilter
        ? ALL_INSTRUMENTS.filter((i) =>
            i.toLowerCase().includes(instrumentFilter.toLowerCase()),
          )
        : ALL_INSTRUMENTS,
    [instrumentFilter],
  );

  // Tag autocomplete from all existing tags in state
  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const c of state.catalysts) {
      for (const t of c.tags ?? []) tagSet.add(t);
    }
    return [...tagSet].sort();
  }, [state.catalysts]);

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    return allExistingTags
      .filter(
        (t) =>
          t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t),
      )
      .slice(0, 8);
  }, [tagInput, allExistingTags, tags]);

  // Close instrument dropdown on outside click
  useEffect(() => {
    if (!instrumentDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        instrumentDropdownRef.current &&
        !instrumentDropdownRef.current.contains(e.target as Node)
      ) {
        setInstrumentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [instrumentDropdownOpen]);

  const handleSave = useCallback(() => {
    if (!category) {
      setCategoryError(true);
      return;
    }
    const parsedInstruments = instruments
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editCard) {
      dispatch({
        type: "UPDATE_CATALYST",
        id: editCard.id,
        updates: {
          title,
          description,
          category,
          directionBias,
          severity,
          date,
          tags,
          status,
          dateRange: { start: date, end: endDate || null },
          sentiment:
            directionBias === "neutral"
              ? editCard.sentiment
              : directionBias === "bullish"
                ? "bullish"
                : "bearish",
        },
      });
    } else {
      dispatch({
        type: "ADD_CATALYST",
        catalyst: {
          title,
          description,
          date,
          sentiment: directionBias === "bullish" ? "bullish" : "bearish",
          severity,
          source: "user",
          narrativeIds: parsedInstruments,
          isGhost: false,
          templateType: null,
          position: null,
          tags,
          category,
          directionBias,
          status,
          dateRange: { start: date, end: endDate || null },
          drillDepth: 0,
        },
      });
    }
    handleClose();
  }, [
    title,
    description,
    category,
    directionBias,
    severity,
    instruments,
    date,
    endDate,
    status,
    tags,
    editCard,
    dispatch,
    handleClose,
  ]);

  if (!open && !isClosing) return null;

  const isImported = editCard?.source === "riskflow-import";

  return (
    <div
      ref={backdropRef}
      className={`fintheon-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? "animate-fade-out-backdrop" : "animate-fade-in-backdrop"}`}
      onClick={(e) => {
        if (e.target === backdropRef.current) handleClose();
      }}
    >
      <div
        className={`fintheon-modal-surface w-full max-w-lg max-h-[85vh] flex flex-col ${isClosing ? "animate-fade-out" : "animate-fade-in"}`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <h2
              className="text-sm font-bold"
              style={{ color: "var(--fintheon-accent)" }}
            >
              {editCard ? "Edit Catalyst" : "Add Catalyst"}
            </h2>
            {isImported && (
              <span
                className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
                style={{
                  color: "var(--fintheon-accent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                }}
              >
                Imported from RiskFlow
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/5 rounded"
          >
            <X className="w-4 h-4" style={{ color: "var(--fintheon-muted)" }} />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Title */}
          <label className="flex flex-col gap-1">
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Title *
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs bg-transparent border rounded px-2 py-1.5 outline-none focus:border-[var(--fintheon-accent)]"
              style={{
                color: "var(--fintheon-text)",
                borderColor:
                  "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                colorScheme: "dark",
              }}
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs bg-transparent border rounded px-2 py-1.5 outline-none resize-none focus:border-[var(--fintheon-accent)]"
              style={{
                color: "var(--fintheon-text)",
                borderColor:
                  "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                colorScheme: "dark",
              }}
            />
          </label>

          {/* Category */}
          <label className="flex flex-col gap-1">
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Category *
            </span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as NarrativeCategory);
                setCategoryError(false);
              }}
              className="text-xs bg-transparent border rounded px-2 py-1.5 outline-none focus:border-[var(--fintheon-accent)]"
              style={{
                color: "var(--fintheon-text)",
                borderColor: categoryError
                  ? "var(--fintheon-bearish)"
                  : "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                colorScheme: "dark",
              }}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {categoryError && (
              <span
                className="text-[9px]"
                style={{ color: "var(--fintheon-bearish)" }}
              >
                Category required
              </span>
            )}
          </label>

          {/* Direction + Severity row */}
          <div className="grid grid-cols-2 gap-3">
            <fieldset className="flex flex-col gap-1">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Direction
              </span>
              <div className="flex gap-1">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirectionBias(d)}
                    className="flex-1 text-[10px] py-1 rounded border font-mono uppercase transition-colors"
                    style={{
                      color:
                        directionBias === d
                          ? "var(--fintheon-bg)"
                          : "var(--fintheon-muted)",
                      backgroundColor:
                        directionBias === d
                          ? d === "bullish"
                            ? "var(--fintheon-bullish)"
                            : d === "bearish"
                              ? "var(--fintheon-bearish)"
                              : "var(--fintheon-accent)"
                          : "transparent",
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-border) 30%, transparent)",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Severity
              </span>
              <div className="flex gap-1">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className="flex-1 text-[10px] py-1 rounded border font-mono uppercase transition-colors"
                    style={{
                      color:
                        severity === s
                          ? "var(--fintheon-bg)"
                          : "var(--fintheon-muted)",
                      backgroundColor:
                        severity === s
                          ? s === "high"
                            ? "var(--fintheon-bearish)"
                            : s === "medium"
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-muted)"
                          : "transparent",
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-border) 30%, transparent)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Instruments — multi-select dropdown */}
          <div className="flex flex-col gap-1" ref={instrumentDropdownRef}>
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Instruments
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setInstrumentDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-mono bg-transparent border rounded px-2 py-1.5 outline-none text-left"
                style={{
                  color: "var(--fintheon-text)",
                  borderColor: instrumentDropdownOpen
                    ? "var(--fintheon-accent)"
                    : "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                }}
              >
                <span
                  className={selectedInstruments.length ? "" : "opacity-40"}
                >
                  {selectedInstruments.length
                    ? selectedInstruments.join(", ")
                    : "Select instruments..."}
                </span>
                <ChevronDown className="w-3 h-3 opacity-40" />
              </button>
              {instrumentDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded border shadow-lg"
                  style={{
                    backgroundColor: "var(--fintheon-bg)",
                    borderColor:
                      "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                  }}
                >
                  <input
                    value={instrumentFilter}
                    onChange={(e) => setInstrumentFilter(e.target.value)}
                    placeholder="Search..."
                    autoFocus
                    className="w-full text-[10px] px-2 py-1.5 bg-transparent border-b outline-none"
                    style={{
                      color: "var(--fintheon-text)",
                      borderColor:
                        "color-mix(in srgb, var(--fintheon-border) 20%, transparent)",
                    }}
                  />
                  {filteredInstruments.map((inst) => {
                    const isSelected = selectedInstruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleInstrument(inst)}
                        className="w-full flex items-center gap-2 px-2 py-1 text-[10px] font-mono hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                        style={{
                          color: isSelected
                            ? "var(--fintheon-accent)"
                            : "var(--fintheon-text)",
                        }}
                      >
                        <span
                          className="w-3 h-3 flex items-center justify-center rounded border text-[8px]"
                          style={{
                            borderColor: isSelected
                              ? "var(--fintheon-accent)"
                              : "var(--fintheon-border)",
                            backgroundColor: isSelected
                              ? "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)"
                              : "transparent",
                          }}
                        >
                          {isSelected && <Check className="w-2 h-2" />}
                        </span>
                        {inst}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Date + End Date + Status row */}
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Date *
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-[10px] bg-transparent border rounded px-2 py-1.5 outline-none focus:border-[var(--fintheon-accent)]"
                style={{
                  color: "var(--fintheon-text)",
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                  colorScheme: "dark",
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--fintheon-muted)" }}
              >
                End Date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[10px] bg-transparent border rounded px-2 py-1.5 outline-none focus:border-[var(--fintheon-accent)]"
                style={{
                  color: "var(--fintheon-text)",
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                  colorScheme: "dark",
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--fintheon-muted)" }}
              >
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="text-[10px] bg-transparent border rounded px-2 py-1.5 outline-none focus:border-[var(--fintheon-accent)]"
                style={{
                  color: "var(--fintheon-text)",
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
                  colorScheme: "dark",
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Tags — with autocomplete */}
          <div className="flex flex-col gap-1 relative">
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--fintheon-muted)" }}
            >
              Tags
            </span>
            <div
              className="flex flex-wrap items-center gap-1 p-1.5 rounded border"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--fintheon-border) 40%, transparent)",
              }}
            >
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1"
                  style={{
                    color: "var(--fintheon-accent)",
                    backgroundColor:
                      "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
                    borderColor:
                      "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                  }}
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    className="opacity-50 hover:opacity-100 text-[8px] leading-none"
                    style={{ color: "var(--fintheon-accent)" }}
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagSuggestionsOpen(true);
                }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setTagSuggestionsOpen(true)}
                onBlur={() =>
                  setTimeout(() => setTagSuggestionsOpen(false), 150)
                }
                placeholder="Type to add tag..."
                className="text-[9px] flex-1 min-w-[80px] px-1 py-0.5 bg-transparent outline-none"
                style={{ color: "var(--fintheon-text)" }}
              />
            </div>
            {/* Tag suggestions dropdown */}
            {tagSuggestionsOpen && tagSuggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 max-h-32 overflow-y-auto rounded border shadow-lg"
                style={{
                  backgroundColor: "var(--fintheon-bg)",
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                }}
              >
                {tagSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTags((prev) => [...prev, s]);
                      setTagInput("");
                      setTagSuggestionsOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[9px] font-mono hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                    style={{ color: "var(--fintheon-accent)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={handleClose}
            className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
            style={{
              color: "var(--fintheon-muted)",
              borderColor:
                "color-mix(in srgb, var(--fintheon-border) 30%, transparent)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded border font-medium transition-colors hover:brightness-110"
            style={{
              color: "var(--fintheon-bg)",
              backgroundColor: "var(--fintheon-accent)",
              borderColor: "var(--fintheon-accent)",
            }}
          >
            {editCard ? "Save Changes" : "Add Catalyst"}
          </button>
        </div>
      </div>
    </div>
  );
}

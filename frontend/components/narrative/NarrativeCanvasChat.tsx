// [claude-code 2026-03-28] S8-T2: Ephemeral command palette chat — expandable above toolbar
// Same Claude CLI session as sidebar Chat. Responses auto-hide after 8s.
import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Send, X } from "lucide-react";
import { useNarrative } from "../../contexts/NarrativeContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface NarrativeCanvasChatProps {
  /** Card data chips dragged or added from canvas */
  pendingChips?: { id: string; title: string }[];
  onClearChip?: (id: string) => void;
}

export function NarrativeCanvasChat({
  pendingChips = [],
  onClearChip,
}: NarrativeCanvasChatProps) {
  const { dispatch } = useNarrative();
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseVisible, setResponseVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-expand when user starts typing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      if (!expanded && e.target.value.length > 0) setExpanded(true);
    },
    [expanded],
  );

  // Auto-hide response after 8s
  useEffect(() => {
    if (responseVisible) {
      hideTimerRef.current = setTimeout(() => {
        setResponseVisible(false);
        setResponse(null);
      }, 8000);
      return () => clearTimeout(hideTimerRef.current);
    }
  }, [responseVisible]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");

    // Build context from pending chips
    const chipContext =
      pendingChips.length > 0
        ? `\n\nReferenced cards: ${pendingChips.map((c) => c.title).join(", ")}`
        : "";

    try {
      const res = await fetch(`${API_BASE}/api/narrative/score-riskflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: `user-${Date.now()}`,
              headline: text,
              summary: text + chipContext,
              source: "user",
              severity: "medium",
              tags: [],
              publishedAt: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!res.ok) throw new Error(`Score failed: ${res.status}`);
      const { scored } = await res.json();

      if (scored && scored.length > 0) {
        for (const item of scored) {
          dispatch({
            type: "ADD_CATALYST",
            catalyst: {
              title: item.suggestedTitle || text,
              description: item.suggestedDescription || text,
              date: new Date().toISOString().slice(0, 10),
              sentiment: item.sentiment ?? "bearish",
              severity: item.severity ?? "medium",
              source: "agent",
              narrativeIds: item.tickers ?? [],
              isGhost: false,
              templateType: null,
              position: null,
              tags: item.themes ?? [],
              category: undefined,
              drillDepth: 0,
            },
          });
        }
        setResponse(
          `Added ${scored.length} event${scored.length !== 1 ? "s" : ""} to the Observatory.`,
        );
      } else {
        setResponse("No scoreable events found. Try adding more context.");
      }
    } catch (err) {
      console.error("[CanvasChat] Scoring failed:", err);
      // Fallback: add as user event
      dispatch({
        type: "ADD_CATALYST",
        catalyst: {
          title: text,
          description: chipContext || "",
          date: new Date().toISOString().slice(0, 10),
          sentiment: "bearish",
          severity: "medium",
          source: "user",
          narrativeIds: [],
          isGhost: false,
          templateType: null,
          position: null,
          tags: [],
          category: "macroeconomic",
          drillDepth: 0,
        },
      });
      setResponse("Added as user event (scoring unavailable).");
    } finally {
      setLoading(false);
      setResponseVisible(true);
      setExpanded(false);
      // Clear chips after submission
      pendingChips.forEach((c) => onClearChip?.(c.id));
    }
  }, [input, loading, pendingChips, onClearChip, dispatch]);

  const dismissResponse = useCallback(() => {
    setResponseVisible(false);
    setResponse(null);
    clearTimeout(hideTimerRef.current);
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* Ephemeral response popup — slides up from input */}
      {responseVisible && response && (
        <div
          className="absolute bottom-full mb-2 w-[400px] px-3 py-2 rounded-xl border flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--fintheon-surface) 95%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
          }}
        >
          <p
            className="flex-1 text-[11px] leading-relaxed"
            style={{
              color: "var(--fintheon-text)",
              fontFamily: "var(--font-body)",
            }}
          >
            {response}
          </p>
          <button
            onClick={dismissResponse}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors shrink-0"
            style={{ color: "var(--fintheon-muted)" }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Chat input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200"
        style={{
          width: expanded ? 440 : 320,
          backgroundColor:
            "color-mix(in srgb, var(--fintheon-surface) 90%, transparent)",
          borderColor: expanded
            ? "color-mix(in srgb, var(--fintheon-accent) 30%, transparent)"
            : "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Persona indicator: pulsing green dot */}
        <div className="relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
        </div>

        {/* Pending card chips */}
        {pendingChips.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {pendingChips.slice(0, 2).map((chip) => (
              <span
                key={chip.id}
                className="text-[8px] px-1.5 py-0.5 rounded-full border flex items-center gap-1"
                style={{
                  color: "var(--fintheon-accent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
                }}
              >
                <span className="truncate max-w-[60px]">{chip.title}</span>
                <button
                  onClick={() => onClearChip?.(chip.id)}
                  className="opacity-50 hover:opacity-100"
                >
                  <X className="w-2 h-2" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setExpanded(false);
              setInput("");
            }
          }}
          onFocus={() => setExpanded(true)}
          onBlur={() => {
            if (!input.trim()) setExpanded(false);
          }}
          placeholder="Message Harper-Opus..."
          className="flex-1 text-[11px] bg-transparent outline-none min-w-0"
          style={{
            color: "var(--fintheon-text)",
            fontFamily: "var(--font-body)",
          }}
          disabled={loading}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-30 shrink-0"
          style={{ color: "var(--fintheon-accent)" }}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

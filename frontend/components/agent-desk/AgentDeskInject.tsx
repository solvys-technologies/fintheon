// [claude-code 2026-04-05] Fixed 404: added API_BASE to fetch call (was using relative URL)
// [claude-code 2026-03-16] God's Eye View — variable injection modal for AgentDesk
import { useState, useCallback } from "react";
import { X, Zap } from "@/components/shared/iso-icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface AgentDeskInjectProps {
  open: boolean;
  onClose: () => void;
  simulationId: string | null;
  narratives: Array<{ id: string; title: string }>;
}

export function AgentDeskInject({
  open,
  onClose,
  simulationId,
  narratives,
}: AgentDeskInjectProps) {
  const [variable, setVariable] = useState("");
  const [selectedNarratives, setSelectedNarratives] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleNarrative = useCallback((id: string) => {
    setSelectedNarratives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!simulationId || !variable.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/agent-desk/inject/${simulationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variable: variable.trim(),
            targetNarrativeIds: [...selectedNarratives],
            description: `User-injected scenario: ${variable.trim()}`,
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setResult("Variable injected — simulation re-running");
        setVariable("");
      } else {
        setResult(data.error || "Injection failed");
      }
    } catch {
      setResult("Connection error");
    } finally {
      setSubmitting(false);
    }
  }, [simulationId, variable, selectedNarratives]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-96 rounded-xl border p-5"
        style={{
          backgroundColor: "rgba(10, 10, 0, 0.95)",
          borderColor: "rgba(212, 175, 55, 0.25)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Zap
            className="w-4 h-4"
            style={{ color: "var(--fintheon-accent)" }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--fintheon-text)" }}
          >
            God&apos;s Eye View
          </h3>
        </div>

        <p className="text-[11px] text-gray-500 mb-4">
          Inject a hypothetical variable into the running simulation to see how
          agents react.
        </p>

        {/* Variable input */}
        <div className="mb-4">
          <label className="block text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider">
            What if…
          </label>
          <input
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            placeholder="Fed cuts 50bp surprise, China invades Taiwan…"
            className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-900/60 border
              text-[var(--fintheon-text)] placeholder-gray-600
              focus:outline-none focus:border-[var(--fintheon-accent)]/50"
            style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
          />
        </div>

        {/* Narrative selector */}
        <div className="mb-4">
          <label className="block text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider">
            Target Narratives
          </label>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {narratives.map((n) => (
              <label
                key={n.id}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer
                  hover:bg-white/5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedNarratives.has(n.id)}
                  onChange={() => toggleNarrative(n.id)}
                  className="w-3 h-3 rounded accent-[var(--fintheon-accent)]"
                />
                <span className="text-[11px] text-gray-300 truncate">
                  {n.title}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Result message */}
        {result && (
          <p
            className={`text-[11px] mb-3 ${result.includes("error") || result.includes("failed") ? "text-red-400" : "text-emerald-400"}`}
          >
            {result}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !variable.trim() || !simulationId}
          className="w-full py-2 rounded-lg text-xs font-medium
            transition-colors disabled:opacity-30"
          style={{
            backgroundColor: "rgba(212, 175, 55, 0.15)",
            color: "var(--fintheon-accent)",
          }}
        >
          {submitting ? "Injecting…" : "Run Scenario"}
        </button>
      </div>
    </div>
  );
}

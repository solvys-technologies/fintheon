import { useCallback, useEffect, useState } from "react";
import { Loader2, PencilLine, Send, Sparkles, Trash2 } from "lucide-react";
import { useBackend } from "../../lib/backend";
import { useToast } from "../../contexts/ToastContext";
import { FadingRuler } from "../shared/FadingRuler";
import type { WatchlistPhrase } from "../../lib/services/riskflow";

const INTELLIGENCE_LEVELS = ["Standard", "Sharp", "Deep"];

export function WatchTagsTab() {
  const backend = useBackend();
  const { addToast } = useToast();
  const [phrases, setPhrases] = useState<WatchlistPhrase[]>([]);
  const [input, setInput] = useState("");
  const [level, setLevel] = useState(INTELLIGENCE_LEVELS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await backend.riskflow.getPhrases();
      setPhrases(result.phrases ?? []);
    } finally {
      setLoading(false);
    }
  }, [backend.riskflow]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async () => {
    const raw = input.trim();
    if (!raw || saving) return;
    setSaving(true);
    try {
      const refined = await backend.riskflow.refinePhrase({
        phrase: raw,
        intelligenceLevel: level,
      });
      if (editingId) {
        await backend.riskflow.updatePhrase(editingId, {
          phrase: refined.phrase,
          repeating: true,
        });
        addToast("WatchTag updated", "success");
      } else {
        await backend.riskflow.addPhrase({
          phrase: refined.phrase,
          repeating: true,
        });
        addToast("WatchTag added", "success");
      }
      setInput("");
      setEditingId(null);
      await refresh();
      window.dispatchEvent(new Event("fintheon:watchtags-refetch"));
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "WatchTag failed",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (phrase: WatchlistPhrase) => {
    setSelectedId(phrase.id);
    setEditingId(phrase.id);
    setInput(phrase.phrase);
  };

  const remove = async (phrase: WatchlistPhrase) => {
    setSelectedId(phrase.id);
    await backend.riskflow.deletePhrase(phrase.id);
    await refresh();
    window.dispatchEvent(new Event("fintheon:watchtags-refetch"));
  };

  return (
    <div className="animate-in fade-in duration-150">
      <div className="rounded-full border border-[var(--fintheon-accent)]/14 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-[var(--fintheon-accent)]/70" />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Watch for..."
            className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-muted)]/42"
          />
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--fintheon-accent)]/14 px-1 py-0.5">
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="bg-transparent font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] outline-none"
            >
              {INTELLIGENCE_LEVELS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!input.trim() || saving}
              className="rounded-full p-1 text-[var(--fintheon-accent)] transition disabled:opacity-30"
              title={editingId ? "Update WatchTag" : "Add WatchTag"}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--fintheon-accent)]/45" />
          </div>
        ) : phrases.length === 0 ? (
          <p className="text-[11px] text-[var(--fintheon-muted)]/52">
            No WatchTags yet.
          </p>
        ) : (
          phrases.map((phrase, index) => (
            <div key={phrase.id}>
              {index > 0 ? <FadingRuler className="my-2 opacity-45" /> : null}
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[11px]"
                onClick={() => setSelectedId(phrase.id)}
              >
                <div className="min-w-0">
                  <p
                    className={`truncate font-semibold ${
                      selectedId === phrase.id
                        ? "text-[var(--fintheon-accent)]"
                        : "text-[var(--fintheon-text)]/82"
                    }`}
                  >
                    {phrase.phrase}
                  </p>
                  <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]/45">
                    {phrase.matchCount} matches /{" "}
                    {formatLastMatch(phrase.lastMatchedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(phrase)}
                  className="rounded p-1 text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)]"
                  title="Edit WatchTag"
                >
                  <PencilLine className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(phrase)}
                  className="rounded p-1 text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-bearish)]"
                  title="Delete WatchTag"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatLastMatch(value: string | null) {
  if (!value) return "no match yet";
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return "matched";
  const minutes = Math.max(1, Math.round(delta / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

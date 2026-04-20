// [claude-code 2026-04-18] S24-T4: Classification Matrix editor — per-regime rubric
import { useState, useEffect, useCallback } from "react";
import { Layers } from "@/components/shared/iso-icons";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface MatrixRow {
  id: string;
  regime_type: string;
  rubric: {
    stance?: Record<string, string>;
    required_keywords?: string[];
    forbidden_keywords?: string[];
    walk_back_pairings?: { from: string; to: string }[];
    description?: string;
  };
  active: boolean;
  updated_by?: string;
  updated_at?: string;
}

function parseJsonSafe(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

export function MatrixEditor() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [selectedRegime, setSelectedRegime] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [notReady, setNotReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/classification-matrix`);
      if (res.status === 404) {
        setNotReady(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: MatrixRow[] };
      setRows(data.rows ?? []);
      if (data.rows?.length && !selectedRegime) {
        setSelectedRegime(data.rows[0].regime_type);
        setDraft(JSON.stringify(data.rows[0].rubric, null, 2));
      }
    } catch {
      setNotReady(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRegime]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.regime_type === selectedRegime);

  const onSelect = (regime: string) => {
    const row = rows.find((r) => r.regime_type === regime);
    if (row) {
      setSelectedRegime(regime);
      setDraft(JSON.stringify(row.rubric, null, 2));
    }
  };

  const onSave = async () => {
    if (!selected) return;
    const parsed = parseJsonSafe(draft);
    if (!parsed.ok) {
      addToast("Invalid rubric JSON", "error", parsed.error);
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_BASE}/api/classification-matrix/${encodeURIComponent(selected.regime_type)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ rubric: parsed.value }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast(`${selected.regime_type} rubric saved`, "success");
      await load();
    } catch (err) {
      addToast(
        "Save failed",
        "error",
        err instanceof Error ? err.message : "Unknown",
      );
    } finally {
      setSaving(false);
    }
  };

  if (notReady) {
    return (
      <div
        style={{
          padding: "10px 12px",
          border: "1px dashed var(--fintheon-glass-border)",
          borderRadius: 4,
          fontSize: 11,
          color: "var(--fintheon-muted)",
          fontFamily: "var(--font-data)",
          letterSpacing: "0.04em",
          lineHeight: 1.5,
        }}
      >
        Classification Matrix endpoints not yet live — lands with T1.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Layers size={14} color="var(--fintheon-accent)" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fintheon-text)",
            letterSpacing: "0.02em",
          }}
        >
          Classification Matrix
        </span>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: "var(--fintheon-muted)" }}>
          Loading…
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r.regime_type)}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  fontFamily: "var(--font-data)",
                  letterSpacing: "0.04em",
                  color:
                    r.regime_type === selectedRegime
                      ? "var(--fintheon-bg)"
                      : "var(--fintheon-text)",
                  background:
                    r.regime_type === selectedRegime
                      ? "var(--fintheon-accent)"
                      : "transparent",
                  border: "1px solid var(--fintheon-glass-border)",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {r.regime_type}
              </button>
            ))}
          </div>

          {selected && (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                rows={12}
                style={{
                  width: "100%",
                  padding: 8,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "var(--fintheon-text)",
                  background: "var(--fintheon-bg)",
                  border: "1px solid var(--fintheon-glass-border)",
                  borderRadius: 4,
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}
              >
                <button
                  onClick={onSave}
                  disabled={saving}
                  style={{
                    padding: "5px 12px",
                    fontSize: 10,
                    fontFamily: "var(--font-data)",
                    letterSpacing: "0.04em",
                    color: "var(--fintheon-bg)",
                    background: "var(--fintheon-accent)",
                    border: "none",
                    borderRadius: 3,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save rubric"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

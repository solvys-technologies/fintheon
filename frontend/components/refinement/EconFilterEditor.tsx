// [claude-code 2026-04-28] S48-T3: Econ filter editor — table of emoji/word classification
// rules that tag events as Econ/ASAP info. Editable fields: emoji trigger, keyword pattern,
// macro level, category. Built-in mock data when backend API is not available.
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

interface EconFilter {
  id: string;
  emoji: string;
  pattern: string;
  macroLevel: number;
  category: string;
}

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const MOCK_FILTERS: EconFilter[] = [
  {
    id: "1",
    emoji: "CPI",
    pattern: "consumer price index",
    macroLevel: 1,
    category: "Inflation",
  },
  {
    id: "2",
    emoji: "PPI",
    pattern: "producer price index",
    macroLevel: 1,
    category: "Inflation",
  },
  {
    id: "3",
    emoji: "GDP",
    pattern: "gross domestic product",
    macroLevel: 1,
    category: "GDP",
  },
  {
    id: "4",
    emoji: "NFP",
    pattern: "non.?farm payroll",
    macroLevel: 2,
    category: "Job Market",
  },
  {
    id: "5",
    emoji: "JOLTS",
    pattern: "job openings",
    macroLevel: 2,
    category: "Job Market",
  },
  {
    id: "6",
    emoji: "PMI",
    pattern: "purchasing managers",
    macroLevel: 3,
    category: "Supply Chain",
  },
  {
    id: "7",
    emoji: "FOMC",
    pattern: "federal reserve.*meeting",
    macroLevel: 1,
    category: "Fiscal",
  },
];

export function EconFilterEditor() {
  const { getAccessToken } = useAuth();
  const { addToast } = useToast();
  const [filters, setFilters] = useState<EconFilter[]>(MOCK_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<EconFilter>>({});

  const fetchFilters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/econ/filters`, { headers });
      if (res.ok) {
        const json = (await res.json()) as { filters?: EconFilter[] };
        if (json.filters?.length) setFilters(json.filters);
      }
    } catch {
      // Backend may not be live — keep mock data
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchFilters();
  }, [fetchFilters]);

  const startEdit = (f: EconFilter) => {
    setEditingId(f.id);
    setEditDraft({ ...f });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    setFilters((prev) =>
      prev.map((f) =>
        f.id === editingId
          ? {
              ...f,
              emoji: editDraft.emoji ?? f.emoji,
              pattern: editDraft.pattern ?? f.pattern,
              macroLevel: editDraft.macroLevel ?? f.macroLevel,
              category: editDraft.category ?? f.category,
            }
          : f,
      ),
    );
    setEditingId(null);
    setEditDraft({});
    addToast("Filter updated (local only)", "info");
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--fintheon-glass-border)",
        paddingTop: 10,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fintheon-accent)",
          marginBottom: 8,
        }}
      >
        Econ Filter Editor
      </div>

      {error ? (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 10,
            color: "var(--fintheon-bearish)",
            fontFamily: "var(--font-body)",
          }}
        >
          {error}
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-body)",
            fontSize: 10,
          }}
        >
          <thead>
            <tr
              style={{ borderBottom: "1px solid var(--fintheon-glass-border)" }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "3px 5px",
                  fontWeight: 600,
                  color: "var(--fintheon-muted)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  width: 60,
                }}
              >
                Trigger
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px 5px",
                  fontWeight: 600,
                  color: "var(--fintheon-muted)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Pattern
              </th>
              <th
                style={{
                  textAlign: "center",
                  padding: "3px 5px",
                  fontWeight: 600,
                  color: "var(--fintheon-muted)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  width: 32,
                }}
              >
                Lvl
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px 5px",
                  fontWeight: 600,
                  color: "var(--fintheon-muted)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  width: 80,
                }}
              >
                Category
              </th>
              <th style={{ padding: "3px 5px", width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {filters.map((f) => {
              const isEditing = editingId === f.id;
              return (
                <tr
                  key={f.id}
                  style={{
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--fintheon-accent) 6%, transparent)",
                  }}
                >
                  <td
                    style={{
                      padding: "3px 5px",
                      color: "var(--fintheon-accent)",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {isEditing ? (
                      <input
                        value={editDraft.emoji ?? f.emoji}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, emoji: e.target.value }))
                        }
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "1px solid var(--fintheon-glass-border)",
                          color: "var(--fintheon-accent)",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          padding: "1px 3px",
                        }}
                      />
                    ) : (
                      f.emoji
                    )}
                  </td>
                  <td
                    style={{
                      padding: "3px 5px",
                      color: "var(--fintheon-text)",
                    }}
                  >
                    {isEditing ? (
                      <input
                        value={editDraft.pattern ?? f.pattern}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            pattern: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "1px solid var(--fintheon-glass-border)",
                          color: "var(--fintheon-text)",
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          padding: "1px 3px",
                        }}
                      />
                    ) : (
                      f.pattern
                    )}
                  </td>
                  <td
                    style={{
                      padding: "3px 5px",
                      textAlign: "center",
                      color: "var(--fintheon-muted)",
                    }}
                  >
                    {isEditing ? (
                      <select
                        value={editDraft.macroLevel ?? f.macroLevel}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            macroLevel: Number(e.target.value),
                          }))
                        }
                        style={{
                          background: "transparent",
                          border: "1px solid var(--fintheon-glass-border)",
                          color: "var(--fintheon-text)",
                          fontSize: 10,
                          padding: "1px",
                        }}
                      >
                        {[1, 2, 3, 4].map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      f.macroLevel
                    )}
                  </td>
                  <td
                    style={{
                      padding: "3px 5px",
                      color: "var(--fintheon-text)",
                    }}
                  >
                    {isEditing ? (
                      <select
                        value={editDraft.category ?? f.category}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            category: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "1px solid var(--fintheon-glass-border)",
                          color: "var(--fintheon-text)",
                          fontSize: 10,
                          padding: "1px",
                        }}
                      >
                        {[
                          "Inflation",
                          "Job Market",
                          "Supply Chain",
                          "Fiscal",
                        ].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      f.category
                    )}
                  </td>
                  <td style={{ padding: "3px 5px", textAlign: "center" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 2 }}>
                        <button
                          onClick={saveEdit}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--fintheon-accent)",
                            fontSize: 10,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--fintheon-muted)",
                            fontSize: 10,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(f)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--fintheon-muted)",
                          fontSize: 10,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {loading && (
        <div
          style={{
            fontSize: 10,
            color: "var(--fintheon-muted)",
            marginTop: 4,
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

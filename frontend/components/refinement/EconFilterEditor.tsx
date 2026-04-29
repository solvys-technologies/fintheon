// [claude-code 2026-04-28] S48-T3: Econ filter editor — table of emoji/word classification
// rules that tag events as Econ/ASAP info. Inline editing with mock data fallback.
// [claude-code 2026-04-29] S53-T2: Added lastAppliedAt, isMutating, degradedReason
// status indicators for module-level runtime display.
// [claude-code 2026-04-29] S53-T4: fix endpoint path /api/econ/filters → /api/econ-filters
// (contract mismatch — route was registered at /api/econ-filters).
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface EconFilter {
  id: string;
  emoji: string;
  pattern: string;
  macroLevel: number;
  category: string;
}

interface Props {
  lastAppliedAt?: Date | null;
  isMutating?: boolean;
  degradedReason?: string | null;
}

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const CATEGORIES = ["Inflation", "Job Market", "Supply Chain", "Fiscal"];
const LEVELS = [1, 2, 3, 4];

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

const CELL: React.CSSProperties = { padding: "3px 5px", fontSize: 10 };
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--fintheon-glass-border)",
  color: "var(--fintheon-text)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  padding: "1px 3px",
};

const STATUS_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  padding: "3px 6px",
  background:
    "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)",
  borderLeft:
    "2px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
};

export function EconFilterEditor({
  lastAppliedAt,
  isMutating,
  degradedReason,
}: Props) {
  const { getAccessToken } = useAuth();
  const [filters, setFilters] = useState<EconFilter[]>(MOCK_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<EconFilter>>({});

  const fetchFilters = useCallback(async () => {
    setError(null);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/econ-filters`, { headers });
      if (res.ok) {
        const json = (await res.json()) as { filters?: EconFilter[] };
        if (json.filters?.length) setFilters(json.filters);
      }
    } catch {
      // Backend not live — keep mock data
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
      {degradedReason && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-bearish)" }}>degraded</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            {degradedReason}
          </span>
        </div>
      )}
      {isMutating && (
        <div style={STATUS_BAR}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--fintheon-accent)",
              animation: "fuse-shimmer 1.5s infinite",
            }}
          />
          <span style={{ color: "var(--fintheon-accent)" }}>
            applying changes...
          </span>
        </div>
      )}
      {lastAppliedAt && !isMutating && !degradedReason && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-accent)" }}>ok</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            last applied {lastAppliedAt.toLocaleTimeString()}
          </span>
        </div>
      )}
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
              <th style={{ padding: "3px 5px", width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {filters.map((f) => {
              const editing = editingId === f.id;
              const d = editing ? editDraft : {};
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
                      ...CELL,
                      color: "var(--fintheon-accent)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {editing ? (
                      <input
                        value={d.emoji ?? f.emoji}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, emoji: e.target.value }))
                        }
                        style={{
                          ...INPUT_STYLE,
                          color: "var(--fintheon-accent)",
                        }}
                      />
                    ) : (
                      f.emoji
                    )}
                  </td>
                  <td style={{ ...CELL, color: "var(--fintheon-text)" }}>
                    {editing ? (
                      <input
                        value={d.pattern ?? f.pattern}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            pattern: e.target.value,
                          }))
                        }
                        style={INPUT_STYLE}
                      />
                    ) : (
                      f.pattern
                    )}
                  </td>
                  <td
                    style={{
                      ...CELL,
                      textAlign: "center",
                      color: "var(--fintheon-muted)",
                    }}
                  >
                    {editing ? (
                      <select
                        value={d.macroLevel ?? f.macroLevel}
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
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      f.macroLevel
                    )}
                  </td>
                  <td style={{ ...CELL, color: "var(--fintheon-text)" }}>
                    {editing ? (
                      <select
                        value={d.category ?? f.category}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            category: e.target.value,
                          }))
                        }
                        style={{ ...INPUT_STYLE, width: "100%" }}
                      >
                        {CATEGORIES.map((c) => (
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
                    {editing ? (
                      <span style={{ display: "flex", gap: 4 }}>
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
                      </span>
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
    </div>
  );
}

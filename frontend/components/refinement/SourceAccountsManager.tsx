// [claude-code 2026-04-28] S47-T1: Method field added, normalized body keys, field-level errors, General stripped.
// [claude-code 2026-04-25] S38: Body text bumped one tier (text-[10px] → text-[12px], text-[9px] → text-[11px]) for legibility on the Refinement Engine surface.
// [claude-code 2026-04-12] Source accounts manager — CRUD UI for curated X timeline accounts
// [claude-code 2026-04-29] S53-T2: Added lastAppliedAt, isMutating, degradedReason
// status indicators for module-level runtime display.
import { useState, useCallback } from "react";
import {
  Rss,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Power,
} from "lucide-react";
import type {
  SourceAccount,
  SourceAccountCategory,
  SourceAccountMethod,
} from "../../../backend-hono/src/types/source-account";
import {
  SOURCE_ACCOUNT_CATEGORIES,
  SOURCE_ACCOUNT_METHODS,
} from "../../../backend-hono/src/types/source-account";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface SourceAccountsManagerProps {
  accounts: SourceAccount[];
  onAccountsChanged: () => void;
  lastAppliedAt?: Date | null;
  isMutating?: boolean;
  degradedReason?: string | null;
}

const CATEGORY_BADGE: Record<SourceAccountCategory, { color: string }> = {
  Wire: {
    color: "text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30",
  },
  OSINT: { color: "text-cyan-400 border-cyan-400/30" },
  Geopolitical: { color: "text-red-400 border-red-400/30" },
  Macro: { color: "text-emerald-400 border-emerald-400/30" },
  Commentary: { color: "text-violet-300 border-violet-300/30" },
  Custom: {
    color: "text-[var(--fintheon-muted)] border-[var(--fintheon-muted)]/30",
  },
  StockNews: { color: "text-blue-400 border-blue-400/30" },
  Options: { color: "text-yellow-400 border-yellow-400/30" },
  Official: { color: "text-amber-400 border-amber-400/30" },
};

const METHOD_ICON: Record<SourceAccountMethod, string> = {
  rss: "RSS",
  browser: "BW",
  api: "API",
};

function isWebSource(account: SourceAccount): boolean {
  return (
    account.method === "rss" ||
    account.method === "api" ||
    account.category === "Official" ||
    account.handle.includes(".") ||
    account.handle.startsWith("http")
  );
}

function sourceLabel(account: SourceAccount): string {
  return isWebSource(account) ? account.handle : `@${account.handle}`;
}

const STATUS_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  padding: "4px 8px",
  background: "rgba(10, 9, 5, 0.72)",
  backdropFilter: "blur(18px) saturate(1.08)",
  border: "1px solid rgba(199, 159, 74, 0.10)",
  borderRadius: 4,
};

export function SourceAccountsManager({
  accounts,
  onAccountsChanged,
  lastAppliedAt,
  isMutating,
  degradedReason,
}: SourceAccountsManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [addHandle, setAddHandle] = useState("");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addCategory, setAddCategory] =
    useState<SourceAccountCategory>("Custom");
  const [addMethod, setAddMethod] = useState<SourceAccountMethod>("browser");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Inline edit state
  const [editHandle, setEditHandle] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategory, setEditCategory] =
    useState<SourceAccountCategory>("Custom");
  const [editMethod, setEditMethod] = useState<SourceAccountMethod>("browser");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const sorted = [...accounts].sort((a, b) => {
    const catOrder = [
      "Wire",
      "Macro",
      "Commentary",
      "OSINT",
      "Geopolitical",
      "Official",
      "Custom",
    ];
    const ai = catOrder.indexOf(a.category);
    const bi = catOrder.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    return a.handle.localeCompare(b.handle);
  });

  const handleAdd = useCallback(async () => {
    if (!addHandle.trim()) return;
    setAddSubmitting(true);
    setAddErrors({});
    try {
      const res = await fetch(`${API_BASE}/api/source-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: addHandle.trim().replace(/^@/, ""),
          display_name: addDisplayName.trim() || undefined,
          category: addCategory,
          method: addMethod,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddErrors(json.errors ?? { general: json.error ?? "Save failed" });
        return;
      }
      setAddHandle("");
      setAddDisplayName("");
      setAddCategory("Custom");
      setAddMethod("browser");
      setShowAdd(false);
      onAccountsChanged();
    } catch (err) {
      console.error("[SourceAccountsManager] Add failed:", err);
      setAddErrors({ general: "Network error" });
    } finally {
      setAddSubmitting(false);
    }
  }, [addHandle, addDisplayName, addCategory, addMethod, onAccountsChanged]);

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API_BASE}/api/source-accounts/${id}`, {
          method: "DELETE",
        });
        onAccountsChanged();
      } catch (err) {
        console.error("[SourceAccountsManager] Remove failed:", err);
      }
    },
    [onAccountsChanged],
  );

  const handleToggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      try {
        await fetch(`${API_BASE}/api/source-accounts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !currentActive }),
        });
        onAccountsChanged();
      } catch (err) {
        console.error("[SourceAccountsManager] Toggle failed:", err);
      }
    },
    [onAccountsChanged],
  );

  const startEdit = (account: SourceAccount) => {
    setEditingId(account.id);
    setEditHandle(account.handle);
    setEditDisplayName(account.display_name ?? "");
    setEditCategory(account.category);
    setEditMethod(account.method ?? "browser");
    setEditErrors({});
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditErrors({});
    try {
      const res = await fetch(`${API_BASE}/api/source-accounts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: editHandle.trim().replace(/^@/, ""),
          display_name: editDisplayName.trim() || null,
          category: editCategory,
          method: editMethod,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditErrors(json.errors ?? { general: json.error ?? "Save failed" });
        return;
      }
      setEditingId(null);
      onAccountsChanged();
    } catch (err) {
      console.error("[SourceAccountsManager] Edit failed:", err);
      setEditErrors({ general: "Network error" });
    }
  }, [
    editingId,
    editHandle,
    editDisplayName,
    editCategory,
    editMethod,
    onAccountsChanged,
  ]);

  const handleSources = sorted.filter((account) => !isWebSource(account));
  const webSources = sorted.filter(isWebSource);

  const renderAccount = (account: SourceAccount) => {
    const badge = CATEGORY_BADGE[account.category] ?? CATEGORY_BADGE.Custom;
    const isEditing = editingId === account.id;

    if (isEditing) {
      return (
        <div
          key={account.id}
          className="p-2 rounded border border-[var(--fintheon-accent)]/14"
          style={{
            background: "rgba(10, 9, 5, 0.72)",
            backdropFilter: "blur(18px) saturate(1.08)",
          }}
        >
          <div className="space-y-1.5">
            <input
              value={editHandle}
              onChange={(e) => setEditHandle(e.target.value)}
              className="w-full bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-2 py-0.5 text-[12px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/40 outline-none transition-colors"
              placeholder="Handle or web source"
            />
            {editErrors.handle && (
              <div className="text-[10px] text-red-400">
                {editErrors.handle}
              </div>
            )}
            <input
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              className="w-full bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-2 py-0.5 text-[12px] text-[var(--fintheon-text)]/70 focus:border-[var(--fintheon-accent)]/40 outline-none transition-colors"
              placeholder="Display name"
            />
            <div className="flex gap-1.5">
              <select
                value={editCategory}
                onChange={(e) =>
                  setEditCategory(e.target.value as SourceAccountCategory)
                }
                className="bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-1.5 py-0.5 text-[12px] text-[var(--fintheon-text)]/70 outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
              >
                {SOURCE_ACCOUNT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={editMethod}
                onChange={(e) =>
                  setEditMethod(e.target.value as SourceAccountMethod)
                }
                className="bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-1.5 py-0.5 text-[12px] text-[var(--fintheon-text)]/70 outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
              >
                {SOURCE_ACCOUNT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_ICON[m]} — {m}
                  </option>
                ))}
              </select>
            </div>
            {editErrors.category && (
              <div className="text-[10px] text-red-400">
                {editErrors.category}
              </div>
            )}
            {editErrors.method && (
              <div className="text-[10px] text-red-400">
                {editErrors.method}
              </div>
            )}
            {editErrors.general && (
              <div className="text-[10px] text-red-400">
                {editErrors.general}
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={handleSaveEdit}
                className="px-2.5 py-0.5 rounded text-[11px] bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] font-medium hover:opacity-90 transition-opacity"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-2.5 py-0.5 rounded text-[11px] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={account.id}
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded group transition-colors ${
          !account.active ? "opacity-40" : ""
        }`}
        style={editingId !== account.id ? {} : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[var(--fintheon-text)] truncate">
            {sourceLabel(account)}
          </div>
          {account.display_name && (
            <div className="text-[8px] text-[var(--fintheon-muted)] truncate">
              {account.display_name}
            </div>
          )}
        </div>
        <span
          className={`min-w-[72px] text-right text-[9px] font-bold px-1.5 py-px rounded border shrink-0 ${badge.color}`}
        >
          {account.category}
        </span>
        <span className="min-w-[28px] text-right text-[9px] text-[var(--fintheon-muted)] shrink-0 tabular-nums">
          {METHOD_ICON[account.method] ?? account.method}
        </span>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => handleToggleActive(account.id, account.active)}
            className={`p-0.5 transition-colors ${
              account.active
                ? "text-emerald-500 hover:text-[var(--fintheon-text)]/70"
                : "text-[var(--fintheon-muted)] hover:text-emerald-400"
            }`}
            title={account.active ? "Deactivate" : "Activate"}
          >
            <Power className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => startEdit(account)}
            className="p-0.5 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] transition-colors"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => handleRemove(account.id)}
            className="p-0.5 text-[var(--fintheon-muted)] hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/60 uppercase tracking-wider">
          <Rss className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          Source Accounts
        </div>
        <span className="min-w-[84px] text-right text-[11px] tabular-nums text-[var(--fintheon-muted)]">
          {accounts.filter((a) => a.active).length}/{accounts.length} active
        </span>
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
          <span style={{ color: "var(--fintheon-accent)" }}>mutating...</span>
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

      {/* Account list */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
            <span>@ Handles</span>
            <span className="min-w-[44px] text-right tabular-nums">
              {handleSources.filter((a) => a.active).length}/
              {handleSources.length}
            </span>
          </div>
          {handleSources.map(renderAccount)}
        </div>

        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
            <span>Web Sources</span>
            <span className="min-w-[44px] text-right tabular-nums">
              {webSources.filter((a) => a.active).length}/{webSources.length}
            </span>
          </div>
          {webSources.map(renderAccount)}
        </div>

        {sorted.length === 0 && (
          <div className="text-[12px] text-[var(--fintheon-muted)] text-center py-4">
            No source accounts configured.
          </div>
        )}
      </div>

      {/* Add form toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add Account
        {showAdd ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {showAdd && (
        <div
          className="space-y-1.5 p-2 rounded border border-[var(--fintheon-accent)]/14"
          style={{
            background: "rgba(10, 9, 5, 0.72)",
            backdropFilter: "blur(18px) saturate(1.08)",
          }}
        >
          <input
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value)}
            className="w-full bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-2 py-1 text-[12px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/40 outline-none transition-colors"
            placeholder="Handle (no @)"
          />
          {addErrors.handle && (
            <div className="text-[10px] text-red-400">{addErrors.handle}</div>
          )}
          <input
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
            className="w-full bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-2 py-1 text-[12px] text-[var(--fintheon-text)]/70 focus:border-[var(--fintheon-accent)]/40 outline-none transition-colors"
            placeholder="Display name (optional)"
          />
          <div className="flex gap-1.5">
            <select
              value={addCategory}
              onChange={(e) =>
                setAddCategory(e.target.value as SourceAccountCategory)
              }
              className="bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-1.5 py-1 text-[12px] text-[var(--fintheon-text)]/70 outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
            >
              {SOURCE_ACCOUNT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={addMethod}
              onChange={(e) =>
                setAddMethod(e.target.value as SourceAccountMethod)
              }
              className="bg-transparent border border-[var(--fintheon-accent)]/10 rounded px-1.5 py-1 text-[12px] text-[var(--fintheon-text)]/70 outline-none focus:border-[var(--fintheon-accent)]/40 transition-colors"
            >
              {SOURCE_ACCOUNT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_ICON[m]} — {m}
                </option>
              ))}
            </select>
          </div>
          {addErrors.category && (
            <div className="text-[10px] text-red-400">{addErrors.category}</div>
          )}
          {addErrors.method && (
            <div className="text-[10px] text-red-400">{addErrors.method}</div>
          )}
          {addErrors.general && (
            <div className="text-[10px] text-red-400">{addErrors.general}</div>
          )}
          <button
            onClick={handleAdd}
            disabled={!addHandle.trim() || addSubmitting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)] text-[12px] bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {addSubmitting ? "Adding..." : "Add Account"}
          </button>
        </div>
      )}
    </div>
  );
}

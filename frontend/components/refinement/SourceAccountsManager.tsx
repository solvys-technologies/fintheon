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
  Custom: { color: "text-zinc-400 border-zinc-400/30" },
  Official: { color: "text-amber-400 border-amber-400/30" },
};

const METHOD_ICON: Record<SourceAccountMethod, string> = {
  rettiwt: "X",
  rss: "RSS",
  browser: "BW",
  api: "API",
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
  const [addMethod, setAddMethod] = useState<SourceAccountMethod>("rettiwt");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Inline edit state
  const [editHandle, setEditHandle] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategory, setEditCategory] =
    useState<SourceAccountCategory>("Custom");
  const [editMethod, setEditMethod] = useState<SourceAccountMethod>("rettiwt");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const sorted = [...accounts].sort((a, b) => {
    const catOrder = [
      "Wire",
      "Macro",
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
      setAddMethod("rettiwt");
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
    setEditMethod(account.method ?? "rettiwt");
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
          <Rss className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          Source Accounts
        </div>
        <span className="text-[11px] text-zinc-600">
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
          <span style={{ color: "var(--fintheon-accent)" }}>
            mutating...
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

      {/* Account list */}
      <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
        {sorted.map((account) => {
          const badge =
            CATEGORY_BADGE[account.category] ?? CATEGORY_BADGE.Custom;
          const isEditing = editingId === account.id;

          if (isEditing) {
            return (
              <div
                key={account.id}
                className="p-2 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-accent)]/5 space-y-1.5"
              >
                <input
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[12px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Handle (no @)"
                />
                {editErrors.handle && (
                  <div className="text-[10px] text-red-400">
                    {editErrors.handle}
                  </div>
                )}
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[12px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Display name"
                />
                <div className="flex gap-1.5">
                  <select
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(e.target.value as SourceAccountCategory)
                    }
                    className="bg-transparent border border-zinc-700 rounded px-1.5 py-0.5 text-[12px] text-zinc-400 outline-none"
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
                    className="bg-transparent border border-zinc-700 rounded px-1.5 py-0.5 text-[12px] text-zinc-400 outline-none"
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
                    className="px-2 py-0.5 rounded text-[11px] bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/30 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={account.id}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded group transition-colors hover:bg-zinc-800/30 ${
                !account.active ? "opacity-40" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--fintheon-text)] truncate">
                  @{account.handle}
                </div>
                {account.display_name && (
                  <div className="text-[8px] text-zinc-500 truncate">
                    {account.display_name}
                  </div>
                )}
              </div>
              <span
                className={`text-[8px] font-bold px-1 py-px rounded border shrink-0 ${badge.color}`}
              >
                {account.category}
              </span>
              <span className="text-[8px] text-zinc-600 shrink-0">
                {METHOD_ICON[account.method] ?? account.method}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => handleToggleActive(account.id, account.active)}
                  className={`p-0.5 transition-colors ${
                    account.active
                      ? "text-emerald-500 hover:text-zinc-400"
                      : "text-zinc-600 hover:text-emerald-400"
                  }`}
                  title={account.active ? "Deactivate" : "Activate"}
                >
                  <Power className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => startEdit(account)}
                  className="p-0.5 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => handleRemove(account.id)}
                  className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-[12px] text-zinc-600 text-center py-4">
            No source accounts configured.
          </div>
        )}
      </div>

      {/* Add form toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
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
        <div className="space-y-1.5 p-2 rounded border border-zinc-800 bg-zinc-900/50">
          <input
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[12px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Handle (no @)"
          />
          {addErrors.handle && (
            <div className="text-[10px] text-red-400">{addErrors.handle}</div>
          )}
          <input
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[12px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Display name (optional)"
          />
          <div className="flex gap-1.5">
            <select
              value={addCategory}
              onChange={(e) =>
                setAddCategory(e.target.value as SourceAccountCategory)
              }
              className="bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[12px] text-zinc-400 outline-none"
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
              className="bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[12px] text-zinc-400 outline-none"
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[12px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {addSubmitting ? "Adding..." : "Add Account"}
          </button>
        </div>
      )}
    </div>
  );
}

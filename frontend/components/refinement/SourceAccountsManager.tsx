// [claude-code 2026-04-12] Source accounts manager — CRUD UI for curated X timeline accounts
import { useState, useCallback } from "react";
import {
  Rss,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Power,
} from "@/components/shared/iso-icons";
import type {
  SourceAccount,
  SourceAccountCategory,
} from "../../../backend-hono/src/types/source-account";
import { SOURCE_ACCOUNT_CATEGORIES } from "../../../backend-hono/src/types/source-account";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface SourceAccountsManagerProps {
  accounts: SourceAccount[];
  onAccountsChanged: () => void;
}

const CATEGORY_BADGE: Record<SourceAccountCategory, { color: string }> = {
  Wire: {
    color: "text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30",
  },
  OSINT: { color: "text-cyan-400 border-cyan-400/30" },
  Geopolitical: { color: "text-red-400 border-red-400/30" },
  Macro: { color: "text-emerald-400 border-emerald-400/30" },
  Custom: { color: "text-zinc-400 border-zinc-400/30" },
};

export function SourceAccountsManager({
  accounts,
  onAccountsChanged,
}: SourceAccountsManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [addHandle, setAddHandle] = useState("");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addCategory, setAddCategory] =
    useState<SourceAccountCategory>("Custom");
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Inline edit state
  const [editHandle, setEditHandle] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategory, setEditCategory] =
    useState<SourceAccountCategory>("Custom");

  const sorted = [...accounts].sort((a, b) => {
    const catOrder = ["Wire", "Macro", "OSINT", "Geopolitical", "Custom"];
    const ai = catOrder.indexOf(a.category);
    const bi = catOrder.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    return a.handle.localeCompare(b.handle);
  });

  const handleAdd = useCallback(async () => {
    if (!addHandle.trim()) return;
    setAddSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/source-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: addHandle.trim().replace(/^@/, ""),
          displayName: addDisplayName.trim() || undefined,
          category: addCategory,
        }),
      });
      setAddHandle("");
      setAddDisplayName("");
      setAddCategory("Custom");
      setShowAdd(false);
      onAccountsChanged();
    } catch (err) {
      console.error("[SourceAccountsManager] Add failed:", err);
    } finally {
      setAddSubmitting(false);
    }
  }, [addHandle, addDisplayName, addCategory, onAccountsChanged]);

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
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    try {
      await fetch(`${API_BASE}/api/source-accounts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: editHandle.trim().replace(/^@/, ""),
          display_name: editDisplayName.trim() || null,
          category: editCategory,
        }),
      });
      setEditingId(null);
      onAccountsChanged();
    } catch (err) {
      console.error("[SourceAccountsManager] Edit failed:", err);
    }
  }, [editingId, editHandle, editDisplayName, editCategory, onAccountsChanged]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
          <Rss className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          Source Accounts
        </div>
        <span className="text-[9px] text-zinc-600">
          {accounts.filter((a) => a.active).length}/{accounts.length} active
        </span>
      </div>

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
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Handle (no @)"
                />
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Display name"
                />
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as SourceAccountCategory)
                  }
                  className="bg-transparent border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none"
                >
                  {SOURCE_ACCOUNT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-0.5 rounded text-[9px] bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/30 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
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
                <div className="text-[10px] font-semibold text-[var(--fintheon-text)] truncate">
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
          <div className="text-[10px] text-zinc-600 text-center py-4">
            No source accounts configured.
          </div>
        )}
      </div>

      {/* Add form toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
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
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Handle (no @)"
          />
          <input
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Display name (optional)"
          />
          <select
            value={addCategory}
            onChange={(e) =>
              setAddCategory(e.target.value as SourceAccountCategory)
            }
            className="bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[10px] text-zinc-400 outline-none"
          >
            {SOURCE_ACCOUNT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!addHandle.trim() || addSubmitting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {addSubmitting ? "Adding..." : "Add Account"}
          </button>
        </div>
      )}
    </div>
  );
}

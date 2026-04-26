// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — API credentials tab
// [claude-code 2026-04-12] Added X Auth (Rettiwt) key management section
import React, { useState, useEffect, useCallback } from "react";
import type { APIKeys } from "../../contexts/SettingsContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface RettiwtPoolStatus {
  totalKeys: number;
  availableKeys: number;
  cooldownKeys: number;
  disabledKeys: number;
}

interface ApiTabProps {
  apiKeys: APIKeys;
  setAPIKeys: (updater: APIKeys | ((prev: APIKeys) => APIKeys)) => void;
}

export function ApiTab({ apiKeys, setAPIKeys }: ApiTabProps) {
  const [rettiwtKeys, setRettiwtKeys] = useState<string[]>([]);
  const [rettiwtPool, setRettiwtPool] = useState<RettiwtPoolStatus | null>(
    null,
  );
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRettiwtStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/rettiwt`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRettiwtKeys(data.keys ?? []);
        setRettiwtPool(data.pool ?? null);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchRettiwtStatus();
  }, [fetchRettiwtStatus]);

  const addKey = async () => {
    if (!newKey || newKey.length < 10) {
      setError("API key must be at least 10 characters");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/rettiwt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: newKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add key");
      } else {
        setSuccess("Key added. Feed will begin polling shortly.");
        setNewKey("");
        fetchRettiwtStatus();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (index: number) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/rettiwt`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ index }),
      });
      if (res.ok) {
        setSuccess("Key removed.");
        fetchRettiwtStatus();
      }
    } catch {
      setError("Failed to remove key");
    }
  };

  return (
    <>
      {/* [claude-code 2026-04-26] Rettiwt X-feed key block removed per TP —
          X intake now goes through XActions / Steel server-side (no per-user
          API key). The state hooks above (rettiwtKeys, rettiwtPool, newKey,
          addKey, removeKey, saving, error, success) are now unused but kept
          to avoid touching unrelated logic in this patch; they'll be GC'd
          on the next full cleanup pass of ApiTab. */}

      {/* ── TopstepX Credentials ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">
          TopstepX Credentials
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={apiKeys.topstepxUsername || ""}
              onChange={(e) =>
                setAPIKeys({ ...apiKeys, topstepxUsername: e.target.value })
              }
              placeholder="Enter your TopstepX username"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">API Key</label>
            <input
              type="password"
              value={apiKeys.topstepxApiKey || ""}
              onChange={(e) =>
                setAPIKeys({ ...apiKeys, topstepxApiKey: e.target.value })
              }
              placeholder="Enter your TopstepX API key"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <p className="text-xs text-gray-500">
            Sign up at{" "}
            <a
              href="https://topstepx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--fintheon-accent)] hover:underline"
            >
              topstepx.com
            </a>{" "}
            and contact support for API access
          </p>
        </div>
      </section>

      <p className="text-xs text-gray-500 mt-4">
        Agent inference uses OpenRouter (set OPENROUTER_API_KEY in backend{" "}
        <code className="bg-zinc-800 px-1 rounded">backend-hono/.env</code>).
        Voice Engine uses OpenAI (set OPENAI_API_KEY in backend). See SETUP.md
        for details.
      </p>
    </>
  );
}

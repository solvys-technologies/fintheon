// [claude-code 2026-05-03] S58-T2: add user DeepSeek API-key management for client-side chat.
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — API credentials tab
// [claude-code 2026-04-12] Added X Auth (Rettiwt) key management section
import React, { useState, useEffect, useCallback } from "react";
import type { APIKeys } from "../../contexts/SettingsContext";
import { DeepSeekApiKeySection } from "./DeepSeekApiKeySection";

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
      <DeepSeekApiKeySection />

      <div className="border-t border-zinc-800 my-6" />

      {/* ── X (Twitter) Feed Authentication ──────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-1">
          X Feed Authentication
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Fintheon polls live headlines from X. Each user provides their own API
          key (encoded session cookie) to avoid shared rate limits.
        </p>

        {/* Instructions */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-gray-300 mb-2">
            How to get your API key:
          </p>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>
              Install the{" "}
              <a
                href="https://chromewebstore.google.com/detail/x-auth-helper/igpkhkjmpdecacocghpgkghdcmcmpfhp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--fintheon-accent)] hover:underline"
              >
                X Auth Helper
              </a>{" "}
              Chrome extension and allow it in incognito
            </li>
            <li>Open an incognito window and log in to X (twitter.com)</li>
            <li>
              Click the extension icon and press{" "}
              <span className="text-white font-medium">Get Key</span>
            </li>
            <li>Copy the API key and paste it below</li>
            <li>
              Close the incognito window (don&apos;t log out — the key stays
              valid)
            </li>
          </ol>
          <p className="text-xs text-gray-500 mt-2">
            Firefox users:{" "}
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/rettiwt-auth-helper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--fintheon-accent)] hover:underline"
            >
              Rettiwt Auth Helper
            </a>{" "}
            (same steps in a private window)
          </p>
        </div>

        {/* Pool status */}
        {rettiwtPool && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-gray-400">Feed Pool:</span>
            <span
              className={
                rettiwtPool.availableKeys > 0
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {rettiwtPool.availableKeys}/{rettiwtPool.totalKeys} keys active
            </span>
            {rettiwtPool.cooldownKeys > 0 && (
              <span className="text-yellow-400">
                {rettiwtPool.cooldownKeys} cooling down
              </span>
            )}
            {rettiwtPool.disabledKeys > 0 && (
              <span className="text-red-400">
                {rettiwtPool.disabledKeys} disabled
              </span>
            )}
          </div>
        )}

        {/* Existing keys */}
        {rettiwtKeys.length > 0 && (
          <div className="space-y-2 mb-3">
            {rettiwtKeys.map((masked, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800 rounded px-3 py-2"
              >
                <code className="text-xs text-gray-300 font-mono">
                  {masked}
                </code>
                <button
                  onClick={() => removeKey(i)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new key */}
        <div className="flex gap-2">
          <input
            type="password"
            value={newKey}
            onChange={(e) => {
              setNewKey(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Paste your Rettiwt API key here"
            className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/30"
          />
          <button
            onClick={addKey}
            disabled={saving || !newKey}
            className="px-4 py-2 text-sm rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-40 transition-colors"
          >
            {saving ? "..." : "Add Key"}
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        {success && <p className="text-xs text-green-400 mt-2">{success}</p>}
      </section>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="border-t border-zinc-800 my-6" />

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

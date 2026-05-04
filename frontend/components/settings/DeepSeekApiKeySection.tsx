// [claude-code 2026-05-03] S58-T2: DeepSeek API-key settings section for personal CAO chat.
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "../../lib/supabase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function DeepSeekApiKeySection() {
  const [deepSeekKey, setDeepSeekKey] = useState("");
  const [deepSeekMaskedKey, setDeepSeekMaskedKey] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const aiKeyHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-keys?provider=deepseek`, {
        headers: await aiKeyHeaders(),
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const masked =
        data.maskedKey ?? data.masked ?? data.keys?.[0]?.maskedKey ?? data.keys?.[0]?.masked ?? null;
      setDeepSeekMaskedKey(masked);
      localStorage.setItem("fintheon:deepseek-key-status", masked ? "set" : "missing");
    } catch {
      localStorage.setItem("fintheon:deepseek-key-status", "missing");
    }
  }, [aiKeyHeaders]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const addKey = async () => {
    if (!deepSeekKey || deepSeekKey.length < 10) {
      setError("DeepSeek API key must be at least 10 characters");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-keys`, {
        method: "POST",
        headers: await aiKeyHeaders(),
        credentials: "include",
        body: JSON.stringify({ provider: "deepseek", apiKey: deepSeekKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || "Failed to add DeepSeek key");
      } else {
        setSuccess("DeepSeek key saved for personal CAO chat.");
        setDeepSeekKey("");
        localStorage.setItem("fintheon:deepseek-key-status", "set");
        void fetchStatus();
      }
    } catch {
      setError("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeKey = async () => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-keys?provider=deepseek`, {
        method: "DELETE",
        headers: await aiKeyHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        setSuccess("DeepSeek key removed.");
        setDeepSeekMaskedKey(null);
        localStorage.setItem("fintheon:deepseek-key-status", "missing");
      }
    } catch {
      setError("Failed to remove DeepSeek key");
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-1">
        AI Provider API Key
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Store your DeepSeek key server-side for personal CAO chat. Backend jobs
        continue to use server-managed Hermes routing.
      </p>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-300">DeepSeek</p>
            <p className="text-[11px] text-gray-500">
              {deepSeekMaskedKey ? "Key set" : "No key configured"}
            </p>
          </div>
          {deepSeekMaskedKey && (
            <div className="flex items-center gap-3">
              <code className="text-xs text-gray-300 font-mono">
                {deepSeekMaskedKey}
              </code>
              <button
                onClick={removeKey}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          value={deepSeekKey}
          onChange={(event) => {
            setDeepSeekKey(event.target.value);
            setError(null);
            setSuccess(null);
          }}
          placeholder="sk-..."
          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/30"
        />
        <button
          onClick={addKey}
          disabled={isSaving || !deepSeekKey}
          className="px-4 py-2 text-sm rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-40 transition-colors"
        >
          {isSaving ? "..." : "Add Key"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Create a key at{" "}
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--fintheon-accent)] hover:underline"
        >
          platform.deepseek.com/api_keys
        </a>
        .
      </p>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-400 mt-2">{success}</p>}
    </section>
  );
}

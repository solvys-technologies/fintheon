// [claude-code 2026-05-03] S58-T2: DeepSeek API-key settings section for personal CAO chat.
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "../../lib/supabase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const DEEPSEEK_KEY_STATUS = "fintheon:deepseek-key-status";
const OC_API_KEY_STATUS = "fintheon:opencode-go-key-status";

type ProviderId = "deepseek" | "opencode-go";

export function DeepSeekApiKeySection() {
  const [deepSeekKey, setDeepSeekKey] = useState("");
  const [deepSeekMaskedKey, setDeepSeekMaskedKey] = useState<string | null>(
    null,
  );
  const [openCodeGoKey, setOpenCodeGoKey] = useState("");
  const [openCodeGoMaskedKey, setOpenCodeGoMaskedKey] = useState<string | null>(
    null,
  );
  const [openCodeGoBaseUrl, setOpenCodeGoBaseUrl] = useState<string | null>(
    null,
  );
  const [isSavingProvider, setIsSavingProvider] = useState<ProviderId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const aiKeyHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchProviderStatus = useCallback(async (provider: ProviderId) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/settings/ai-keys?provider=${encodeURIComponent(provider)}`,
        {
          headers: await aiKeyHeaders(),
          credentials: "include",
        },
      );
      if (!res.ok) return;
      const data = await res.json();
      const masked =
        data.maskedKey ??
        data.masked ??
        data.keys?.[0]?.maskedKey ??
        data.keys?.[0]?.masked ??
        null;
      if (provider === "deepseek") {
        setDeepSeekMaskedKey(masked);
        localStorage.setItem(DEEPSEEK_KEY_STATUS, masked ? "set" : "missing");
      } else {
        setOpenCodeGoMaskedKey(masked);
        setOpenCodeGoBaseUrl(
          typeof data.baseUrl === "string" ? data.baseUrl : null,
        );
        localStorage.setItem(OC_API_KEY_STATUS, masked ? "set" : "missing");
      }
    } catch {
      if (provider === "deepseek") {
        localStorage.setItem(DEEPSEEK_KEY_STATUS, "missing");
      } else {
        localStorage.setItem(OC_API_KEY_STATUS, "missing");
      }
    }
  }, [aiKeyHeaders]);

  useEffect(() => {
    void Promise.all([
      fetchProviderStatus("deepseek"),
      fetchProviderStatus("opencode-go"),
    ]);
  }, [fetchProviderStatus]);

  const addKey = async (provider: ProviderId, apiKey: string) => {
    if (!apiKey || apiKey.length < 10) {
      setError("API key must be at least 10 characters");
      return;
    }
    setIsSavingProvider(provider);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-keys`, {
        method: "POST",
        headers: await aiKeyHeaders(),
        credentials: "include",
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || "Failed to add API key");
      } else {
        if (provider === "deepseek") {
          setSuccess("DeepSeek key saved for personal CAO chat.");
          setDeepSeekKey("");
          localStorage.setItem(DEEPSEEK_KEY_STATUS, "set");
        } else {
          setSuccess("OpenCode Go key saved.");
          setOpenCodeGoKey("");
          localStorage.setItem(OC_API_KEY_STATUS, "set");
        }
        void fetchProviderStatus(provider);
      }
    } catch {
      setError("Network error");
    } finally {
      setIsSavingProvider(null);
    }
  };

  const removeKey = async (provider: ProviderId) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/settings/ai-keys?provider=${encodeURIComponent(provider)}`,
        {
          method: "DELETE",
          headers: await aiKeyHeaders(),
          credentials: "include",
        },
      );
      if (res.ok) {
        if (provider === "deepseek") {
          setSuccess("DeepSeek key removed.");
          setDeepSeekMaskedKey(null);
          localStorage.setItem(DEEPSEEK_KEY_STATUS, "missing");
        } else {
          setSuccess("OpenCode Go key removed.");
          setOpenCodeGoMaskedKey(null);
          localStorage.setItem(OC_API_KEY_STATUS, "missing");
        }
      }
    } catch {
      setError("Failed to remove API key");
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-1">
        AI Provider API Keys
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Store your personal provider keys server-side for chat routing.
        Backend jobs still use server-managed Hermes routing.
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
                onClick={() => removeKey("deepseek")}
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
          placeholder="ak-..."
          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/30"
        />
        <button
          onClick={() => addKey("deepseek", deepSeekKey)}
          disabled={isSavingProvider === "deepseek" || !deepSeekKey}
          className="px-4 py-2 text-sm rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-40 transition-colors"
        >
          {isSavingProvider === "deepseek" ? "..." : "Add Key"}
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
        . DeepSeek keys typically start with <code>ak-</code>.
      </p>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 mt-5 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-300">OpenCode Go</p>
            <p className="text-[11px] text-gray-500">
              {openCodeGoMaskedKey ? "Key set" : "No key configured"}
            </p>
            {openCodeGoBaseUrl && (
              <p className="text-[10px] text-gray-600 mt-1">
                URL: {openCodeGoBaseUrl}
              </p>
            )}
          </div>
          {openCodeGoMaskedKey && (
            <div className="flex items-center gap-3">
              <code className="text-xs text-gray-300 font-mono">
                {openCodeGoMaskedKey}
              </code>
              <button
                onClick={() => removeKey("opencode-go")}
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
          value={openCodeGoKey}
          onChange={(event) => {
            setOpenCodeGoKey(event.target.value);
            setError(null);
            setSuccess(null);
          }}
          placeholder="OpenCode Go API key"
          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--fintheon-accent)]/30"
        />
        <button
          onClick={() => addKey("opencode-go", openCodeGoKey)}
          disabled={isSavingProvider === "opencode-go" || !openCodeGoKey}
          className="px-4 py-2 text-sm rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-40 transition-colors"
        >
          {isSavingProvider === "opencode-go" ? "..." : "Add Key"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-400 mt-2">{success}</p>}
    </section>
  );
}

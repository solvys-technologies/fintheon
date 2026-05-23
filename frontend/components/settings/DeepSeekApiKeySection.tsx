// [claude-code 2026-05-03] S58-T2: DeepSeek API-key settings section for personal CAO chat.
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "../../lib/supabase";
import { SettingsActionStatus } from "./SettingsActionStatus";

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

  const fetchProviderStatus = useCallback(
    async (provider: ProviderId) => {
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
    },
    [aiKeyHeaders],
  );

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
        const backendSaved = data.backendSaved !== false;
        const localHermesSaved = data.localHermesSaved === true;
        if (provider === "deepseek") {
          setSuccess(
            `DeepSeek key saved${backendSaved ? " to backend" : ""}${localHermesSaved ? " and local Hermes" : ""}.`,
          );
          setDeepSeekKey("");
          localStorage.setItem(DEEPSEEK_KEY_STATUS, "set");
        } else {
          setSuccess(
            `OpenCode Go key saved${backendSaved ? " to backend" : ""}${localHermesSaved ? " and local Hermes" : ""}.`,
          );
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
    <section className="text-right">
      <h3 className="mb-1 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
        AI Provider API Keys
      </h3>
      <p className="mb-4 text-right text-xs text-gray-500">
        Save personal provider keys to backend and local Hermes so agent routing
        works across desktop/local tasks while preserving server-backed sync.
      </p>

      <div className="fintheon-fade-divider mb-4 pb-3">
        <div className="flex items-start justify-between gap-4 text-right">
          <div className="min-w-0 text-right">
            <p className="text-xs font-medium text-gray-300">DeepSeek</p>
          </div>
          <div className="flex min-w-[180px] flex-col items-end gap-1 text-right">
            <SettingsActionStatus
              label={deepSeekMaskedKey ? "Key Set" : "No Key"}
              detail={deepSeekMaskedKey ?? "No key configured"}
              tone={deepSeekMaskedKey ? "success" : "muted"}
            />
            {deepSeekMaskedKey && (
              <button
                onClick={() => removeKey("deepseek")}
                className="text-[10px] uppercase tracking-[0.14em] text-red-400 transition-colors hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
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
          onClick={() => addKey("deepseek", deepSeekKey)}
          disabled={isSavingProvider === "deepseek" || !deepSeekKey}
          className="px-4 py-2 text-sm rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-40 transition-colors"
        >
          {isSavingProvider === "deepseek" ? "..." : "Add Key"}
        </button>
      </div>
      <p className="mt-2 text-right text-xs text-gray-500">
        Create a key at{" "}
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--fintheon-accent)] hover:underline"
        >
          platform.deepseek.com/api_keys
        </a>
        . Keys typically start with <code>sk-</code>.
      </p>

      <div className="fintheon-fade-divider mb-4 mt-5 pb-3">
        <div className="flex items-start justify-between gap-4 text-right">
          <div className="min-w-0 text-right">
            <p className="text-xs font-medium text-gray-300">OpenCode Go</p>
          </div>
          <div className="flex min-w-[180px] flex-col items-end gap-1 text-right">
            <SettingsActionStatus
              label={openCodeGoMaskedKey ? "Key Set" : "No Key"}
              detail={openCodeGoBaseUrl || openCodeGoMaskedKey || "No key configured"}
              tone={openCodeGoMaskedKey ? "success" : "muted"}
            />
            {openCodeGoMaskedKey && (
              <button
                onClick={() => removeKey("opencode-go")}
                className="text-[10px] uppercase tracking-[0.14em] text-red-400 transition-colors hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
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

      <div className="mt-2 flex justify-end">
        {error && <SettingsActionStatus label="Key Error" detail={error} tone="error" />}
        {success && (
          <SettingsActionStatus label="Key Saved" detail={success} tone="success" />
        )}
      </div>
    </section>
  );
}

// [claude-code 2026-05-03] S58-T2: mobile DeepSeek API-key settings for direct personal chat.
import { useCallback, useEffect, useState } from "react";
import { getApiKey } from "../../lib/backend";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AiProviderSectionProps {
  getAccessToken: () => Promise<string | null>;
  onStatusChange: (hasKey: boolean) => void;
}

export function AiProviderSection({
  getAccessToken,
  onStatusChange,
}: AiProviderSectionProps) {
  const [deepSeekKey, setDeepSeekKey] = useState("");
  const [hasDeepSeekKey, setHasDeepSeekKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshDeepSeekKey = useCallback(async () => {
    const key = await getApiKey("deepseek", getAccessToken).catch(() => null);
    const hasKey = Boolean(key);
    setHasDeepSeekKey(hasKey);
    onStatusChange(hasKey);
    try {
      localStorage.setItem(
        "fintheon:deepseek-key-status",
        hasKey ? "set" : "missing",
      );
    } catch {
      /* ignore */
    }
  }, [getAccessToken, onStatusChange]);

  useEffect(() => {
    void refreshDeepSeekKey();
  }, [refreshDeepSeekKey]);

  const saveDeepSeekKey = async () => {
    if (deepSeekKey.trim().length < 10) {
      setMessage("Enter a valid DeepSeek key.");
      return;
    }
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/api/settings/ai-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ provider: "deepseek", apiKey: deepSeekKey }),
    }).catch(() => null);
    if (!res?.ok) {
      setMessage("DeepSeek key save failed.");
      return;
    }
    setDeepSeekKey("");
    setMessage("DeepSeek key saved.");
    await refreshDeepSeekKey();
  };

  const removeDeepSeekKey = async () => {
    const token = await getAccessToken();
    const res = await fetch(
      `${API_BASE}/api/settings/ai-keys?provider=deepseek`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    ).catch(() => null);
    if (!res?.ok) {
      setMessage("DeepSeek key removal failed.");
      return;
    }
    setMessage("DeepSeek key removed.");
    await refreshDeepSeekKey();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        Personal CAO chat uses your DeepSeek key directly when available.
        Backend briefs, Arbitrum, and RiskFlow stay on server routing.
      </div>
      <input
        type="password"
        value={deepSeekKey}
        onChange={(event) => setDeepSeekKey(event.target.value)}
        placeholder="sk-..."
        style={{
          width: "100%",
          minHeight: 44,
          borderRadius: 8,
          border:
            "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
          background: "rgba(5,4,2,0.72)",
          color: "var(--text-primary)",
          padding: "0 12px",
          fontFamily: "var(--font-data)",
          fontSize: 12,
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={saveDeepSeekKey}
          style={{
            minHeight: 44,
            padding: "0 16px",
            borderRadius: 8,
            border:
              "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
            background: "rgba(199,159,74,0.16)",
            color: "var(--accent)",
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          ADD KEY
        </button>
        {hasDeepSeekKey && (
          <button
            onClick={removeDeepSeekKey}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid color-mix(in srgb, #EF4444 45%, transparent)",
              background: "transparent",
              color: "#EF4444",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
            }}
          >
            REMOVE
          </button>
        )}
      </div>
      {message && (
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-disabled)",
            letterSpacing: "0.08em",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

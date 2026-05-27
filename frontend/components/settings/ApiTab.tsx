// [claude-code 2026-05-05] Removed RETTIWT / X Feed Authentication section — no longer needed.
// [claude-code 2026-05-03] S58-T2: add user DeepSeek API-key management for client-side chat.
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — API credentials tab
import React from "react";
import type { APIKeys } from "../../contexts/SettingsContext";
import { DeepSeekApiKeySection } from "./DeepSeekApiKeySection";

interface ApiTabProps {
  apiKeys: APIKeys;
  setAPIKeys: (updater: APIKeys | ((prev: APIKeys) => APIKeys)) => void;
}

export function ApiTab({ apiKeys, setAPIKeys }: ApiTabProps) {
  return (
    <div className="text-right">
      <DeepSeekApiKeySection />

      <div className="fintheon-fade-divider my-6" />

      {/* ── ProjectX API Credentials ─────────────────────────────────── */}
      <section>
        <h3 className="mb-4 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          ProjectX API Credentials
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-right text-sm text-gray-300">
              userName
            </label>
            <input
              type="text"
              value={apiKeys.topstepxUsername || ""}
              onChange={(e) =>
                setAPIKeys({ ...apiKeys, topstepxUsername: e.target.value })
              }
              placeholder="ProjectX userName"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <div>
            <label className="mb-2 block text-right text-sm text-gray-300">
              API Key
            </label>
            <input
              type="password"
              value={apiKeys.topstepxApiKey || ""}
              onChange={(e) =>
                setAPIKeys({ ...apiKeys, topstepxApiKey: e.target.value })
              }
              placeholder="ProjectX apiKey"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <p className="text-right text-xs text-gray-500">
            Uses ProjectX Gateway{" "}
            <code className="bg-zinc-800 px-1 rounded">userName</code> and{" "}
            <code className="bg-zinc-800 px-1 rounded">apiKey</code>. Link API
            access from{" "}
            <a
              href="https://topstepx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--fintheon-accent)] hover:underline"
            >
              topstepx.com
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-4 text-right text-xs text-gray-500">
        Agent inference uses Hermes gateway credentials (set HERMES_API_KEY in{" "}
        <code className="bg-zinc-800 px-1 rounded">backend-hono/.env</code>).
        Voice Engine uses OpenAI (set OPENAI_API_KEY in backend). See SETUP.md
        for details.
      </p>
    </div>
  );
}

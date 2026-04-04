// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — API credentials tab
import React from 'react';
import type { APIKeys } from '../../contexts/SettingsContext';

interface ApiTabProps {
  apiKeys: APIKeys;
  setAPIKeys: (updater: APIKeys | ((prev: APIKeys) => APIKeys)) => void;
}

export function ApiTab({ apiKeys, setAPIKeys }: ApiTabProps) {
  return (
    <>
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">TopstepX Credentials</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={apiKeys.topstepxUsername || ''}
              onChange={(e) => setAPIKeys({ ...apiKeys, topstepxUsername: e.target.value })}
              placeholder="Enter your TopstepX username"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">API Key</label>
            <input
              type="password"
              value={apiKeys.topstepxApiKey || ''}
              onChange={(e) => setAPIKeys({ ...apiKeys, topstepxApiKey: e.target.value })}
              placeholder="Enter your TopstepX API key"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            />
          </div>
          <p className="text-xs text-gray-500">
            Sign up at <a href="https://topstepx.com" target="_blank" rel="noopener noreferrer" className="text-[var(--fintheon-accent)] hover:underline">topstepx.com</a> and contact support for API access
          </p>
        </div>
      </section>

      <p className="text-xs text-gray-500 mt-4">
        Agent inference uses OpenRouter (set OPENROUTER_API_KEY in backend <code className="bg-zinc-800 px-1 rounded">backend-hono/.env</code>). Voice Engine uses OpenAI (set OPENAI_API_KEY in backend). See SETUP.md for details.
      </p>
    </>
  );
}

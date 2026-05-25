import { useEffect, useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import type { HarperProvider } from "../chat/ProviderDropdown";
import { SettingsActionStatus } from "./SettingsActionStatus";

export function ClientHermesSettings() {
  const {
    defaultChatProvider,
    setDefaultChatProvider,
    openCodeGoModel,
    setOpenCodeGoModel,
  } = useSettings();
  const [defaultProvider, setDefaultProvider] = useState<HarperProvider>(
    defaultChatProvider === "opencode-go" ? "opencode-go" : "deepseek-direct",
  );

  useEffect(() => {
    if (
      defaultChatProvider === "deepseek-direct" ||
      defaultChatProvider === "opencode-go"
    ) {
      setDefaultProvider(defaultChatProvider);
    }
  }, [defaultChatProvider]);

  const handleDefaultProviderChange = (provider: HarperProvider) => {
    setDefaultProvider(provider);
    setDefaultChatProvider(provider);
    localStorage.setItem("fintheon:default-chat-provider", provider);
    localStorage.setItem("fintheon:harper-provider", provider);
  };

  const handleOpenCodeGoModelChange = (model: string) => {
    const normalized = model.trim() || "deepseek-reasoner";
    setOpenCodeGoModel(normalized);
    try {
      localStorage.setItem("fintheon:opencode-go-model", normalized);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mb-6 w-full text-right">
      <div className="fintheon-fade-divider pb-4">
        <div className="mb-3 flex items-start justify-between gap-4 text-right">
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]">
              Hermes
            </p>
            <p className="mt-1 text-[12px] text-gray-500">
              Client chat routing.
            </p>
          </div>
          <SettingsActionStatus
            label={defaultProvider === "opencode-go" ? "OpenCode Go" : "Direct API"}
            detail="Current CAO chat provider"
            tone="success"
          />
        </div>

        <select
          value={defaultProvider}
          onChange={(event) =>
            handleDefaultProviderChange(event.target.value as HarperProvider)
          }
          className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-right text-sm text-white focus:outline-none"
        >
          <option value="deepseek-direct">DeepSeek v4 Pro (Direct API)</option>
          <option value="opencode-go">DeepSeek v4 Pro (OpenCode Go)</option>
        </select>

        {defaultProvider === "opencode-go" && (
          <div className="mt-3 space-y-2">
            <label className="block text-right text-[10px] uppercase tracking-[0.14em] text-gray-500">
              OpenCode Go Model
            </label>
            <select
              value={openCodeGoModel}
              onChange={(event) =>
                handleOpenCodeGoModelChange(event.target.value)
              }
              className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-right text-sm text-white focus:outline-none"
            >
              <option value="deepseek-reasoner">deepseek-reasoner</option>
              <option value="deepseek-chat">deepseek-chat</option>
              <option value="hermes-4-70b">hermes-4-70b</option>
              <option value="hermes-4-405b">hermes-4-405b</option>
            </select>
            <input
              type="text"
              value={openCodeGoModel}
              onChange={(event) =>
                handleOpenCodeGoModelChange(event.target.value)
              }
              placeholder="Custom model id"
              className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-right text-xs text-white placeholder:text-gray-600 focus:outline-none"
            />
            <div className="flex justify-end">
              <SettingsActionStatus
                label="Saved"
                detail="Stays active until changed."
                tone="success"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

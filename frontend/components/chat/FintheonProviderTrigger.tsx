import type { MouseEvent } from "react";
import type { HarperProvider } from "./ProviderDropdown";
import { DeepSeekWhaleIcon } from "../icons";

const PROVIDER_LABELS: Record<HarperProvider, string> = {
  "deepseek-direct": "DeepSeek",
  "opencode-go": "OpenCode",
};

interface FintheonProviderTriggerProps {
  provider: HarperProvider;
  compact?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function FintheonProviderTrigger({
  provider,
  compact,
  onClick,
}: FintheonProviderTriggerProps) {
  const currentProvider = PROVIDER_LABELS[provider] ?? "Provider";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/10 ${
        compact ? "px-1.5" : "px-2"
      }`}
      style={{ height: 28 }}
      title={`Provider: ${currentProvider}`}
    >
      <DeepSeekWhaleIcon className="h-[10.88px] w-[13.6px] shrink-0" />
      {!compact ? (
        <span
          style={{
            fontSize: 11,
            color: "var(--fintheon-text)",
            opacity: 0.82,
          }}
        >
          {currentProvider}
        </span>
      ) : null}
    </button>
  );
}

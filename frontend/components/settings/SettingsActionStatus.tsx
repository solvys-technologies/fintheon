interface SettingsActionStatusProps {
  label?: string | null;
  detail?: string | null;
  tone?: "muted" | "success" | "error" | "warning";
}

const toneClass = {
  muted: "text-[var(--fintheon-text)]/38",
  success: "text-emerald-400/80",
  error: "text-red-400/85",
  warning: "text-[var(--fintheon-accent)]/80",
};

export function SettingsActionStatus({
  label,
  detail,
  tone = "muted",
}: SettingsActionStatusProps) {
  if (!label && !detail) return null;

  return (
    <div className="settings-action-status text-right">
      {label && (
        <p
          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${toneClass[tone]}`}
        >
          {label}
        </p>
      )}
      {detail && (
        <p className="mt-0.5 max-w-xs text-[9px] leading-snug text-[var(--fintheon-text)]/34">
          {detail}
        </p>
      )}
    </div>
  );
}

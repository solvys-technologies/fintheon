// [claude-code 2026-04-19] Shared toggle row — label left, 48×28 switch right.
//   Used by NotificationsSection and TraderSection.
interface SettingToggleProps {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SettingToggle({
  label,
  on,
  onToggle,
  disabled,
}: SettingToggleProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          color: "var(--text-primary)",
          fontSize: 14,
          fontFamily: "var(--font-body)",
        }}
      >
        {label}
      </span>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-checked={on}
        role="switch"
        style={{
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          padding: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: `1.5px solid ${
              on ? "var(--accent)" : "var(--border-visible)"
            }`,
            background: on ? "var(--accent)" : "transparent",
            position: "relative",
            transition: "background 200ms ease, border-color 200ms ease",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: on ? "var(--black, #000)" : "var(--text-disabled)",
              position: "absolute",
              top: 2.5,
              left: on ? 23 : 3,
              transition: "left 200ms ease, background 200ms ease",
            }}
          />
        </div>
      </button>
    </div>
  );
}

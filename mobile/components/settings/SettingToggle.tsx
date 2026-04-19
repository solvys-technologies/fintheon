// [claude-code 2026-04-18] v5.22 S2: readOnly variant for fields that are managed
//   from desktop (per TP — non-notifications/theme settings are desktop-authoritative).
//   Renders a small "SET FROM DESKTOP" caption under the row, dims the label, and
//   blocks the toggle interaction without changing the row's overall geometry.
// [claude-code 2026-04-19] Shared toggle row — label left, 48×28 switch right.
//   Used by NotificationsSection and TraderSection.
interface SettingToggleProps {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** When true, the toggle is non-interactive and a "SET FROM DESKTOP" caption appears
   *  under the row. Use for trader identity, fusePalette overrides, and any field that
   *  the desktop owns. */
  readOnly?: boolean;
}

export function SettingToggle({
  label,
  on,
  onToggle,
  disabled,
  readOnly,
}: SettingToggleProps) {
  const locked = disabled || readOnly;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
            color: readOnly ? "var(--text-disabled)" : "var(--text-primary)",
            fontSize: 14,
            fontFamily: "var(--font-body)",
          }}
        >
          {label}
        </span>
        <button
          onClick={readOnly ? undefined : onToggle}
          disabled={locked}
          aria-checked={on}
          aria-readonly={readOnly || undefined}
          role="switch"
          style={{
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: locked ? "not-allowed" : "pointer",
            opacity: locked ? 0.5 : 1,
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
      {readOnly && (
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
            paddingLeft: 2,
          }}
        >
          SET FROM DESKTOP
        </span>
      )}
    </div>
  );
}

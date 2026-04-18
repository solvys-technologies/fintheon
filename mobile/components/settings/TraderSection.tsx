// [claude-code 2026-04-19] TP beta polish: trader preferences extracted. Keeps display
//   name (read-only — set on desktop), CAO name, Hermes toggle, alert sounds, haptic,
//   bulletin reminder mode, and read-only risk limits.
import { useSettings } from "../../contexts/SettingsContext";
import { SettingToggle } from "./SettingToggle";

const BULLETIN_MODES: { id: "once" | "until-pressed"; label: string }[] = [
  { id: "once", label: "ONCE" },
  { id: "until-pressed", label: "UNTIL PRESSED" },
];

export function TraderSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FieldLabel value="DISPLAY NAME">
        <ReadOnlyPlate
          value={settings.traderName || "Set on desktop"}
          hasValue={!!settings.traderName}
        />
        <Caption>[READ-ONLY — SET VIA DESKTOP]</Caption>
      </FieldLabel>

      <FieldLabel value="CAO NAME">
        <input
          type="text"
          value={settings.caoName}
          onChange={(e) => updateSettings({ caoName: e.target.value })}
          placeholder="Harper"
          style={textInputStyle}
        />
      </FieldLabel>

      <SettingToggle
        label="Hermes AI"
        on={settings.hermesEnabled}
        onToggle={() =>
          updateSettings({ hermesEnabled: !settings.hermesEnabled })
        }
      />
      <SettingToggle
        label="Alert Sounds"
        on={settings.alertConfig.soundEnabled}
        onToggle={() =>
          updateSettings({
            alertConfig: {
              ...settings.alertConfig,
              soundEnabled: !settings.alertConfig.soundEnabled,
            },
          })
        }
      />
      <SettingToggle
        label="Haptic Feedback"
        on={settings.hapticEnabled}
        onToggle={() =>
          updateSettings({ hapticEnabled: !settings.hapticEnabled })
        }
      />

      <FieldLabel value="BULLETIN REMINDER GLOW">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border:
              "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {BULLETIN_MODES.map((mode, i) => {
            const active = settings.bulletinReminder === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => updateSettings({ bulletinReminder: mode.id })}
                style={{
                  padding: "10px 0",
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  letterSpacing: "0.08em",
                  background: active ? "var(--accent)" : "transparent",
                  color: active
                    ? "var(--black, #000)"
                    : "var(--text-secondary)",
                  border: "none",
                  borderRight:
                    i === 0
                      ? "1px solid color-mix(in srgb, var(--accent) 16%, transparent)"
                      : "none",
                  cursor: "pointer",
                  minHeight: 44,
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 200ms ease, color 200ms ease",
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </FieldLabel>

      <FieldLabel value="RISK LIMITS (SET ON DESKTOP)">
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "12px 14px",
            background: "color-mix(in srgb, var(--accent) 3%, transparent)",
            borderRadius: 10,
            border:
              "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
          }}
        >
          <RiskCell
            label="TARGET"
            value={`$${settings.riskSettings.dailyProfitTarget.toLocaleString()}`}
            color="var(--success)"
          />
          <RiskCell
            label="LIMIT"
            value={`$${settings.riskSettings.dailyLossLimit.toLocaleString()}`}
            color="var(--error)"
          />
        </div>
      </FieldLabel>
    </div>
  );
}

function FieldLabel({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          color: "var(--text-secondary)",
          marginBottom: 8,
          letterSpacing: "0.1em",
        }}
      >
        {value}
      </div>
      {children}
    </div>
  );
}

function ReadOnlyPlate({
  value,
  hasValue,
}: {
  value: string;
  hasValue: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        padding: "12px 14px",
        background: "color-mix(in srgb, var(--accent) 2%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
        borderRadius: 10,
        color: hasValue ? "var(--text-primary)" : "var(--text-disabled)",
        fontFamily: "var(--font-body)",
        fontSize: 14,
        minHeight: 44,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        opacity: 0.8,
      }}
    >
      {value}
    </div>
  );
}

function Caption({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.08em",
        color: "var(--text-disabled)",
        marginTop: 6,
      }}
    >
      {children}
    </span>
  );
}

function RiskCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          color: "var(--text-secondary)",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          color,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const textInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "color-mix(in srgb, var(--accent) 3%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  outline: "none",
  minHeight: 44,
  boxSizing: "border-box",
  transition: "border-color 200ms ease, background 200ms ease",
};

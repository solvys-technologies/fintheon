// [claude-code 2026-04-15] T7: Settings page — notifications, appearance, account, about
import { useState, useCallback } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import type { ThemeConfig } from "@frontend/lib/theme";
import type { FontTheme } from "@frontend/lib/font-theme";

const SEVERITY_SEGMENTS = ["CRIT", "HIGH", "MED", "LOW"] as const;
const SEVERITY_VALUES = ["critical", "high", "medium", "low"] as const;

function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        border: `1.5px solid ${on ? "var(--text-display)" : "var(--border-visible)"}`,
        background: on ? "var(--text-display)" : "transparent",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, border-color 0.15s",
        minHeight: 44,
        minWidth: 44,
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          background: on ? "var(--black, #000)" : "var(--text-secondary)",
          position: "absolute",
          top: 2.5,
          left: on ? 23 : 3,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.1em",
        color: "var(--text-secondary)",
        textTransform: "uppercase" as const,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
      }}
    >
      <span style={{ color: "var(--text-primary)", fontSize: 14 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const {
    theme,
    setTheme,
    fontTheme,
    setFontTheme,
    availableThemes,
    availableFonts,
  } = useTheme();
  const { user, signOut } = useAuth();
  const push = usePushNotifications();
  const [masterEnabled, setMasterEnabled] = useState(push.isSubscribed);

  const notifPrefs = settings.notificationPrefs;

  const handleMasterToggle = useCallback(async () => {
    if (masterEnabled) {
      await push.disable();
      setMasterEnabled(false);
    } else {
      await push.enable();
      setMasterEnabled(true);
    }
  }, [masterEnabled, push]);

  const toggleCategory = useCallback(
    (key: "riskflow" | "dailyBrief" | "regimeActivations") => {
      const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
      updateSettings({ notificationPrefs: updated });
      if (push.isSubscribed) {
        const { severityThreshold: _, ...cats } = updated;
        push.syncCategories(cats);
      }
    },
    [notifPrefs, updateSettings, push],
  );

  const setSeverity = useCallback(
    (idx: number) => {
      const value = SEVERITY_VALUES[idx];
      const updated = { ...notifPrefs, severityThreshold: value };
      updateSettings({ notificationPrefs: updated });
      if (push.isSubscribed) {
        const { severityThreshold: _, ...cats } = updated;
        push.syncCategories(cats, value);
      }
    },
    [notifPrefs, updateSettings, push],
  );

  const severityIdx = SEVERITY_VALUES.indexOf(notifPrefs.severityThreshold);

  return (
    <div
      style={{
        padding: "24px 16px",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {/* NOTIFICATIONS */}
      <section>
        <SectionHeader label="Notifications" />
        <SettingRow label="Push Notifications">
          <Toggle
            on={masterEnabled}
            onToggle={handleMasterToggle}
            disabled={push.isLoading || push.permissionStatus === "denied"}
          />
        </SettingRow>
        {push.permissionStatus === "denied" && (
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 12,
              marginTop: -4,
            }}
          >
            Blocked by browser — enable in system settings
          </div>
        )}
        {masterEnabled && (
          <>
            <SettingRow label="RiskFlow Alerts">
              <Toggle
                on={notifPrefs.riskflow}
                onToggle={() => toggleCategory("riskflow")}
              />
            </SettingRow>
            <SettingRow label="Daily Brief">
              <Toggle
                on={notifPrefs.dailyBrief}
                onToggle={() => toggleCategory("dailyBrief")}
              />
            </SettingRow>
            <SettingRow label="Regime Activations">
              <Toggle
                on={notifPrefs.regimeActivations}
                onToggle={() => toggleCategory("regimeActivations")}
              />
            </SettingRow>

            {/* Severity threshold segmented control */}
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                SEVERITY THRESHOLD
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  border: "1px solid var(--border-visible)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {SEVERITY_SEGMENTS.map((seg, i) => (
                  <button
                    key={seg}
                    onClick={() => setSeverity(i)}
                    style={{
                      padding: "8px 0",
                      fontSize: 11,
                      fontFamily: "'Space Mono', monospace",
                      background:
                        i === severityIdx
                          ? "var(--text-display)"
                          : "transparent",
                      color:
                        i === severityIdx
                          ? "var(--black, #000)"
                          : "var(--text-secondary)",
                      border: "none",
                      borderRight:
                        i < 3 ? "1px solid var(--border-visible)" : "none",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </div>

            {/* Test button */}
            <button
              onClick={push.sendTestNotification}
              style={{
                marginTop: 12,
                padding: "10px 16px",
                background: "transparent",
                border: "1px solid var(--border-visible)",
                color: "var(--text-secondary)",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                cursor: "pointer",
                borderRadius: 4,
                minHeight: 44,
              }}
            >
              [TEST NOTIFICATION]
            </button>
          </>
        )}
        {masterEnabled && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            {push.isSubscribed ? "[ENABLED]" : "[DISABLED]"}
          </div>
        )}
      </section>

      {/* APPEARANCE */}
      <section>
        <SectionHeader label="Appearance" />
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: "var(--text-secondary)",
            marginBottom: 8,
            letterSpacing: "0.05em",
          }}
        >
          THEME
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
          }}
        >
          {Object.values(availableThemes).map((t: ThemeConfig) => (
            <button
              key={t.name}
              onClick={() => setTheme(t)}
              title={t.label}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: t.bg,
                border:
                  theme.name === t.name
                    ? `2px solid var(--accent, ${t.accent})`
                    : "1px solid var(--border-visible)",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  background: t.accent,
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                }}
              />
            </button>
          ))}
        </div>

        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: "var(--text-secondary)",
            marginBottom: 8,
            marginTop: 16,
            letterSpacing: "0.05em",
          }}
        >
          FONT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.values(availableFonts).map((f: FontTheme) => (
            <button
              key={f.id}
              onClick={() => setFontTheme(f)}
              style={{
                padding: "10px 12px",
                background: "transparent",
                border:
                  fontTheme.id === f.id
                    ? "1px solid var(--accent, #D4AF37)"
                    : "1px solid var(--border-visible)",
                color: "var(--text-primary)",
                fontFamily: f.fontHeading,
                fontSize: 14,
                cursor: "pointer",
                borderRadius: 6,
                textAlign: "left",
                minHeight: 44,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ACCOUNT */}
      <section>
        <SectionHeader label="Account" />
        <div
          style={{
            color: "var(--text-primary)",
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          {user?.email || "Not signed in"}
        </div>
        <button
          onClick={signOut}
          style={{
            marginTop: 8,
            padding: "10px 16px",
            background: "transparent",
            border: "1px solid #EF4444",
            color: "#EF4444",
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            cursor: "pointer",
            borderRadius: 4,
            minHeight: 44,
          }}
        >
          [SIGN OUT]
        </button>
      </section>

      {/* ABOUT */}
      <section>
        <SectionHeader label="About" />
        <div style={{ color: "var(--text-disabled)", fontSize: 12 }}>
          <div>Fintheon Mobile</div>
          <div style={{ marginTop: 4 }}>
            Built {import.meta.env.BUILD_TIME || "dev"}
          </div>
        </div>
      </section>
    </div>
  );
}

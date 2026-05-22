// [claude-code 2026-04-19] S26-P1 T6+T7: absorbed the Hermes / Alert Sounds /
//   Bulletin Reminder toggles from TraderSection (which is now identity-only per TP),
//   and added the new Haptics toggle alongside the other feel/audio controls.
// [claude-code 2026-04-19] TP beta polish: notifications section extracted from the
//   monolithic SettingsPage. Same logic (push master toggle, per-category toggles,
//   severity threshold, test) lifted into a focused module under 300 lines.
import { useState, useCallback, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useSettings } from "../../contexts/SettingsContext";
import type { NotificationPrefs as LegacyNotificationPrefs } from "../../contexts/SettingsContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { SettingToggle } from "./SettingToggle";
import { NOTIFICATION_CATEGORIES } from "../../lib/user-preferences";
import type {
  NotificationCategory,
  NotificationPrefs,
  Severity,
} from "../../lib/user-preferences";

const SEVERITY_SEGMENTS = ["CRIT", "HIGH", "MED", "LOW"] as const;
const SEVERITY_VALUES = ["critical", "high", "medium", "low"] as const;
const BULLETIN_MODES: { id: "once" | "until-pressed"; label: string }[] = [
  { id: "once", label: "ONCE" },
  { id: "until-pressed", label: "UNTIL PRESSED" },
];
const CHANNELS: Array<{
  id: keyof NotificationPrefs["deliveryChannels"];
  label: string;
}> = [
  { id: "web", label: "Web" },
  { id: "push", label: "Push" },
  { id: "desktop", label: "Desktop" },
];
const CATEGORY_TOGGLES: Array<{ id: NotificationCategory; label: string }> = [
  { id: "riskflow", label: "RiskFlow" },
  { id: "geopolitical_alerts", label: "Geopolitical" },
  { id: "econ_alerts", label: "Economic" },
  { id: "dailyBrief", label: "Daily Brief" },
  { id: "regimeActivations", label: "Regime Activations" },
  { id: "regimeProposals", label: "Regime Proposals" },
  { id: "lexiconProposals", label: "Lexicon Proposals" },
  { id: "walkBackReverts", label: "Walk-back Reverts" },
  { id: "toolApprovals", label: "Tool Approvals" },
  { id: "maintenance_request", label: "Maintenance" },
  { id: "chat_relay", label: "Chat Relay" },
  { id: "system", label: "System" },
];
const LEGACY_NOTIFICATION_KEYS = new Set<keyof LegacyNotificationPrefs>([
  "riskflow",
  "dailyBrief",
  "regimeActivations",
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
]);

function categoriesFromNotifications(
  notifications: NotificationPrefs,
): Record<string, boolean> {
  const blocked = new Set(notifications.blockedCategories ?? []);
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      notifications.deliveryChannels.push && !blocked.has(category),
    ]),
  );
}

function legacyWithCategory(
  prefs: LegacyNotificationPrefs,
  category: NotificationCategory,
  enabled: boolean,
): LegacyNotificationPrefs {
  if (!LEGACY_NOTIFICATION_KEYS.has(category as keyof LegacyNotificationPrefs)) {
    return prefs;
  }
  return {
    ...prefs,
    [category]: enabled,
  } as LegacyNotificationPrefs;
}

export function NotificationsSection() {
  const { settings, updateSettings, preferences, setPreferences } = useSettings();
  const push = usePushNotifications();
  const notifPrefs = settings.notificationPrefs;
  const sharedNotifications = preferences.notifications;
  const blockedCategories = new Set(sharedNotifications.blockedCategories ?? []);
  const masterEnabled =
    push.isSubscribed || sharedNotifications.deliveryChannels.push;
  const [deliveryOpen, setDeliveryOpen] = useState(true);

  const [testStatus, setTestStatus] = useState<
    null | "sending" | { ok: true } | { ok: false; msg: string }
  >(null);

  useEffect(() => {
    if (
      sharedNotifications.deliveryChannels.push &&
      !push.isSubscribed &&
      !push.isLoading &&
      push.permissionStatus === "granted"
    ) {
      void push.enable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sharedNotifications.deliveryChannels.push,
    push.isSubscribed,
    push.permissionStatus,
  ]);

  const toggleChannel = useCallback(
    async (channel: keyof NotificationPrefs["deliveryChannels"]) => {
      const enabled = sharedNotifications.deliveryChannels[channel];
      const nextChannels = {
        ...sharedNotifications.deliveryChannels,
        [channel]: !enabled,
      };
      void setPreferences({
        notifications: {
          ...sharedNotifications,
          deliveryChannels: nextChannels,
        },
      });

      if (channel !== "push") return;
      if (enabled) {
      await push.disable();
      const nextPrefs = { ...notifPrefs, pushEnabled: false };
      updateSettings({
        notificationPrefs: nextPrefs,
      });
      return;
    }
    const result = await push.enable();
    if (result.ok) {
      const nextPrefs = { ...notifPrefs, pushEnabled: true };
      updateSettings({ notificationPrefs: nextPrefs });
    } else if (result.reason !== "permission-denied") {
      void setPreferences({
        notifications: {
          ...sharedNotifications,
          deliveryChannels: {
            ...sharedNotifications.deliveryChannels,
            push: false,
          },
        },
      });
      updateSettings({
        notificationPrefs: { ...notifPrefs, pushEnabled: false },
      });
    }
    },
    [push, notifPrefs, updateSettings, sharedNotifications, setPreferences],
  );

  const handleMasterToggle = useCallback(() => {
    void toggleChannel("push");
  }, [toggleChannel]);

  const toggleCategory = useCallback(
    (category: NotificationCategory) => {
      const currentlyEnabled = !blockedCategories.has(category);
      const nextBlocked = currentlyEnabled
        ? [...blockedCategories, category]
        : [...blockedCategories].filter((item) => item !== category);
      const nextNotifications = {
        ...sharedNotifications,
        blockedCategories: nextBlocked,
      };
      const updated = legacyWithCategory(
        notifPrefs,
        category,
        !currentlyEnabled,
      );
      updateSettings({ notificationPrefs: updated });
      void setPreferences({
        notifications: nextNotifications,
      });
      if (push.isSubscribed) {
        push.syncCategories(
          categoriesFromNotifications(nextNotifications),
          nextNotifications.severityThreshold,
        );
      }
    },
    [
      blockedCategories,
      sharedNotifications,
      notifPrefs,
      updateSettings,
      push,
      setPreferences,
    ],
  );

  const setSeverity = useCallback(
    (idx: number) => {
      const value = SEVERITY_VALUES[idx] as Severity;
      const updated = { ...notifPrefs, severityThreshold: value };
      const nextNotifications = {
        ...sharedNotifications,
        severityThreshold: value,
      };
      updateSettings({ notificationPrefs: updated });
      void setPreferences({
        notifications: nextNotifications,
      });
      if (push.isSubscribed) {
        push.syncCategories(categoriesFromNotifications(nextNotifications), value);
      }
    },
    [notifPrefs, updateSettings, push, sharedNotifications, setPreferences],
  );

  const handleTest = useCallback(async () => {
    setTestStatus("sending");
    const result = await push.sendTestNotification();
    if (result.ok) {
      setTestStatus({ ok: true });
    } else {
      const msgMap: Record<string, string> = {
        "no-token": "Not signed in",
        "not-subscribed": "Not subscribed — enable Push first",
        "permission-denied": "Permission denied — enable in system settings",
        network: "Network error",
      };
      setTestStatus({
        ok: false,
        msg: msgMap[result.reason] || result.reason,
      });
    }
    window.setTimeout(() => setTestStatus(null), 4000);
  }, [push]);

  const severityIdx = SEVERITY_VALUES.indexOf(
    sharedNotifications.severityThreshold,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SettingToggle
        label="Push Notifications"
        on={masterEnabled}
        onToggle={handleMasterToggle}
        disabled={push.isLoading || push.permissionStatus === "denied"}
      />
      {push.permissionStatus === "denied" && (
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: 12,
            marginTop: -8,
          }}
        >
          Blocked by browser — enable in system settings
        </span>
      )}

      <button
        onClick={() => setDeliveryOpen((open) => !open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
          padding: "0 2px",
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span>DELIVERY CHANNELS</span>
        <ChevronDown
          size={16}
          style={{
            transform: deliveryOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
            color: "var(--text-secondary)",
          }}
        />
      </button>

      {deliveryOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CHANNELS.map((channel) => (
            <SettingToggle
              key={channel.id}
              label={channel.label}
              on={sharedNotifications.deliveryChannels[channel.id]}
              onToggle={() => void toggleChannel(channel.id)}
              disabled={
                channel.id === "push" &&
                (push.isLoading || push.permissionStatus === "denied")
              }
            />
          ))}
        </div>
      )}

      {(masterEnabled ||
        sharedNotifications.deliveryChannels.web ||
        sharedNotifications.deliveryChannels.desktop) && (
        <>
          {CATEGORY_TOGGLES.map((category) => (
            <SettingToggle
              key={category.id}
              label={category.label}
              on={!blockedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
            />
          ))}

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
              SEVERITY THRESHOLD
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {SEVERITY_SEGMENTS.map((seg, i) => {
                const active = i === severityIdx;
                return (
                  <button
                    key={seg}
                    onClick={() => setSeverity(i)}
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
                        i < 3
                          ? "1px solid color-mix(in srgb, var(--accent) 16%, transparent)"
                          : "none",
                      cursor: "pointer",
                      minHeight: 44,
                      transition: "background 200ms ease, color 200ms ease",
                    }}
                  >
                    {seg}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              height: 1,
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              margin: "4px 0",
            }}
          />

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
            label="Haptics"
            on={settings.hapticEnabled}
            onToggle={() =>
              updateSettings({ hapticEnabled: !settings.hapticEnabled })
            }
          />

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
              BULLETIN REMINDER GLOW
            </div>
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
                    onClick={() =>
                      updateSettings({ bulletinReminder: mode.id })
                    }
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
          </div>

          <button
            onClick={handleTest}
            disabled={testStatus === "sending" || !masterEnabled}
            style={{
              marginTop: 4,
              padding: "12px 16px",
              background: "transparent",
              border:
                "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              color: "var(--accent)",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.08em",
              cursor: testStatus === "sending" ? "wait" : "pointer",
              borderRadius: 8,
              minHeight: 44,
              opacity: testStatus === "sending" || !masterEnabled ? 0.6 : 1,
              WebkitTapHighlightColor: "transparent",
              transition: "opacity 200ms ease, background 200ms ease",
            }}
          >
            {testStatus === "sending"
              ? "[SENDING...]"
              : masterEnabled
                ? "[TEST NOTIFICATION]"
                : "[ENABLE PUSH TO TEST]"}
          </button>
          {testStatus && testStatus !== "sending" && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color:
                  "ok" in testStatus && testStatus.ok
                    ? "var(--accent)"
                    : "var(--text-secondary)",
              }}
            >
              {"ok" in testStatus && testStatus.ok
                ? "[SENT — check your device]"
                : `[ERROR: ${"msg" in testStatus ? testStatus.msg : "unknown"}]`}
            </span>
          )}

          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              color: "var(--text-disabled)",
              letterSpacing: "0.08em",
            }}
          >
            {push.isSubscribed ? "[ENABLED]" : "[DISABLED]"}
          </span>
        </>
      )}
    </div>
  );
}

// [claude-code 2026-04-19] TP beta polish: notifications section extracted from the
//   monolithic SettingsPage. Same logic (push master toggle, per-category toggles,
//   severity threshold, test) lifted into a focused module under 300 lines.
import { useState, useCallback, useEffect } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { SettingToggle } from "./SettingToggle";

const SEVERITY_SEGMENTS = ["CRIT", "HIGH", "MED", "LOW"] as const;
const SEVERITY_VALUES = ["critical", "high", "medium", "low"] as const;

export function NotificationsSection() {
  const { settings, updateSettings } = useSettings();
  const push = usePushNotifications();
  const notifPrefs = settings.notificationPrefs;
  const masterEnabled = push.isSubscribed || notifPrefs.pushEnabled;

  const [testStatus, setTestStatus] = useState<
    null | "sending" | { ok: true } | { ok: false; msg: string }
  >(null);

  useEffect(() => {
    if (
      notifPrefs.pushEnabled &&
      !push.isSubscribed &&
      !push.isLoading &&
      push.permissionStatus === "granted"
    ) {
      void push.enable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPrefs.pushEnabled, push.isSubscribed, push.permissionStatus]);

  const handleMasterToggle = useCallback(async () => {
    if (masterEnabled) {
      await push.disable();
      updateSettings({
        notificationPrefs: { ...notifPrefs, pushEnabled: false },
      });
      return;
    }
    const result = await push.enable();
    if (result.ok) {
      updateSettings({
        notificationPrefs: { ...notifPrefs, pushEnabled: true },
      });
    } else if (result.reason !== "permission-denied") {
      updateSettings({
        notificationPrefs: { ...notifPrefs, pushEnabled: false },
      });
    }
  }, [masterEnabled, push, notifPrefs, updateSettings]);

  const toggleCategory = useCallback(
    (
      key: "riskflow" | "dailyBrief" | "regimeActivations" | "toolApprovals",
    ) => {
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

  const severityIdx = SEVERITY_VALUES.indexOf(notifPrefs.severityThreshold);

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

      {masterEnabled && (
        <>
          <SettingToggle
            label="RiskFlow Alerts"
            on={notifPrefs.riskflow}
            onToggle={() => toggleCategory("riskflow")}
          />
          <SettingToggle
            label="Daily Brief"
            on={notifPrefs.dailyBrief}
            onToggle={() => toggleCategory("dailyBrief")}
          />
          <SettingToggle
            label="Regime Activations"
            on={notifPrefs.regimeActivations}
            onToggle={() => toggleCategory("regimeActivations")}
          />
          <SettingToggle
            label="Tool Approvals"
            on={notifPrefs.toolApprovals}
            onToggle={() => toggleCategory("toolApprovals")}
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

          <button
            onClick={handleTest}
            disabled={testStatus === "sending"}
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
              opacity: testStatus === "sending" ? 0.6 : 1,
              WebkitTapHighlightColor: "transparent",
              transition: "opacity 200ms ease, background 200ms ease",
            }}
          >
            {testStatus === "sending" ? "[SENDING...]" : "[TEST NOTIFICATION]"}
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

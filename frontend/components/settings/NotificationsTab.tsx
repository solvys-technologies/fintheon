// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — notifications tab
import React, { useState } from "react";
import { ChevronDown, Volume2, Mic } from "lucide-react";
import Toggle from "../Toggle";
import { useToast } from "../../contexts/ToastContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  HEALING_BOWL_SOUNDS,
  healingBowlPlayer,
} from "../../utils/healingBowlSounds";
import type {
  NotificationCategory,
  NotificationPrefs,
  Severity,
} from "../../lib/user-preferences";

interface NotificationsTabProps {
  alertConfig: any;
  setAlertConfig: (config: any) => void;
  voiceMemory: {
    micDeviceId: string | null;
    setMicDeviceId: (id: string | null) => void;
    devices: MediaDeviceInfo[];
  };
}

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
const SEVERITY_SEGMENTS: Array<{ label: string; value: Severity }> = [
  { label: "CRIT", value: "critical" },
  { label: "HIGH", value: "high" },
  { label: "MED", value: "medium" },
  { label: "LOW", value: "low" },
];

export function NotificationsTab({
  alertConfig,
  setAlertConfig,
  voiceMemory,
}: NotificationsTabProps) {
  const { preferences, updatePreferences } = useSettings();
  const notifications = preferences.notifications;
  const blockedCategories = new Set(notifications.blockedCategories ?? []);
  const [deliveryOpen, setDeliveryOpen] = useState(true);

  const updateNotificationPrefs = (next: NotificationPrefs) => {
    updatePreferences({ notifications: next });
  };

  const toggleChannel = (
    channel: keyof NotificationPrefs["deliveryChannels"],
    enabled: boolean,
  ) => {
    updateNotificationPrefs({
      ...notifications,
      deliveryChannels: {
        ...notifications.deliveryChannels,
        [channel]: enabled,
      },
    });
  };

  const toggleCategory = (category: NotificationCategory, enabled: boolean) => {
    const nextBlocked = enabled
      ? [...blockedCategories].filter((item) => item !== category)
      : [...blockedCategories, category];
    updateNotificationPrefs({
      ...notifications,
      blockedCategories: nextBlocked,
    });
  };

  return (
    <>
      <section>
        <button
          type="button"
          onClick={() => setDeliveryOpen((open) => !open)}
          className="mb-3 flex w-full items-center justify-between text-sm font-semibold text-[var(--fintheon-accent)]"
        >
          <span>Delivery Channels</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${deliveryOpen ? "rotate-180" : ""}`}
          />
        </button>
        {deliveryOpen && (
          <div className="space-y-3">
            {CHANNELS.map((channel) => (
              <Toggle
                key={channel.id}
                label={channel.label}
                enabled={notifications.deliveryChannels[channel.id]}
                onChange={(val) => toggleChannel(channel.id, val)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pt-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Notification Types
        </h3>
        <div className="space-y-3">
          {CATEGORY_TOGGLES.map((category) => (
            <Toggle
              key={category.id}
              label={category.label}
              enabled={!blockedCategories.has(category.id)}
              onChange={(val) => toggleCategory(category.id, val)}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/20">
          {SEVERITY_SEGMENTS.map((item, index) => {
            const active = notifications.severityThreshold === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  updateNotificationPrefs({
                    ...notifications,
                    severityThreshold: item.value,
                  })
                }
                className={`min-h-10 text-[11px] font-mono transition-colors ${
                  active
                    ? "bg-[var(--fintheon-accent)] text-black"
                    : "text-zinc-400 hover:bg-[var(--fintheon-accent)]/10"
                } ${index < 3 ? "border-r border-[var(--fintheon-accent)]/15" : ""}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Alert Configuration
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Price Alerts"
            enabled={alertConfig.priceAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, priceAlerts: val })
            }
          />
          <Toggle
            label="Psychological Alerts"
            enabled={alertConfig.psychAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, psychAlerts: val })
            }
          />
          <Toggle
            label="News Alerts"
            enabled={alertConfig.newsAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, newsAlerts: val })
            }
          />
          <Toggle
            label="Sound Enabled"
            enabled={alertConfig.soundEnabled}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, soundEnabled: val })
            }
          />
          <Toggle
            label="Nametag Emotional Indicator"
            enabled={alertConfig.nametagEmoPulse ?? true}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, nametagEmoPulse: val })
            }
          />

          {/* VIX Spike Threshold */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-white">VIX Spike Threshold</span>
              <p className="text-[10px] text-gray-500">
                Toast when VIX crosses above this level
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={15}
                max={40}
                step={1}
                value={alertConfig.vixSpikeThreshold ?? 22}
                onChange={(e) =>
                  setAlertConfig({
                    ...alertConfig,
                    vixSpikeThreshold: Number(e.target.value),
                  })
                }
                className="w-20 accent-[var(--fintheon-accent)]"
              />
              <span className="text-sm font-mono text-[var(--fintheon-accent)] w-6 text-right">
                {alertConfig.vixSpikeThreshold ?? 22}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Don't Show Again — reset blocked notifications */}
      <DndResetSection />

      <section className="pt-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Healing Bowl Sound
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Select a sound to play when emotional tilt is detected. Calm sounds
          are relaxing, shock sounds are alerting.
        </p>
        <div className="space-y-2">
          {HEALING_BOWL_SOUNDS.map((sound) => (
            <div
              key={sound.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                alertConfig.healingBowlSound === sound.id
                  ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40"
                  : "bg-[var(--fintheon-surface)] border-zinc-800 hover:border-zinc-700"
              }`}
              onClick={() =>
                setAlertConfig({ ...alertConfig, healingBowlSound: sound.id })
              }
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    {sound.name}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      sound.type === "calm"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    }`}
                  >
                    {sound.type}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{sound.description}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  healingBowlPlayer.preview(sound.id);
                }}
                className="ml-3 p-2 rounded-lg bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/20 transition-colors"
                title="Preview sound"
              >
                <Volume2 className="w-4 h-4 text-[var(--fintheon-accent)]" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="pt-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3 flex items-center gap-2">
          <Mic className="w-4 h-4" />
          Microphone Device
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Select which microphone to use for voice commands. Changes apply on
          next voice session.
        </p>
        <select
          value={voiceMemory.micDeviceId ?? ""}
          onChange={(e) => voiceMemory.setMicDeviceId(e.target.value || null)}
          className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
        >
          <option value="">System Default</option>
          {voiceMemory.devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone (${device.deviceId.slice(0, 8)}...)`}
            </option>
          ))}
        </select>
        {voiceMemory.devices.length === 0 && (
          <p className="text-[11px] text-zinc-600 mt-2">
            No microphones detected. Grant microphone permission to see devices.
          </p>
        )}
      </section>
    </>
  );
}

// [claude-code 2026-03-20] S3:T5 — Don't Show Again reset section
function DndResetSection() {
  const { blockedTypes, resetBlockedNotifications } = useToast();

  if (blockedTypes.length === 0) return null;

  return (
    <section className="pt-6">
      <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
        Blocked Notifications
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        You've hidden {blockedTypes.length} notification type
        {blockedTypes.length > 1 ? "s" : ""} via "Don't Show Again".
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {blockedTypes.map((type: string) => (
          <span
            key={type}
            className="text-[10px] px-2 py-1 rounded-full border"
            style={{
              borderColor: "var(--fintheon-accent)",
              color: "var(--fintheon-accent)",
              backgroundColor: "rgba(199,159,74,0.08)",
            }}
          >
            {type}
          </span>
        ))}
      </div>
      <button
        onClick={resetBlockedNotifications}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
        style={{
          borderColor: "rgba(239,68,68,0.3)",
          color: "#EF4444",
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        Reset All — Show Everything
      </button>
    </section>
  );
}

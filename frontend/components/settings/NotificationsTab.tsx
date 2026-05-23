// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — notifications tab
import { useState } from "react";
import { ChevronDown, Volume2, Mic } from "lucide-react";
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
    <div className="space-y-6 text-right">
      <section className="fintheon-fade-divider pb-2">
        <button
          type="button"
          onClick={() => setDeliveryOpen((open) => !open)}
          className="mb-3 flex w-full items-center justify-end gap-2 text-right text-sm font-semibold text-[var(--fintheon-accent)]"
        >
          <span>Delivery Channels</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${deliveryOpen ? "rotate-180" : ""}`}
          />
        </button>
        {deliveryOpen && (
          <div className="space-y-0">
            {CHANNELS.map((channel) => (
              <SettingsToggleRow
                key={channel.id}
                label={channel.label}
                enabled={notifications.deliveryChannels[channel.id]}
                onChange={(val) => toggleChannel(channel.id, val)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="fintheon-fade-divider pb-2">
        <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Notification Types
        </h3>
        <div className="space-y-0">
          {CATEGORY_TOGGLES.map((category) => (
            <SettingsToggleRow
              key={category.id}
              label={category.label}
              enabled={!blockedCategories.has(category.id)}
              onChange={(val) => toggleCategory(category.id, val)}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            Minimum severity
          </span>
          <div className="flex overflow-hidden rounded-md border border-[var(--fintheon-accent)]/15">
            {SEVERITY_SEGMENTS.map((item) => {
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
                  className={`h-8 min-w-14 px-3 text-[10px] font-mono transition-colors ${
                    active
                      ? "bg-[var(--fintheon-accent)] text-black"
                      : "text-zinc-400 hover:bg-[var(--fintheon-accent)]/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="fintheon-fade-divider pb-2">
        <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Alert Configuration
        </h3>
        <div className="space-y-0">
          <SettingsToggleRow
            label="Price Alerts"
            enabled={alertConfig.priceAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, priceAlerts: val })
            }
          />
          <SettingsToggleRow
            label="Psychological Alerts"
            enabled={alertConfig.psychAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, psychAlerts: val })
            }
          />
          <SettingsToggleRow
            label="News Alerts"
            enabled={alertConfig.newsAlerts}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, newsAlerts: val })
            }
          />
          <SettingsToggleRow
            label="Sound Enabled"
            enabled={alertConfig.soundEnabled}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, soundEnabled: val })
            }
          />
          <SettingsToggleRow
            label="Nametag Emotional Indicator"
            enabled={alertConfig.nametagEmoPulse ?? true}
            onChange={(val) =>
              setAlertConfig({ ...alertConfig, nametagEmoPulse: val })
            }
          />

          {/* VIX Spike Threshold */}
          <div className="fintheon-fade-divider flex items-center justify-between gap-4 py-3 text-right">
            <div className="min-w-0 text-right">
              <span className="text-[11px] font-medium text-white">
                VIX Spike Threshold
              </span>
              <p className="mt-0.5 text-[10px] text-gray-500">
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

      <section className="fintheon-fade-divider pb-2">
        <h3 className="mb-1 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          Healing Bowl Sound
        </h3>
        <p className="mb-4 text-right text-xs text-gray-500">
          Select a sound to play when emotional tilt is detected. Calm sounds
          are relaxing, shock sounds are alerting.
        </p>
        <div className="space-y-0">
          {HEALING_BOWL_SOUNDS.map((sound) => (
            <div
              key={sound.id}
              className="fintheon-fade-divider flex cursor-pointer items-center justify-end gap-3 py-3 text-right transition-all hover:opacity-80"
              onClick={() =>
                setAlertConfig({ ...alertConfig, healingBowlSound: sound.id })
              }
            >
              <div className="min-w-0 flex-1 text-right">
                <div className="mb-1 flex items-center justify-end gap-2">
                  <span className="text-[11px] font-medium text-white">
                    {sound.name}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider ${
                      sound.type === "calm"
                        ? "text-blue-400"
                        : "text-orange-400"
                    }`}
                  >
                    {sound.type}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  {sound.description}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  healingBowlPlayer.preview(sound.id);
                }}
                className="fintheon-icon-button shrink-0"
                title="Preview sound"
              >
                <Volume2 className="w-4 h-4 text-[var(--fintheon-accent)]" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1 flex items-center justify-end gap-2 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
          <Mic className="w-4 h-4" />
          Microphone Device
        </h3>
        <p className="mb-4 text-right text-xs text-gray-500">
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
          <p className="mt-2 text-right text-[11px] text-zinc-600">
            No microphones detected. Grant microphone permission to see devices.
          </p>
        )}
      </section>
    </div>
  );
}

// [claude-code 2026-03-20] S3:T5 — Don't Show Again reset section
function DndResetSection() {
  const { blockedTypes, resetBlockedNotifications } = useToast();

  if (blockedTypes.length === 0) return null;

  return (
    <section className="fintheon-fade-divider pb-2 text-right">
      <h3 className="mb-3 text-right text-sm font-semibold text-[var(--fintheon-accent)]">
        Blocked Notifications
      </h3>
      <p className="mb-3 text-right text-xs text-gray-500">
        You've hidden {blockedTypes.length} notification type
        {blockedTypes.length > 1 ? "s" : ""} via "Don't Show Again".
      </p>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {blockedTypes.map((type: string) => (
          <span
            key={type}
            className="text-[10px] text-[var(--fintheon-accent)]"
          >
            {type}
          </span>
        ))}
      </div>
      <button
        onClick={resetBlockedNotifications}
        className="text-xs font-medium text-red-400 transition-colors hover:text-red-300"
      >
        Reset All — Show Everything
      </button>
    </section>
  );
}

function SettingsToggleRow({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="fintheon-fade-divider flex items-center justify-between gap-4 py-3 text-right">
      <span className="text-[11px] font-medium text-white">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-[var(--fintheon-accent)]" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-black transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}

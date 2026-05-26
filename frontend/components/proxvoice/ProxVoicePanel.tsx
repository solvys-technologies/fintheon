import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
  PhoneOff,
  Zap,
} from "lucide-react";
import { useProxVoice } from "../../contexts/ProxVoiceContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { timeAgo } from "../../lib/time-utils";
import { ProfileCard } from "./ProfileCard";
import type { ProxVoiceProfile } from "../../lib/services";

type TabId = "voice" | "audience" | "signals";

interface ProxVoicePanelProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "voice", label: "Voice" },
  { id: "audience", label: "Audience" },
  { id: "signals", label: "Signals" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProxVoicePanel({
  open,
  onClose,
  anchorRect,
}: ProxVoicePanelProps) {
  const voice = useProxVoice();
  const { alerts } = useRiskFlow();
  const [tab, setTab] = useState<TabId>("voice");
  const [profile, setProfile] = useState<ProxVoiceProfile | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    top: number;
    right: number;
  } | null>(null);
  if (!open || !anchorRect) return null;

  const signals = alerts
    .filter(
      (alert) => (alert.ivScore ?? 0) >= 7 || alert.severity === "critical",
    )
    .slice(0, 8);
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 520);
  const right = Math.max(12, window.innerWidth - anchorRect.right);
  const panelPosition = position ?? { top, right };

  return createPortal(
    <>
      <div
        className="fixed z-[9998] w-[380px] overflow-hidden rounded-md bg-[var(--fintheon-surface)] fintheon-fade-in"
        style={panelPosition}
        onMouseMove={(event) => {
          if (!drag) return;
          setPosition({
            top: Math.max(12, drag.top + event.clientY - drag.y),
            right: Math.max(12, drag.right - (event.clientX - drag.x)),
          });
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <div
          className="fintheon-fade-divider flex cursor-move items-center justify-between px-3 py-2"
          onMouseDown={(event) =>
            setDrag({
              x: event.clientX,
              y: event.clientY,
              top: panelPosition.top,
              right: panelPosition.right,
            })
          }
        >
          <div className="flex items-center gap-2 text-[var(--fintheon-accent)]">
            <Radio className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              Forum
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-[var(--fintheon-text)]/45"
          >
            Close
          </button>
        </div>
        <div className="fintheon-fade-divider flex gap-1 px-2 py-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-wide transition-all duration-200 ${
                tab === item.id
                  ? "bg-[var(--fintheon-bg)] text-[var(--fintheon-accent)]"
                  : "text-[var(--fintheon-text)]/45 hover:bg-[var(--fintheon-bg)]/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[420px] overflow-y-auto p-3">
          {tab === "voice" && (
            <div className="space-y-3">
              <div className="fintheon-fade-divider rounded-md bg-[var(--fintheon-bg)] p-3">
                <p className="text-xs text-[var(--fintheon-text)]/60">
                  {voice.state === "connected"
                    ? "Live on the Fintheon floor."
                    : voice.state === "connecting"
                      ? "Connecting to the floor."
                      : "Voice is idle."}
                </p>
                {voice.error && (
                  <p className="mt-2 text-xs text-red-300">{voice.error}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => void voice.toggleMute()}
                  className="fintheon-action-link rounded-md bg-[var(--fintheon-bg)] px-3 py-2 text-xs"
                >
                  {voice.muted ? (
                    <MicOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Mic className="mx-auto h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={voice.toggleDeafen}
                  className="fintheon-action-link rounded-md bg-[var(--fintheon-bg)] px-3 py-2 text-xs"
                >
                  {voice.deafened ? (
                    <VolumeOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Volume2 className="mx-auto h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={voice.disconnect}
                  className="fintheon-action-link rounded-md bg-[var(--fintheon-bg)] px-3 py-2 text-xs text-red-300"
                >
                  <PhoneOff className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {tab === "audience" && (
            <div className="grid grid-cols-4 gap-3">
              {voice.participants.map((participant) => (
                <button
                  key={participant.identity}
                  onClick={() =>
                    participant.profile && setProfile(participant.profile)
                  }
                  className={`proxvoice-pill-shimmer flex flex-col items-center gap-1 rounded-md bg-[var(--fintheon-bg)] p-2 transition-all duration-300 hover:opacity-80 ${
                    participant.leaving
                      ? "opacity-0"
                      : "fintheon-fade-in opacity-100"
                  }`}
                >
                  {participant.profile?.avatarUrl ? (
                    <img
                      src={participant.profile.avatarUrl}
                      alt=""
                      className={`h-10 w-10 rounded-full object-cover ${participant.isSpeaking ? "proxvoice-speaking-ring" : ""}`}
                    />
                  ) : (
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fintheon-surface)] text-[10px] text-[var(--fintheon-accent)] ${participant.isSpeaking ? "proxvoice-speaking-ring" : ""}`}
                    >
                      {initials(participant.name) || "FT"}
                    </span>
                  )}
                  <span className="max-w-full truncate text-[10px] text-[var(--fintheon-text)]/65">
                    {participant.name}
                  </span>
                  <span className="max-w-full truncate text-[9px] text-[var(--fintheon-text)]/35">
                    {participant.profile?.position || "Desk Team"}
                  </span>
                  <span className="max-w-full truncate rounded-sm bg-[var(--fintheon-surface)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/70">
                    {participant.profile?.broker || "Broker TBD"}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.1em] text-[var(--fintheon-text)]/30">
                    {participant.isMuted
                      ? "Muted"
                      : participant.outputMuted
                        ? "Speaker off"
                        : "Listening"}
                  </span>
                </button>
              ))}
              {voice.participants.length === 0 && (
                <p className="col-span-4 text-xs text-[var(--fintheon-text)]/45">
                  Nobody on the floor yet.
                </p>
              )}
            </div>
          )}
          {tab === "signals" && (
            <div className="space-y-2">
              {signals.map((alert) => (
                <article
                  key={alert.id}
                  className="fintheon-fade-divider rounded-md bg-[var(--fintheon-bg)] p-2"
                >
                  <div className="flex items-center gap-2 text-[10px] text-[var(--fintheon-accent)]/75">
                    <Zap className="h-3 w-3" />
                    <span>IV {(alert.ivScore ?? 0).toFixed(1)}</span>
                    <span className="text-[var(--fintheon-text)]/35">
                      {timeAgo(alert.publishedAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--fintheon-text)]/75">
                    {alert.headline}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      {profile && (
        <div
          className="fixed inset-0 z-[9999] flex items-end bg-black/30 p-0 sm:items-start sm:justify-end sm:p-16"
          onClick={() => setProfile(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ProfileCard
              profile={profile}
              mobile={window.innerWidth < 640}
              onClose={() => setProfile(null)}
            />
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

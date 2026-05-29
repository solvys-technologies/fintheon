import { useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Stadium,
  Users,
  Volume2,
  VolumeOff,
  Zap,
} from "lucide-react";
import { useProxVoice } from "../../contexts/ProxVoiceContext";
import { DraggableProfilePopup } from "./DraggableProfilePopup";
import { RiskSignalCards } from "../narrative/RiskSignalCards";
import type { ProxVoiceProfile } from "../../lib/services";

export function ProxVoiceForum() {
  const voice = useProxVoice();
  const [profile, setProfile] = useState<ProxVoiceProfile | null>(null);

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)] text-[var(--fintheon-text)] fintheon-fade-in">
      <header className="px-5 py-4 max-[767px]:px-4 max-[767px]:py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--fintheon-accent)]">
              <Stadium className="h-4 w-4" />
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">
                Forum
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--fintheon-text)]/45">
              Persistent voice for active Fintheon users.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg text-[var(--fintheon-text)]">
              {voice.participants.length}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-text)]/38">
              Traders Listening
            </div>
          </div>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 max-[767px]:p-3 lg:grid-cols-[1fr_320px]">
        <section className="relative min-h-0 overflow-y-auto rounded-md p-4 pb-24 max-[767px]:p-2 max-[767px]:pb-24">
          <div className="fintheon-fade-divider mb-4 flex items-center justify-between gap-2 pb-1 text-xs text-[var(--fintheon-text)]/55">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--fintheon-accent)]" />
              <span>Floor Audience</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {voice.participants.map((participant) => (
              <div
                key={participant.identity}
                className={`rounded-md bg-[var(--fintheon-bg)] p-3 transition-all duration-300 hover:opacity-85 ${
                  participant.leaving
                    ? "opacity-0"
                    : "fintheon-fade-in opacity-100"
                } ${
                  participant.isSpeaking || (participant.audioLevel ?? 0) > 0.08
                    ? "proxvoice-speaking-card"
                    : ""
                }`}
                style={{
                  border:
                    "1px solid color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
                }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      participant.profile && setProfile(participant.profile)
                    }
                    className={`h-10 w-10 rounded-full transition-opacity duration-200 hover:opacity-75 ${
                      participant.isSpeaking ? "proxvoice-speaking-ring" : ""
                    }`}
                  >
                    {participant.profile?.avatarUrl ? (
                      <img
                        src={participant.profile.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fintheon-surface)] text-[10px] text-[var(--fintheon-accent)]">
                        {participant.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-xs">{participant.name}</p>
                    <p className="truncate text-[10px] text-[var(--fintheon-text)]/40">
                      {participant.profile?.position || "Desk Team"}
                    </p>
                    <p className="text-[10px] text-[var(--fintheon-text)]/35">
                      {participant.isMuted
                        ? "Muted"
                        : participant.outputMuted
                          ? "Speaker turned off"
                          : participant.isSpeaking
                            ? "Speaking"
                            : "Traders Listening"}
                    </p>
                  </div>
                  {participant.profile?.broker && (
                    <span className="ml-auto rounded-sm bg-[var(--fintheon-surface)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/75">
                      {participant.profile.broker}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      participant.isLocal
                        ? void voice.toggleMute()
                        : voice.toggleParticipantOutput(participant.identity)
                    }
                    className="fintheon-action-link"
                    title={participant.isLocal ? "Mute mic" : "Mute output"}
                  >
                    {participant.isLocal ? (
                      voice.muted ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )
                    ) : participant.outputMuted ? (
                      <VolumeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            {voice.participants.length === 0 && (
              <p className="text-sm text-[var(--fintheon-text)]/45">
                Join the floor below to start voice.
              </p>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-[var(--fintheon-bg)] px-3 py-2 fintheon-fade-in">
            <button
              onClick={() =>
                voice.state === "connected"
                  ? voice.disconnect()
                  : void voice.connect()
              }
              className="fintheon-action-link px-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              {voice.state === "connected" ? "Leave" : "Join"}
            </button>
            <button
              onClick={() => void voice.toggleMute()}
              className="fintheon-action-link px-2"
            >
              {voice.muted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={voice.toggleDeafen}
              className="fintheon-action-link px-2"
            >
              {voice.deafened ? (
                <VolumeOff className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={voice.disconnect}
              className="fintheon-action-link px-2 text-red-400"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </section>
        <aside className="hidden min-h-0 overflow-hidden rounded-md lg:block">
          <div className="fintheon-fade-divider flex items-center gap-2 px-3 py-2 text-[var(--fintheon-accent)]">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              Risk Signals
            </span>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-3">
            <RiskSignalCards compact />
          </div>
        </aside>
      </main>
      {profile && (
        <DraggableProfilePopup
          profile={profile}
          onClose={() => setProfile(null)}
          initial={{ x: 88, y: 148 }}
        />
      )}
    </div>
  );
}

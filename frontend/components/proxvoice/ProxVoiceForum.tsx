import { Radio, Users, Zap } from "lucide-react";
import { useProxVoice } from "../../contexts/ProxVoiceContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { timeAgo } from "../../lib/time-utils";

export function ProxVoiceForum() {
  const voice = useProxVoice();
  const { alerts } = useRiskFlow();
  const signals = alerts
    .filter((alert) => (alert.ivScore ?? 0) >= 7 || alert.isBreaking)
    .slice(0, 12);

  return (
    <div className="flex h-full flex-col bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <header className="border-b border-[var(--fintheon-accent)]/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--fintheon-accent)]">
              <Radio className="h-4 w-4" />
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase">
                Forum Floor
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--fintheon-text)]/45">
              Persistent voice for active Fintheon users.
            </p>
          </div>
          <button
            onClick={() =>
              voice.state === "connected" ? voice.disconnect() : void voice.connect()
            }
            className="proxvoice-pill-shimmer rounded-full border border-[var(--fintheon-accent)]/25 px-4 py-2 text-xs text-[var(--fintheon-accent)]"
          >
            {voice.state === "connected" ? "Leave Floor" : "Join Floor"}
          </button>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_320px]">
        <section className="min-h-0 overflow-y-auto rounded-xl border border-[var(--fintheon-accent)]/10 p-4">
          <div className="mb-4 flex items-center gap-2 text-xs text-[var(--fintheon-text)]/55">
            <Users className="h-4 w-4 text-[var(--fintheon-accent)]" />
            {voice.participants.length} listening
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {voice.participants.map((participant) => (
              <div
                key={participant.identity}
                className="rounded-xl border border-[var(--fintheon-accent)]/12 p-3"
              >
                <div className="flex items-center gap-3">
                  {participant.profile?.avatarUrl ? (
                    <img
                      src={participant.profile.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full border border-[var(--fintheon-accent)]/20" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs">{participant.name}</p>
                    <p className="text-[10px] text-[var(--fintheon-text)]/35">
                      {participant.isSpeaking ? "Speaking" : "Listening"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {voice.participants.length === 0 && (
              <p className="text-sm text-[var(--fintheon-text)]/45">
                Join the floor from the header to start voice.
              </p>
            )}
          </div>
        </section>
        <aside className="min-h-0 overflow-hidden rounded-xl border border-[var(--fintheon-accent)]/10">
          <div className="flex items-center gap-2 border-b border-[var(--fintheon-accent)]/10 px-3 py-2 text-[var(--fintheon-accent)]">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              Risk Signals
            </span>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto p-3 lg:block lg:space-y-2 lg:overflow-y-auto">
            {signals.map((alert) => (
              <article
                key={alert.id}
                className="min-w-[260px] snap-start rounded-lg border border-[var(--fintheon-accent)]/12 p-3 lg:min-w-0"
              >
                <div className="flex items-center justify-between text-[10px] text-[var(--fintheon-accent)]/70">
                  <span>IV {(alert.ivScore ?? 0).toFixed(1)}</span>
                  <span className="text-[var(--fintheon-text)]/35">
                    {timeAgo(alert.publishedAt)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--fintheon-text)]/75">
                  {alert.headline}
                </p>
              </article>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

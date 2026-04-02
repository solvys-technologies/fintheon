// S13-T3: Call controls with join/leave/mute and participant list
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';

export function CallControls() {
  const { callState, participants, isMuted, error, connect, disconnect, toggleMute } = useLiveKitRoom();

  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';
  const isDisconnecting = callState === 'disconnecting';
  const isBusy = isConnecting || isDisconnecting;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Controls row */}
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={() => connect()}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/20 transition-colors disabled:opacity-40"
          >
            {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
            {isConnecting ? 'Joining...' : 'Join Trading Room'}
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              <PhoneOff size={12} />
              Leave
            </button>
            <button
              onClick={toggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <span className="text-[10px] text-zinc-500 ml-auto font-mono">
              {participants.length} in call
            </span>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <p className="text-[10px] text-red-400/80">{error}</p>
      )}

      {/* Participant list */}
      {isConnected && participants.length > 0 && (
        <div className="flex flex-col gap-1">
          {participants.map((p) => (
            <div
              key={p.identity}
              className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--fintheon-accent)]/5"
            >
              {/* Speaking indicator */}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  p.isSpeaking ? 'bg-emerald-400 animate-pulse' : p.isMuted ? 'bg-zinc-600' : 'bg-emerald-400/40'
                }`}
              />
              <span className="text-[10px] text-zinc-300 font-mono truncate flex-1">
                {p.displayName}
              </span>
              {p.isMuted && <MicOff size={10} className="text-zinc-600 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {/* Idle empty state */}
      {callState === 'idle' && (
        <p className="text-[10px] text-zinc-600 text-center py-2">
          Join the trading room to talk with your team
        </p>
      )}
    </div>
  );
}

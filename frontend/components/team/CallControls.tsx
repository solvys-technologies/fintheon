// S13-T3: Call controls — join/leave/mute UI with participant list
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';

const DEFAULT_ROOM = 'trading-floor';

export function CallControls() {
  const { connect, disconnect, toggleMute, callState, participants, isMuted, error } = useLiveKitRoom();

  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';
  const isDisconnecting = callState === 'disconnecting';
  const isBusy = isConnecting || isDisconnecting;

  return (
    <div className="flex flex-col gap-2">
      {/* Controls bar */}
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={() => connect(DEFAULT_ROOM)}
            disabled={isBusy}
            className="flex items-center gap-1.5 text-[11px] font-medium rounded-md px-3 py-1.5 transition-colors border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40"
          >
            {isConnecting ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
            {isConnecting ? 'Joining...' : 'Join Trading Room'}
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 text-[11px] font-medium rounded-md px-3 py-1.5 transition-colors border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              <PhoneOff size={13} />
              Leave
            </button>
            <button
              onClick={toggleMute}
              className={`flex items-center justify-center rounded-md w-8 h-8 transition-colors border ${
                isMuted
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  : 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
            <span className="text-[10px] text-gray-500">
              {participants.length} in call
            </span>
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}

      {/* Participant list */}
      {isConnected && participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <div
              key={p.identity}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                p.isSpeaking
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5'
                  : p.isMuted
                    ? 'border-zinc-700 text-zinc-500'
                    : 'border-[var(--fintheon-accent)]/20 text-gray-400'
              }`}
            >
              {p.isMuted && <MicOff size={8} className="text-red-400/60" />}
              {p.isSpeaking && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="truncate max-w-[80px]">{p.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

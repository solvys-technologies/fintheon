// S13-T3: Compact call button for TopHeader toolbar
import { Phone, PhoneOff, Loader2 } from 'lucide-react';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';

const DEFAULT_ROOM = 'trading-floor';

export function CallButton({ compact = false }: { compact?: boolean }) {
  const { connect, disconnect, callState, participants, error } = useLiveKitRoom();

  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';
  const isError = callState === 'error';
  const isDisabled = isError && error?.includes('not configured');

  const size = compact ? '24px' : '28px';
  const iconSize = compact ? 11 : 13;

  const handleClick = () => {
    if (isDisabled) return;
    if (isConnected) disconnect();
    else if (callState === 'idle' || isError) connect(DEFAULT_ROOM);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting || isDisabled}
      className="relative rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40"
      style={{
        width: size,
        height: size,
        border: isConnected
          ? '1.5px solid rgba(34,197,94,0.6)'
          : '1.5px solid var(--fintheon-accent)',
        background: isConnected ? 'rgba(34,197,94,0.1)' : '#070704',
        boxShadow: isConnected ? '0 0 8px rgba(34,197,94,0.3)' : 'none',
      }}
      title={
        isDisabled ? 'Voice calls not configured — add LiveKit keys in .env'
          : isConnected ? 'Leave Call'
          : isConnecting ? 'Connecting...'
          : 'Join Call'
      }
    >
      {isConnecting ? (
        <Loader2 size={iconSize} className="animate-spin text-[var(--fintheon-accent)]" />
      ) : isConnected ? (
        <PhoneOff size={iconSize} className="text-emerald-400" />
      ) : (
        <Phone size={iconSize} className={isDisabled ? 'text-zinc-600' : 'text-[var(--fintheon-accent)]'} />
      )}

      {/* Participant count badge */}
      {isConnected && participants.length > 1 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-emerald-500/80 text-white text-[8px] font-bold flex items-center justify-center leading-none">
          {participants.length}
        </span>
      )}
    </button>
  );
}

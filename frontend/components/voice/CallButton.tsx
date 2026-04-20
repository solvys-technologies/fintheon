// S13-T3: Compact call button for TopHeader toolbar
import { Phone, PhoneOff, Loader2 } from "@/components/shared/iso-icons";
import { useLiveKitRoom } from "../../hooks/useLiveKitRoom";

export function CallButton() {
  const { callState, participants, connect, disconnect, error } =
    useLiveKitRoom();

  const isConnected = callState === "connected";
  const isConnecting = callState === "connecting";
  const isError = callState === "error";
  const isDisabled = isError && error?.includes("not configured");

  const handleClick = () => {
    if (isConnected) disconnect();
    else if (callState === "idle" || isError) connect();
  };

  const getTitle = () => {
    if (isDisabled)
      return "Voice calls not configured — add LiveKit keys in .env";
    if (isConnecting) return "Connecting...";
    if (isConnected) return `Leave Call (${participants.length} in room)`;
    if (isError) return `Error: ${error}`;
    return "Join Call";
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting || isDisabled}
      className={`relative p-1.5 rounded-lg text-xs font-medium transition-colors ${
        isConnected
          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
          : isDisabled
            ? "bg-[var(--fintheon-bg)] border border-zinc-700/30 text-zinc-600 cursor-not-allowed"
            : "bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/50"
      } disabled:opacity-50`}
      title={getTitle()}
    >
      {isConnecting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isConnected ? (
        <PhoneOff className="w-3.5 h-3.5" />
      ) : (
        <Phone className="w-3.5 h-3.5" />
      )}
      {isConnected && participants.length > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-emerald-500/80 text-white text-[8px] font-bold flex items-center justify-center leading-none">
          {participants.length}
        </span>
      )}
    </button>
  );
}

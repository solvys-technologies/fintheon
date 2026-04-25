// [claude-code 2026-04-24] Standalone voice waveform overlay. Replaces the
// retired draggable COACH popup. Renders ONLY the waveform — no border, no
// background, no chrome — and doubles for both directions of voice traffic:
//   - listening  → reads as the user's mic (waveform breathes with VAD)
//   - speaking   → reads as the agent's voice (waveform driven by playback)
//   - thinking   → low-amplitude shimmer while the agent is generating
//   - idle/off   → unmounted (returns null)
// Positioned top-center under the header, behind the rim's z-index so the
// rim's mount transition still reads cleanly. Pointer-events: none — this
// surface never eats a trading click.
import { useVoice } from "../../contexts/VoiceContext";
import { WhiteWaveform } from "./WhiteWaveform";

export function AgentVoiceWaveform() {
  const { enabled, runtimeState } = useVoice();

  if (!enabled) return null;
  if (
    runtimeState !== "listening" &&
    runtimeState !== "speaking" &&
    runtimeState !== "thinking"
  ) {
    return null;
  }

  // Speaking + thinking lean louder; listening is breathier.
  const active = runtimeState !== "thinking";

  return (
    <div
      data-testid="agent-voice-waveform"
      aria-hidden="true"
      className="fixed z-[88] pointer-events-none"
      style={{
        top: 38,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: runtimeState === "thinking" ? 0.55 : 0.9,
        transition: "opacity 200ms ease-out",
      }}
    >
      <WhiteWaveform width={132} height={26} barCount={28} active={active} />
    </div>
  );
}

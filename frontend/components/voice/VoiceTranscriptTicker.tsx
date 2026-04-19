// [claude-code 2026-04-19] S27-T5 W2c — single-line scrolling transcript at the
// top-center of the voice rim. Shows the last 120 chars of agent speech as it
// streams. Silent when idle. pointer-events: none so it never eats a trading click.
import { useVoice } from "../../contexts/VoiceContext";

const MAX_CHARS = 120;

interface VoiceTranscriptTickerProps {
  visible: boolean;
}

export function VoiceTranscriptTicker({ visible }: VoiceTranscriptTickerProps) {
  const { runtimeState, lastAssistantText, lastUserText } = useVoice();

  if (!visible) return null;

  const text =
    runtimeState === "speaking" || runtimeState === "thinking"
      ? lastAssistantText
      : runtimeState === "listening"
        ? lastUserText
        : "";

  const trimmed = text.slice(-MAX_CHARS);

  return (
    <div
      data-testid="voice-rim-ticker"
      className="fixed top-[6px] left-1/2 -translate-x-1/2 z-[91] pointer-events-none"
      style={{
        maxWidth: "min(640px, 60vw)",
        padding: "4px 14px",
        fontSize: "11px",
        letterSpacing: "0.04em",
        color: "var(--fintheon-text, #f0ead6)",
        background: "rgba(5, 4, 2, 0.72)",
        border: "1px solid var(--fintheon-accent, #c79f4a)",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        opacity: trimmed ? 0.95 : 0,
        transition: "opacity 180ms ease-out",
      }}
    >
      {trimmed || "\u00a0"}
    </div>
  );
}

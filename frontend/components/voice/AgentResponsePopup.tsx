// [claude-code 2026-04-20] S21-T3: Shared draggable agent-response popup.
// Used by all three Omi triggers: PsychAssist activation, Voice Assistant
// button, Performance-tab chat button.
//
// Behavior (from plan mode Q&A):
//   - Smoothly draggable (pointer events + rAF via useDraggable)
//   - Fades after 5s
//   - Hover pauses the fade timer
//   - Click pins indefinitely (clears timer)
//   - White waveform is the agent's "mouth" — no text by default
//   - Text stream slot only visible when an agent is looping in another agent
//     ("I had the desk search the web, here's what we found:")
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "../../hooks/useDraggable";
import { WhiteWaveform } from "./WhiteWaveform";

const FADE_MS = 5_000;

export type AgentResponseAgent = "coach" | "oracle" | "harper";

export interface AgentResponsePopupProps {
  open: boolean;
  onClose: () => void;
  agent: AgentResponseAgent;
  isSpeaking: boolean;
  amplitudes?: number[];
  preamble?: string;
  streamedText?: string;
  initialPosition?: { x: number; y: number };
}

export function AgentResponsePopup({
  open,
  onClose,
  agent,
  isSpeaking,
  amplitudes,
  preamble,
  streamedText,
  initialPosition,
}: AgentResponsePopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [visible, setVisible] = useState(open);

  const defaultPos = useMemo(
    () =>
      initialPosition ?? {
        x:
          typeof window !== "undefined"
            ? Math.max(0, window.innerWidth - 340)
            : 0,
        y: 80,
      },
    [initialPosition],
  );

  useDraggable({
    elementRef: panelRef,
    handleRef: gripRef,
    storageKey: "fintheon:agent-response-popup-pos",
    bounds: "viewport",
    initialPosition: defaultPos,
    disabled: !open,
  });

  // Fade-after-5s timer. Paused by hover, pin, or streamedText presence.
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (hovered || pinned || isSpeaking || streamedText) return;

    const t = window.setTimeout(() => {
      setVisible(false);
      onClose();
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [open, hovered, pinned, isSpeaking, streamedText, onClose]);

  if (!open && !visible) return null;

  const label =
    agent === "coach" ? "Coach" : agent === "oracle" ? "Oracle" : "Harper";

  return (
    <div
      ref={panelRef}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => setPinned(true)}
      role="dialog"
      aria-label={`${label} voice response`}
      className={`fixed z-[2000] select-none transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        top: 0,
        left: 0,
        width: 320,
        background: "#070704",
        border: "1px solid var(--fintheon-accent)",
        borderRadius: 12,
        color: "var(--fintheon-text)",
      }}
    >
      <div
        ref={gripRef}
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing touch-none"
        style={{
          borderBottom: "1px solid var(--fintheon-accent)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--fintheon-accent)",
              opacity: isSpeaking ? 1 : 0.4,
            }}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
            {label}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-text)]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-5 flex items-center justify-center">
        <WhiteWaveform
          active={isSpeaking}
          amplitudes={amplitudes}
          width={240}
          height={48}
          barCount={32}
        />
      </div>

      {(preamble || streamedText) && (
        <div className="px-4 pb-4 space-y-2">
          {preamble && (
            <p className="text-[12px] text-[var(--fintheon-accent)]/80 italic">
              {preamble}
            </p>
          )}
          {streamedText && (
            <p className="text-[13px] leading-snug text-[var(--fintheon-text)]">
              {streamedText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

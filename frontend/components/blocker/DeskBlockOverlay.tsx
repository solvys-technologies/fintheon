import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { LoadingGlobe } from "../loading/LoadingGlobe";

interface DeskBlockOverlayProps {
  visible: boolean;
  fixed?: boolean;
  countdown?: string | null;
}

export function DeskBlockOverlay({
  visible,
  fixed = false,
  countdown = null,
}: DeskBlockOverlayProps) {
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setContentVisible(false);
      return;
    }
    const id = window.setTimeout(() => setContentVisible(true), 90);
    return () => window.clearTimeout(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={shellStyle(fixed)}>
      <div style={scanlineStyle} />
      <div style={globeStyle(contentVisible)}>
        <LoadingGlobe phase="idle" style={{ width: "100%", height: "100%" }} />
      </div>
      <section style={panelStyle(contentVisible)}>
        <div style={eyebrowStyle}>Jump to NarrativeFlow</div>
        <div style={messageStyle}>Desk Block Enabled. See you next Session!</div>
        {countdown ? <div style={countdownStyle}>{countdown}</div> : null}
        <button
          type="button"
          onClick={jumpToNarrativeFlow}
          style={buttonStyle}
          title="Jump to NarrativeFlow"
          aria-label="Jump to NarrativeFlow"
        >
          Monitor The Situation
        </button>
      </section>
    </div>
  );
}

function jumpToNarrativeFlow() {
  try {
    window.dispatchEvent(new Event("fintheon:jump-to-narrativeflow"));
  } catch {
    /* noop */
  }
}

function shellStyle(fixed: boolean): CSSProperties {
  return {
    position: fixed ? "fixed" : "absolute",
    inset: 0,
    zIndex: fixed ? 99999 : 80,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "#000",
    color: "var(--fintheon-text, #f0ead6)",
  };
}

function globeStyle(visible: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: "-8vmin",
    opacity: visible ? 0.78 : 0,
    transform: visible ? "scale(1)" : "scale(0.98)",
    transition: "opacity 720ms ease, transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

function panelStyle(visible: boolean): CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    justifyItems: "center",
    gap: 12,
    width: "min(390px, calc(100vw - 44px))",
    padding: "16px 18px 18px",
    border: "1px solid color-mix(in srgb, var(--fintheon-accent, #c79f4a) 20%, transparent)",
    borderRadius: 8,
    background: "rgba(0, 0, 0, 0.72)",
    backdropFilter: "blur(16px) saturate(1.12)",
    WebkitBackdropFilter: "blur(16px) saturate(1.12)",
    textAlign: "center",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 520ms ease 100ms, transform 620ms cubic-bezier(0.16, 1, 0.3, 1) 100ms",
  };
}

const scanlineStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 3px), radial-gradient(circle at center, transparent 0 38%, rgba(0,0,0,0.72) 76%)",
  mixBlendMode: "screen",
  opacity: 0.32,
  pointerEvents: "none",
};

const eyebrowStyle: CSSProperties = {
  color: "color-mix(in srgb, var(--fintheon-muted, #6b6455) 76%, var(--fintheon-text, #f0ead6))",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
};

const messageStyle: CSSProperties = {
  color: "var(--fintheon-text, #f0ead6)",
  fontSize: 14,
  fontWeight: 650,
  lineHeight: 1.35,
};

const countdownStyle: CSSProperties = {
  color: "var(--fintheon-accent, #c79f4a)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 24,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 300,
};

const buttonStyle: CSSProperties = {
  marginTop: 2,
  border: "1px solid color-mix(in srgb, var(--fintheon-accent, #c79f4a) 32%, transparent)",
  borderRadius: 6,
  background: "color-mix(in srgb, var(--fintheon-accent, #c79f4a) 17%, transparent)",
  color: "var(--fintheon-accent, #c79f4a)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.11em",
  padding: "9px 13px",
  textTransform: "uppercase",
};

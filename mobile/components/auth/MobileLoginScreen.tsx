import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { LoadingGlobe } from "@frontend/components/loading/LoadingGlobe";
import { LoadingStatusCard } from "@frontend/components/loading/LoadingStatusCard";

interface MobileLoginScreenProps {
  onSignIn: () => void;
  isLoading: boolean;
}

export function MobileLoginScreen({
  onSignIn,
  isLoading,
}: MobileLoginScreenProps) {
  const [submitted, setSubmitted] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => setShowLoader(true), 3000);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  function handleSignIn() {
    if (submitted) return;
    setSubmitted(true);
    void onSignIn();
  }

  const busy = isLoading || showLoader || submitted;

  return (
    <div style={shellStyle}>
      <LoadingGlobe
        phase={submitted ? "auth" : "idle"}
        density={0.82}
        style={globeStyle}
      />
      <div style={scanlineStyle} />
      <div style={washStyle} />
      <main style={contentStyle}>
        <section style={panelStyle}>
          <LoadingStatusCard
            bare
            compact
            phrase={showLoader ? "Opening terminal" : "Access terminal"}
          />
          <button
            onClick={handleSignIn}
            disabled={busy}
            style={{
              ...secondaryButtonStyle,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            [SIGN IN WITH GOOGLE]
          </button>
          <button
            onClick={handleSignIn}
            disabled={busy}
            style={{
              ...primaryButtonStyle,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            [SIGN UP]
          </button>
        </section>
      </main>
    </div>
  );
}

const shellStyle: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  overflow: "hidden",
  background: "var(--fintheon-bg, #050402)",
  color: "var(--fintheon-text, #f0ead6)",
};

const globeStyle: CSSProperties = {
  position: "absolute",
  inset: "-16vmin -54vmin 12vmin -44vmin",
  opacity: 0.74,
  filter: "saturate(1.08) contrast(1.08)",
};

const contentStyle: CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "grid",
  minHeight: "100vh",
  alignItems: "end",
  padding: "24px 22px calc(22px + env(safe-area-inset-bottom))",
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "center",
  width: "100%",
  padding: "14px 12px 15px",
  border:
    "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 18%, transparent)",
  borderRadius: 8,
  background:
    "color-mix(in srgb, var(--fintheon-surface, #0a0905) 72%, transparent)",
  backdropFilter: "blur(22px) saturate(1.22)",
  WebkitBackdropFilter: "blur(22px) saturate(1.22)",
  overflow: "hidden",
};

const buttonBaseStyle: CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-data, 'Space Mono', monospace)",
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderRadius: 999,
  padding: "13px 16px",
  transition:
    "opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  color: "#080705",
  background:
    "linear-gradient(115deg, color-mix(in srgb, #f0ead6 88%, transparent), color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 14%, #f0ead6))",
  border: "1px solid color-mix(in srgb, #f0ead6 66%, transparent)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -14px 24px rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.32)",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  color: "var(--fintheon-text, #f0ead6)",
  background:
    "color-mix(in srgb, var(--fintheon-surface, #0a0905) 44%, transparent)",
  border:
    "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 24%, transparent)",
};

const scanlineStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), radial-gradient(circle at center, transparent 0 42%, rgba(0,0,0,0.56) 78%)",
  mixBlendMode: "screen",
  opacity: 0.28,
  pointerEvents: "none",
};

const washStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  background:
    "linear-gradient(0deg, rgba(5,4,2,0.96) 0%, rgba(5,4,2,0.72) 32%, transparent 70%), linear-gradient(90deg, rgba(5,4,2,0.82), transparent 52%, rgba(5,4,2,0.7))",
  pointerEvents: "none",
};

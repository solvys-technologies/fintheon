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
        density={0.72}
        style={{ position: "absolute", inset: "-8vmin" }}
      />
      <div style={scanlineStyle} />
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
              ...buttonStyle,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            [SIGN IN WITH GOOGLE]
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

const contentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  minHeight: "100vh",
  placeItems: "center",
  padding: 24,
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  justifyItems: "center",
  width: "min(316px, calc(100vw - 48px))",
  padding: "15px 14px 16px",
  border:
    "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 18%, transparent)",
  borderRadius: 8,
  background:
    "color-mix(in srgb, var(--fintheon-surface, #0a0905) 83%, transparent)",
  backdropFilter: "blur(18px) saturate(1.18)",
  WebkitBackdropFilter: "blur(18px) saturate(1.18)",
  overflow: "hidden",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-data, 'Space Mono', monospace)",
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fintheon-text, #f0ead6)",
  background: "transparent",
  border:
    "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 24%, transparent)",
  borderRadius: 8,
  padding: "12px 16px",
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

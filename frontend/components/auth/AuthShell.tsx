// [codex 2026-05-23] Login now shares the dithered Three.js globe with splash.
import React, { useEffect, useRef, useState } from "react";
import { LoadingGlobe } from "../loading/LoadingGlobe";
import { LoadingStatusCard } from "../loading/LoadingStatusCard";
import { TimeQuote } from "./TimeQuote";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { MagicLinkSignInForm } from "./MagicLinkSignInForm";
import { signInWithMagicLink } from "../../lib/supabase";

type AuthShellProps = {
  onSignIn: () => void;
  onSkipAuth?: () => void;
  isLoading?: boolean;
};

export const AuthShell: React.FC<AuthShellProps> = ({
  onSignIn,
  isLoading = false,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const signInTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (signInTimerRef.current) window.clearTimeout(signInTimerRef.current);
    };
  }, []);

  function handleSignIn() {
    if (submitted) return;
    setSubmitted(true);
    signInTimerRef.current = window.setTimeout(() => {
      setShowLoader(true);
      void onSignIn();
    }, 3000);
  }

  const busy = isLoading || submitted;

  return (
    <div style={shellStyle}>
      <LoadingGlobe
        phase={submitted ? "auth" : "idle"}
        style={{ position: "absolute", inset: "-6vmin" }}
      />
      <div style={scanlineStyle} />
      <main style={contentStyle}>
        <section style={panelStyle}>
          <LoadingStatusCard
            bare
            phrase={showLoader ? "Opening terminal" : "Access terminal"}
          />
          <GoogleSignInButton
            onClick={handleSignIn}
            isLoading={isLoading || showLoader}
            disabled={busy}
          />
          <MagicLinkSignInForm
            onSend={signInWithMagicLink}
            disabled={isLoading || showLoader}
          />
          <div style={{ marginTop: 4 }}>
            <TimeQuote />
          </div>
        </section>
      </main>
    </div>
  );
};

const shellStyle: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  width: "100%",
  overflow: "hidden",
  background: "var(--fintheon-bg, #050402)",
  color: "var(--fintheon-text, #f0ead6)",
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  minHeight: "100vh",
  placeItems: "center",
  padding: 24,
};

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  justifyItems: "center",
  width: "min(340px, calc(100vw - 48px))",
  padding: "16px 16px 18px",
  border:
    "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 18%, transparent)",
  borderRadius: 8,
  background:
    "color-mix(in srgb, var(--fintheon-surface, #0a0905) 83%, transparent)",
  backdropFilter: "blur(18px) saturate(1.18)",
  WebkitBackdropFilter: "blur(18px) saturate(1.18)",
  overflow: "hidden",
};

const scanlineStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), radial-gradient(circle at center, transparent 0 42%, rgba(0,0,0,0.56) 78%)",
  mixBlendMode: "screen",
  opacity: 0.28,
  pointerEvents: "none",
};

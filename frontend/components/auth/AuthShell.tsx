import React, { useEffect, useRef, useState } from "react";
import { Activity, Globe2, RadioTower, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LoadingGlobe } from "../loading/LoadingGlobe";
import { FluidCursor } from "./FluidCursor";
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
    <div className="auth-shell">
      <style>{authShellCss}</style>
      <LoadingGlobe
        phase={submitted ? "auth" : "idle"}
        density={1.08}
        className="auth-shell__globe"
        style={{
          position: "absolute",
          zIndex: 0,
          inset: "var(--auth-globe-inset)",
          opacity: "var(--auth-globe-opacity)",
          filter: "saturate(1.08) contrast(1.08)",
        }}
      />
      <FluidCursor phase={submitted ? "auth" : "idle"} />
      <div className="auth-shell__wash" />
      <div className="auth-shell__grain" />
      <header className="auth-shell__brand" aria-label="Fintheon">
        <span className="auth-shell__brand-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>Fintheon</span>
      </header>
      <main className="auth-shell__content">
        <section
          className="auth-shell__copy"
          aria-labelledby="fintheon-auth-title"
        >
          <h1 id="fintheon-auth-title">
            Market intelligence for those who take it seriously
          </h1>
          <div className="auth-shell__points" aria-label="Platform strengths">
            {LOGIN_POINTS.map(({ Icon, label }) => (
              <div className="auth-shell__point" key={label}>
                <span className="auth-shell__point-icon" aria-hidden="true">
                  <Icon size={15} strokeWidth={1.9} />
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="auth-shell__actions" aria-label="Sign in options">
          <GoogleSignInButton
            label={showLoader ? "Opening Fintheon" : "Continue with Google"}
            onClick={handleSignIn}
            isLoading={isLoading || showLoader}
            disabled={busy}
          />
          <MagicLinkSignInForm
            onSend={signInWithMagicLink}
            disabled={isLoading || showLoader}
          />
          <p>Macro, futures, catalysts, and desk discipline in one terminal.</p>
        </section>
      </main>
    </div>
  );
};

const LOGIN_POINTS: Array<{ Icon: LucideIcon; label: string }> = [
  { Icon: Globe2, label: "Multi-asset intelligence" },
  { Icon: RadioTower, label: "Real-time narrative alerts" },
  { Icon: Activity, label: "Agent-led market reads" },
  { Icon: ShieldCheck, label: "Built-in desk discipline" },
];

const authShellCss = `
  .auth-shell {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow: hidden;
    isolation: isolate;
    background: var(--fintheon-bg, #050402);
    color: var(--fintheon-text, #f0ead6);
    --auth-ink: #f0ead6;
    --auth-globe-inset: -10vmin -18vmin -8vmin 24vmin;
    --auth-globe-opacity: 0.94;
  }

  @media (pointer: fine) {
    .auth-shell {
      cursor: none;
    }

    .auth-shell button {
      cursor: pointer;
    }

    .auth-shell input {
      cursor: text;
    }
  }

  .auth-shell__wash,
  .auth-shell__grain {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .auth-shell__wash {
    background:
      radial-gradient(circle at 68% 29%, color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 10%, transparent), transparent 28%),
      linear-gradient(90deg, rgba(5, 4, 2, 0.92) 0%, rgba(5, 4, 2, 0.64) 34%, rgba(5, 4, 2, 0.17) 66%, rgba(5, 4, 2, 0.78) 100%),
      linear-gradient(0deg, rgba(5, 4, 2, 0.9) 0%, transparent 28%, transparent 68%, rgba(5, 4, 2, 0.68) 100%);
  }

  .auth-shell__grain {
    opacity: 0.2;
    mix-blend-mode: screen;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px);
  }

  .auth-shell__brand {
    position: absolute;
    top: clamp(1.35rem, 3vw, 2.25rem);
    left: clamp(1.5rem, 2.8vw, 2.35rem);
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: color-mix(in srgb, var(--auth-ink) 96%, transparent);
    font: 700 1.05rem/1 var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  }

  .auth-shell__brand-mark {
    position: relative;
    display: inline-grid;
    width: 0.86rem;
    height: 1.12rem;
  }

  .auth-shell__brand-mark i {
    position: absolute;
    left: 0;
    width: 0.43rem;
    height: 0.43rem;
    border-radius: 999px;
    background: currentColor;
  }

  .auth-shell__brand-mark i:first-child {
    top: 0;
  }

  .auth-shell__brand-mark i:last-child {
    bottom: 0;
  }

  .auth-shell__content {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 100vh;
    padding: clamp(5.4rem, 10vh, 7.8rem) clamp(1.5rem, 2.8vw, 2.35rem) clamp(1.35rem, 3.2vh, 2.1rem);
  }

  .auth-shell__copy {
    align-self: center;
    width: min(30rem, 100%);
    transform: translateY(-5vh);
  }

  .auth-shell__copy h1 {
    margin: 0;
    color: color-mix(in srgb, var(--auth-ink) 97%, transparent);
    font-family: "Iowan Old Style", Georgia, serif;
    font-size: clamp(2.32rem, 4.1vw, 4.2rem);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 0.96;
    text-wrap: balance;
    text-shadow: 0 1px 22px rgba(0, 0, 0, 0.55);
  }

  .auth-shell__points {
    display: grid;
    gap: 0.58rem;
    margin-top: clamp(1.45rem, 3.2vh, 2.1rem);
  }

  .auth-shell__point {
    display: flex;
    align-items: center;
    gap: 0.58rem;
    min-height: 2.2rem;
    color: color-mix(in srgb, var(--auth-ink) 72%, transparent);
    font-size: 0.95rem;
    line-height: 1.2;
  }

  .auth-shell__point-icon {
    display: inline-flex;
    width: 2.1rem;
    height: 2.1rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--auth-ink) 11%, transparent);
    border-radius: 0.42rem;
    color: color-mix(in srgb, var(--auth-ink) 90%, var(--fintheon-primary, var(--fintheon-accent)));
    background: color-mix(in srgb, var(--auth-ink) 9%, transparent);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
  }

  .auth-shell__actions {
    display: grid;
    gap: 0.8rem;
    width: 100%;
  }

  .auth-shell__actions p {
    margin: 0.2rem 0 0;
    color: color-mix(in srgb, var(--auth-ink) 45%, transparent);
    font-size: 0.78rem;
    line-height: 1.45;
    text-align: center;
  }

  @media (max-width: 720px) {
    .auth-shell {
      --auth-globe-inset: -14vmin -52vmin 10vmin 5vmin;
      --auth-globe-opacity: 0.72;
    }

    .auth-shell__wash {
      background:
        linear-gradient(90deg, rgba(5, 4, 2, 0.9), rgba(5, 4, 2, 0.48) 54%, rgba(5, 4, 2, 0.76)),
        linear-gradient(0deg, rgba(5, 4, 2, 0.95), transparent 42%, rgba(5, 4, 2, 0.62));
    }

    .auth-shell__content {
      padding-top: 6.5rem;
    }

    .auth-shell__copy {
      transform: translateY(-2vh);
    }

    .auth-shell__copy h1 {
      font-size: clamp(2.05rem, 11vw, 3.25rem);
      max-width: 9.5em;
    }

    .auth-shell__point {
      font-size: 0.9rem;
    }
  }
`;

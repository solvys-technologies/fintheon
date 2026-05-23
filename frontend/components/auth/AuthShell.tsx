// [codex 2026-05-23] Globe login motion: accelerated sign-in state and
// compact fuse/message container, replacing the old card/rectangle layout.
import React, { useEffect, useRef, useState } from "react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";
import { TimeQuote } from "./TimeQuote";
import { GoogleSignInButton } from "./GoogleSignInButton";

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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050402] text-[#f0ead6] selection:bg-[#c79f4a]/25">
      <div className="absolute inset-0 opacity-[0.22]">
        <div className="absolute left-1/2 top-1/2 h-[82vmin] w-[82vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c79f4a]/8" />
      </div>
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-5">
          <GlobeMark accelerated={submitted} />
          <div className="text-center">
            <h1
              className="text-3xl font-light tracking-[0.24em] text-[#c79f4a]"
              style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
            >
              FINTHEON
            </h1>
            <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-[#f0ead6]/52">
              Integrated Trading Environment
            </p>
          </div>
        </div>

        <div className="w-full max-w-[360px] rounded-[22px] border border-[#c79f4a]/18 bg-[#0a0905]/92 px-5 py-5">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-[2px] w-12 overflow-hidden rounded-[2px] bg-[#c79f4a]/15">
              <span
                className="block h-full w-1/2 bg-[#c79f4a]/55"
                style={{ animation: "authFuse 1800ms ease-in-out infinite" }}
              />
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#c79f4a]/70">
              {showLoader ? "Opening terminal" : "Access terminal"}
            </span>
          </div>
          {showLoader ? (
            <div className="mb-4 flex justify-center">
              <DotMatrixLoader
                variant="diagonal-scan"
                size={34}
                label="Authenticating"
              />
            </div>
          ) : null}
          <GoogleSignInButton
            onClick={handleSignIn}
            isLoading={isLoading || showLoader}
            disabled={busy}
          />
          <div className="mt-5 text-center">
            <TimeQuote />
          </div>
        </div>
      </main>
      <style>{`
        @keyframes authFuse {
          0%, 100% { transform: translateX(-85%); opacity: 0.35; }
          50% { transform: translateX(170%); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
};

function GlobeMark({ accelerated }: { accelerated: boolean }) {
  const duration = accelerated ? "6s" : "18s";
  return (
    <div className="relative h-48 w-48" aria-hidden="true">
      <svg viewBox="0 0 160 160" className="h-full w-full text-[#c79f4a]">
        <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeOpacity=".42" />
        <g style={{ transformOrigin: "80px 80px", animation: `authGlobe ${duration} linear infinite` }}>
          <ellipse cx="80" cy="80" rx="58" ry="18" fill="none" stroke="currentColor" strokeOpacity=".28" />
          <ellipse cx="80" cy="80" rx="58" ry="34" fill="none" stroke="currentColor" strokeOpacity=".22" />
          <path d="M80 22c-22 20-22 96 0 116M80 22c22 20 22 96 0 116" fill="none" stroke="currentColor" strokeOpacity=".32" />
          <path d="M28 58h104M28 102h104" fill="none" stroke="currentColor" strokeOpacity=".2" />
        </g>
        <circle cx="80" cy="80" r="4" fill="currentColor" opacity=".75" />
      </svg>
      <style>{`
        @keyframes authGlobe {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

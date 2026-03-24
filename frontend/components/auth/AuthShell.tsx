// [claude-code 2026-03-24] T2 — Login screen redesign: split layout, ASCII background, time quotes
import React from 'react';
import { TimeQuote } from './TimeQuote';
import { GoogleSignInButton } from './GoogleSignInButton';

type AuthShellProps = {
  onSignIn: () => void;
  isLoading?: boolean;
};

export const AuthShell: React.FC<AuthShellProps> = ({ onSignIn, isLoading = false }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-[#050402] text-white selection:bg-yellow-500/30">

    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 md:flex-row md:items-start md:px-0">
      {/* Left — Branding column (60%), top-aligned with login card */}
      <div className="flex w-full flex-col items-center justify-center gap-6 py-16 md:mt-[calc(50vh-80px)] md:w-[60%] md:items-start md:justify-start md:py-0 md:pl-[10%]">
        <div className="flex flex-col items-center gap-5 md:items-start">
          <h1
            className="text-3xl font-light tracking-[0.5em] text-[#c79f4a] drop-shadow-[0_0_12px_rgba(199,159,74,0.4)]"
            style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
          >
            FINTHEON
          </h1>
          <p
            className="text-xs tracking-[0.3em] text-[#f0ead6]/70"
            style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
          >
            Integrated Trading Environment
          </p>
        </div>

        <div className="mt-4">
          <TimeQuote />
        </div>
      </div>

      {/* Right — Login card (40%), top-aligned with branding */}
      <div className="flex w-full flex-col items-center justify-center py-12 md:mt-[calc(50vh-80px)] md:w-[40%] md:justify-start md:py-0 md:pr-[8%]">
        <div className="w-full max-w-sm rounded-2xl border border-[#c79f4a]/20 bg-[#0a0906]/90 px-8 py-10 shadow-[0_25px_55px_rgba(0,0,0,0.65)] backdrop-blur-lg">
          <p
            className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.4em] text-[#c79f4a]/70"
            style={{ fontVariant: 'small-caps' }}
          >
            Access Terminal
          </p>

          <GoogleSignInButton onClick={onSignIn} isLoading={isLoading} />
        </div>

        {/* Footer links */}
        <footer className="mt-6 flex gap-6 text-[11px] font-medium uppercase tracking-[0.25em] text-yellow-600/90">
          <a
            href="#"
            className="transition-all duration-300 hover:text-yellow-400"
          >
            Terms of Use
          </a>
          <span className="text-yellow-800">&bull;</span>
          <a
            href="#"
            className="transition-all duration-300 hover:text-yellow-400"
          >
            Privacy Policy
          </a>
        </footer>
      </div>
    </main>
  </div>
);

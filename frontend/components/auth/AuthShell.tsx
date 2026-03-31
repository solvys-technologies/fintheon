// [claude-code 2026-03-31] Login screen — hero-bg-2, top-aligned layout, frosted branding window
import React from 'react';
import { TimeQuote } from './TimeQuote';
import { GoogleSignInButton } from './GoogleSignInButton';

type AuthShellProps = {
  onSignIn: () => void;
  isLoading?: boolean;
};

export const AuthShell: React.FC<AuthShellProps> = ({ onSignIn, isLoading = false }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-[#050402] text-white selection:bg-yellow-500/30">

    {/* Hero background — bull vs bear halftone (relative path for Electron) */}
    <div
      className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.12]"
      style={{ backgroundImage: "url('./halftone-heroes/hero-bg-2.png')" }}
    />
    {/* Gradient overlay — darkens left for text readability */}
    <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#050402]/95 via-[#050402]/70 to-[#050402]/40" />

    {/* Both columns use items-start with same top padding so boxes are horizontally aligned */}
    <main className="relative z-10 flex min-h-screen flex-col items-center px-6 pt-[30vh] md:flex-row md:items-start md:px-0">
      {/* Left — Branding (55%) */}
      <div className="flex w-full flex-col items-center md:w-[55%] md:items-start md:pl-[10%]">
        {/* Frosted glass window */}
        <div className="rounded-xl border border-[#c79f4a]/10 bg-[#050402]/60 px-8 py-8 backdrop-blur-sm">
          {/* Logo + Title inline */}
          <div className="flex items-center gap-4">
            <img
              src="./logo.png"
              alt="Fintheon"
              className="h-10 w-10 object-contain opacity-90 drop-shadow-[0_0_10px_rgba(199,159,74,0.3)]"
            />
            <h1
              className="text-3xl font-light tracking-[0.5em] text-[#c79f4a] drop-shadow-[0_0_12px_rgba(199,159,74,0.4)]"
              style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
            >
              FINTHEON
            </h1>
          </div>
          {/* Subtitle — aligned with title (offset by logo + gap = 56px ≈ pl-14) */}
          <p
            className="mt-3 pl-14 text-xs tracking-[0.3em] text-[#f0ead6]/60"
            style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
          >
            Integrated Trading Environment
          </p>

          <div className="mt-6 pl-14">
            <TimeQuote />
          </div>
        </div>
      </div>

      {/* Right — Login card (45%), top-aligned with branding box */}
      <div className="flex w-full flex-col items-center py-12 md:w-[45%] md:py-0 md:pr-[8%]">
        <div className="w-full max-w-sm rounded-2xl border border-[#c79f4a]/15 bg-[#0a0906]/90 px-8 py-10 shadow-[0_25px_55px_rgba(0,0,0,0.65)] backdrop-blur-lg">
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
          <a href="#" className="transition-all duration-300 hover:text-yellow-400">
            Terms of Use
          </a>
          <span className="text-yellow-800">&bull;</span>
          <a href="#" className="transition-all duration-300 hover:text-yellow-400">
            Privacy Policy
          </a>
        </footer>
      </div>
    </main>
  </div>
);

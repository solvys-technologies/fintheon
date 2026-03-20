// [claude-code 2026-03-20] Auth shell: split layout, branding left, Google sign-in right
import React from 'react';

type AuthShellProps = {
  children: React.ReactNode;
};

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050402] text-[#f0ead6] selection:bg-[#c79f4a]/30">
      {/* Dithered hero background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 25% 50%, rgba(199,159,74,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(199,159,74,0.3) 0px, rgba(199,159,74,0.3) 1px, transparent 1px, transparent 3px)',
          }}
        />
      </div>

      {/* Main content: split layout, vertically centered */}
      <main className="relative z-10 flex min-h-screen items-center justify-between px-8 md:px-16 lg:px-24">
        {/* Left side: Branding */}
        <div className="flex flex-col">
          <h1 className="text-5xl font-light uppercase tracking-[0.35em] text-[#c79f4a] md:text-6xl lg:text-7xl">
            Fintheon
          </h1>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-[#c79f4a]/40">
            Where Markets Are Conquered
          </p>
          <div className="mt-8 h-px w-32 bg-[#c79f4a]/20" />
          <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[#f0ead6]/15">
            Priced In Capital
          </p>
        </div>

        {/* Right side: Sign-in panel */}
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#c79f4a]/50">
              Access Terminal
            </p>
          </div>

          {/* Sign-in container — full-size card */}
          <div className="relative w-[400px] overflow-hidden rounded-2xl border border-[#c79f4a]/15 bg-[#050402]/90 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-4 right-4 h-px bg-[#c79f4a]/25" />
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl bg-[#0a0a00]/60 px-8 py-10 backdrop-blur-sm">
              {children}
            </div>
          </div>

          <div className="mt-6 flex gap-4 text-[10px] uppercase tracking-[0.2em] text-[#f0ead6]/20">
            <a href="#" className="transition-colors hover:text-[#c79f4a]/60">Terms</a>
            <span className="text-[#c79f4a]/10">|</span>
            <a href="#" className="transition-colors hover:text-[#c79f4a]/60">Privacy</a>
          </div>
        </div>
      </main>
    </div>
  );
};

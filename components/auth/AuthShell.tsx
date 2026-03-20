import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FluidCursor, FluidCursorHandle } from './FluidCursor';

type AuthShellProps = {
  children: React.ReactNode;
};

type AuthPhase = 'landing' | 'transitioning' | 'auth';

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => {
  const [phase, setPhase] = useState<AuthPhase>('landing');
  const [showClerk, setShowClerk] = useState(false);
  const cursorRef = useRef<FluidCursorHandle>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const transitionTimers = useRef<number[]>([]);

  const showCursor = phase !== 'auth';

  const clearTimers = () => {
    transitionTimers.current.forEach((id) => window.clearTimeout(id));
    transitionTimers.current = [];
  };

  const handleLoginClick = () => {
    if (phase !== 'landing') return;

    clearTimers();
    setPhase('transitioning');

    // Snap the cursor into the logo to mimic the in-universe transition.
    requestAnimationFrame(() => {
      const rect = logoRef.current?.getBoundingClientRect();
      if (rect) {
        cursorRef.current?.snapTo(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });

    // Reveal the Clerk widget slightly after the cursor locks in.
    const clerkTimer = window.setTimeout(() => setShowClerk(true), 600);
    const authTimer = window.setTimeout(() => setPhase('auth'), 1150);
    transitionTimers.current.push(clerkTimer, authTimer);
  };

  useEffect(() => {
    if (phase !== 'transitioning') {
      setShowClerk(phase === 'auth');
    }
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  const backgroundStyle = useMemo(
    () => ({
      backgroundImage: 'url(/background.png)',
    }),
    []
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white selection:bg-yellow-500/30">
      {showCursor && (
        <div className="hidden md:block">
          <FluidCursor ref={cursorRef} />
        </div>
      )}

      {/* Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[3px] scale-105 transition-transform duration-700" style={backgroundStyle} />
        <div className="absolute inset-0 bg-black/40 transition-opacity duration-700" />
        <div
          className={`absolute inset-0 transition-all duration-700 ${
            phase === 'landing' ? 'bg-gradient-to-t from-black via-black/50 to-transparent' : 'bg-gradient-to-r from-black/80 via-black/30 to-transparent'
          }`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-black/30 to-black/90" />
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-end px-6 pb-12 md:justify-center">
        <div
          className={`flex w-full max-w-5xl flex-col items-center gap-10 transition-all duration-700 ${
            phase === 'auth' ? 'md:items-start md:gap-12' : ''
          }`}
        >
          {/* Logo + Pulse glow */}
          <div
            ref={logoRef}
            className={`relative mb-2 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              phase === 'landing'
                ? 'logo-landing translate-y-0'
                : 'logo-auth -translate-y-32 md:-translate-y-40 md:self-start md:pl-2'
            }`}
          >
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-500/30 animate-pulse-radiate"
              style={{ boxShadow: '0 0 60px rgba(234,179,8,0.35)' }}
            />
            <div className="relative z-10 opacity-95 drop-shadow-[0_0_18px_rgba(234,179,8,0.55)]">
              <img src="/logo.png" alt="Pulse logo" className="h-32 w-32 object-contain" />
            </div>
          </div>

          {/* Login button (landing only) */}
          <div
            className={`group relative flex items-center justify-center overflow-hidden rounded-full p-[2px] transition-all duration-500 ${
              phase === 'landing' ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div className="absolute inset-[-100%] animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0_85%,#B45309_92%,#EAB308_100%)] opacity-100" />
            <button
              onClick={handleLoginClick}
              className="relative z-10 rounded-full bg-black px-14 py-5 text-lg font-bold tracking-[0.25em] text-yellow-500 transition-colors duration-700 ease-out hover:bg-yellow-500 hover:text-black hover:shadow-[0_0_30px_rgba(234,179,8,0.6)]"
            >
              LOGIN
            </button>
          </div>

          {/* Footer Links */}
          <footer
            className={`flex gap-6 text-[11px] font-medium uppercase tracking-[0.25em] text-yellow-600/90 transition-opacity duration-500 ${
              phase === 'landing' ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <a href="#" className="transition-all duration-500 hover:text-yellow-400 hover:drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">
              Terms of Use
            </a>
            <span className="text-yellow-800">•</span>
            <a href="#" className="transition-all duration-500 hover:text-yellow-400 hover:drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">
              Privacy Policy
            </a>
          </footer>

          {/* Auth window */}
          <div
            className={`relative w-full max-w-xl overflow-hidden rounded-[32px] p-[1px] transition-all duration-700 ${
              phase === 'landing' ? 'pointer-events-none opacity-0 translate-y-6' : 'opacity-100 translate-y-0'
            } ${phase === 'auth' ? 'md:self-start' : ''}`}
          >
            <div className="absolute inset-[-200%] animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0_85%,#B45309_92%,#EAB308_100%)] opacity-80" />
            <div className="relative z-10 flex flex-col gap-6 rounded-[32px] bg-black/80 px-8 py-10 shadow-[0_25px_55px_rgba(0,0,0,0.65)] backdrop-blur-lg">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.5em] text-yellow-500/70">Pulse Terminal</p>
                <h1 className="text-2xl font-semibold tracking-[0.2em] text-yellow-50">Access Control</h1>
              </div>
              <div className={`transition-all duration-500 ${showClerk ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                {showClerk ? children : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-radiate {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        .animate-spin-slow { animation: spin-slow 4s linear infinite; }
        .animate-pulse-radiate { animation: pulse-radiate 2s infinite ease-out; }
      `}</style>
    </div>
  );
};

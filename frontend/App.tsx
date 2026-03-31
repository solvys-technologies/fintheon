// [claude-code 2026-03-24] Auth gate with init screen, cloud migration, and soft fade-in
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { migrateLocalStorageToCloud, isMigrationComplete } from './lib/data-migration';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { ToastProvider } from './contexts/ToastContext';
import { GatewayProvider } from './contexts/GatewayContext';
import { FintheonAgentProvider } from './contexts/FintheonAgentContext';
import { RiskFlowProvider } from './contexts/RiskFlowContext';
import { ContextBankProvider } from './contexts/ContextBankContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { VoiceProvider, useVoice } from './contexts/VoiceContext';
import { ERProvider } from './contexts/ERContext';
import { MainLayout } from './components/layout/MainLayout';
import { NotificationContainer } from './components/NotificationToast';
import { ToastContainer } from './components/ui/Toast';
import { PreMarketReminder } from './components/PreMarketReminder';
import { GitHubOAuthCallback } from './components/GitHubOAuthCallback';
import { UpdateBanner } from './components/UpdateBanner';
import { ApiErrorToastBridge } from './components/ApiErrorToastBridge';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemStatusProvider } from './contexts/SystemStatusContext';
import { migrateStorageKeys } from './lib/storage-migration';
import { AuthShell } from './components/auth/AuthShell';

// Run storage migration before any providers read localStorage
migrateStorageKeys();

// [claude-code 2026-03-13] VoiceBorderPulse — green pulse when listening, gold when speaking
function VoiceBorderPulse() {
  const { runtimeState, enabled } = useVoice();
  if (!enabled || runtimeState === 'idle') return null;

  const isListening = runtimeState === 'listening';
  const isSpeaking = runtimeState === 'speaking';
  if (!isListening && !isSpeaking) return null;

  const color = isListening ? 'rgba(34,197,94,' : 'rgba(199,159,74,';

  return (
    <>
      <style>{`
        @keyframes voiceBorderPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none z-[90]"
        style={{
          border: `2px solid ${color}0.5)`,
          animation: 'voiceBorderPulse 2s ease-in-out infinite',
          boxShadow: `inset 0 0 20px ${color}0.15)`,
        }}
      />
    </>
  );
}

// [claude-code 2026-03-24] Init status messages for post-login loading screen
const INIT_STEPS = [
  'Restoring session',
  'Connecting to backend',
  'Syncing preferences',
  'Loading workspace',
] as const;

/**
 * Post-login init screen — checks backend, runs migration, then fades into the app.
 * User can skip at any time (no warning popup).
 */
function InitScreen({ onReady, onSkip }: { onReady: () => void; onSkip: () => void }) {
  const { getAccessToken } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    (async () => {
      // Step 0: Restoring session (already done by AuthContext, brief pause)
      await new Promise(r => setTimeout(r, 400));
      if (cancelled) return;

      // Step 1: Backend health check
      setStepIdx(1);
      for (let i = 0; i < 8; i++) {
        try {
          const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) break;
        } catch { /* retry */ }
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 800));
      }
      if (cancelled) return;

      // Step 2: Cloud migration (if needed)
      setStepIdx(2);
      if (!isMigrationComplete()) {
        try {
          const token = await getAccessToken();
          if (token && !cancelled) {
            const result = await migrateLocalStorageToCloud(token);
            if (result.migrated) console.log(`[Init] Synced ${result.keysCount} keys`);
          }
        } catch (err) {
          console.warn('[Init] Migration skipped:', err);
        }
      }
      if (cancelled) return;

      // Step 3: Loading workspace
      setStepIdx(3);
      await new Promise(r => setTimeout(r, 300));
      if (cancelled) return;

      // Done — trigger fade-out then ready
      setFadeOut(true);
      setTimeout(() => { if (!cancelled) onReady(); }, 600);
    })();

    return () => { cancelled = true; };
  }, [getAccessToken, onReady]);

  const fuseProgress = (stepIdx + 1) / INIT_STEPS.length;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#050402] transition-opacity duration-500"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <div className="flex flex-col items-center gap-6">
        <img
          src="./logo.png"
          alt="Fintheon"
          className="h-20 w-20 object-contain opacity-80 drop-shadow-[0_0_18px_rgba(199,159,74,0.4)]"
        />
        {/* Status line */}
        <p
          className="text-sm tracking-[0.3em] text-[#f0ead6]/40 italic transition-all duration-300"
          style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
        >
          Assembling the Kingdom....
        </p>

        {/* Fuse bar — fills left to right as steps complete */}
        <div className="relative w-48 h-[2px] rounded-full bg-[#c79f4a]/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#c79f4a]/50 transition-all duration-700 ease-out"
            style={{ width: `${fuseProgress * 100}%` }}
          />
          {/* Bright tip */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#c79f4a] transition-all duration-700 ease-out"
            style={{
              left: `calc(${fuseProgress * 100}% - 3px)`,
              boxShadow: '0 0 6px rgba(199, 159, 74, 0.7)',
            }}
          />
        </div>

        {/* Skip link — quiet, no popup */}
        <button
          onClick={onSkip}
          className="mt-4 text-[10px] tracking-[0.3em] text-[#f0ead6]/20 transition-colors duration-300 hover:text-[#f0ead6]/50"
        >
          SKIP
        </button>
      </div>
    </div>
  );
}

/** Auth-gated app shell — AuthShell → InitScreen → MainLayout (with fade-in) */
function AuthGate() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [initComplete, setInitComplete] = useState(false);
  const [appVisible, setAppVisible] = useState(false);

  const handleInitReady = useCallback(() => {
    setInitComplete(true);
    // Stagger the fade-in slightly so the DOM renders first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAppVisible(true));
    });
  }, []);

  const handleSkip = useCallback(() => {
    setInitComplete(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAppVisible(true));
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050402]">
        <div className="flex flex-col items-center gap-4">
          <img src="./logo.png" alt="Fintheon" className="h-16 w-16 animate-pulse opacity-60" />
          <p className="text-xs tracking-[0.3em] text-[#c79f4a]/50">LOADING</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthShell onSignIn={signIn} isLoading={isLoading} />;
  }

  if (!initComplete) {
    return <InitScreen onReady={handleInitReady} onSkip={handleSkip} />;
  }

  return (
    <div
      className="transition-opacity duration-700 ease-out"
      style={{ opacity: appVisible ? 1 : 0 }}
    >
    <SettingsProvider>
      <ToastProvider>
        <GatewayProvider>
        <SystemStatusProvider>
          <FintheonAgentProvider>
            <RiskFlowProvider>
            <ContextBankProvider>
            <ThreadProvider>
            <VoiceProvider>
            <ERProvider>
              <div className="dark">
                <VoiceBorderPulse />
                <style>{`
                  * {
                    scrollbar-width: thin;
                    scrollbar-color: var(--fintheon-accent) var(--fintheon-surface);
                  }

                  *::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                  }

                  *::-webkit-scrollbar-track {
                    background: var(--fintheon-surface);
                  }

                  *::-webkit-scrollbar-thumb {
                    background: var(--fintheon-accent);
                    border-radius: 4px;
                  }

                  *::-webkit-scrollbar-thumb:hover {
                    background: color-mix(in srgb, var(--fintheon-accent) 70%, white);
                  }

                  .scanline-overlay {
                    background: repeating-linear-gradient(
                      0deg,
                      color-mix(in srgb, var(--fintheon-accent) 3%, transparent) 0px,
                      color-mix(in srgb, var(--fintheon-accent) 3%, transparent) 1px,
                      transparent 1px,
                      transparent 2px
                    );
                    pointer-events: none;
                  }
                `}</style>
                <ApiErrorToastBridge />
                <UpdateBanner />
                <GitHubOAuthCallback />
                <MainLayout />
                <NotificationContainer />
                <ToastContainer />
                <PreMarketReminder />
              </div>
            </ERProvider>
            </VoiceProvider>
            </ThreadProvider>
            </ContextBankProvider>
            </RiskFlowProvider>
          </FintheonAgentProvider>
        </SystemStatusProvider>
        </GatewayProvider>
      </ToastProvider>
    </SettingsProvider>
    </div>
  );
}

/**
 * Fintheon — AuthProvider wraps the entire app so session state is available
 * to both the auth gate and the main application.
 */
export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

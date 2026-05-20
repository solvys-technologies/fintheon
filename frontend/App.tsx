// [claude-code 2026-04-23] S32-T4 Consul Control pixelation corners mounted above modals.
// [claude-code 2026-04-23] Rollback: remove GitHub OAuth callback + update banner mounts
// [claude-code 2026-03-24] Auth gate with init screen, cloud migration, and soft fade-in
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  migrateLocalStorageToCloud,
  isMigrationComplete,
} from "./lib/data-migration";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThreadProvider } from "./contexts/ThreadContext";
import { ToastProvider } from "./contexts/ToastContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { GatewayProvider } from "./contexts/GatewayContext";
import { FintheonAgentProvider } from "./contexts/FintheonAgentContext";
import { TeamPresenceProvider } from "./contexts/TeamPresenceContext";
import { RiskFlowProvider } from "./contexts/RiskFlowContext";
import { ContextBankProvider } from "./contexts/ContextBankContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { VoiceProvider } from "./contexts/VoiceContext";
import { VoiceRimFrame } from "./components/voice/VoiceRimFrame";
import { ERProvider } from "./contexts/ERContext";
import { MainLayout } from "./components/layout/MainLayout";
import SplashScreen from "./components/SplashScreen";
import { NotificationContainer } from "./components/NotificationToast";
import { ToastContainer } from "./components/ui/Toast";
import { PreMarketReminder } from "./components/PreMarketReminder";
import { ApiErrorToastBridge } from "./components/ApiErrorToastBridge";
import { AiCreditToastBridge } from "./components/AiCreditToastBridge";
import { VersionChecker } from "./components/VersionChecker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SystemStatusProvider } from "./contexts/SystemStatusContext";
import { migrateStorageKeys } from "./lib/storage-migration";
import { AuthShell } from "./components/auth/AuthShell";
import { CircleQuarters } from "./components/icon-bank/UnicodeSpinners";
import { ConsulControlCorners } from "./components/consul-control/ConsulControlCorners";
import { useConsulControlStatus } from "./hooks/useConsulControlStatus";

// Run storage migration before any providers read localStorage
migrateStorageKeys();

// [claude-code 2026-04-19] S27-T5 W2c — replaced VoiceBorderPulse with VoiceRimFrame
// (accent-gold rim + transcript ticker + dismiss button; never covers content).

/**
 * Headless init hook — runs backend health check + cloud migration, then signals ready.
 * No UI — the SplashScreen overlay handles visuals.
 * Only runs when `enabled` is true (i.e. authenticated).
 */
function useAppInit(enabled: boolean, onReady: () => void) {
  const { getAccessToken } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!enabled || hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;
    const API = import.meta.env.VITE_API_URL || "http://localhost:8080";

    (async () => {
      // Brief pause — session already restored by AuthContext
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      // Backend health check
      for (let i = 0; i < 8; i++) {
        try {
          const res = await fetch(`${API}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) break;
        } catch {
          /* retry */
        }
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 800));
      }
      if (cancelled) return;

      // Cloud migration (if needed)
      if (!isMigrationComplete()) {
        try {
          const token = await getAccessToken();
          if (token && !cancelled) {
            await migrateLocalStorageToCloud(token);
          }
        } catch (err) {
          console.warn("[Init] Migration skipped:", err);
        }
      }
      if (cancelled) return;

      // Brief settle
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      onReady();
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, getAccessToken, onReady]);
}

/** Cold-start detection — sessionStorage clears on quit but persists during background */
function isColdStart(): boolean {
  try {
    if (sessionStorage.getItem("fintheon:session-alive")) return false;
    sessionStorage.setItem("fintheon:session-alive", "1");
    return true;
  } catch {
    return true;
  }
}

/** Pixel-flicker corner indicator — active while Harper is holding the wheel. */
function ConsulControlLayer() {
  const active = useConsulControlStatus();
  return <ConsulControlCorners active={active} />;
}

/** Auth-gated app shell — AuthShell → SplashScreen overlay → MainLayout */
function AuthGate() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [initComplete, setInitComplete] = useState(false);
  const [showSplash] = useState(() => isColdStart());

  const handleInitReady = useCallback(() => {
    setInitComplete(true);
  }, []);

  // Run headless init once authenticated
  useAppInit(isAuthenticated, handleInitReady);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050402]">
        <div className="flex flex-col items-center gap-4">
          <img
            src="./logo.png"
            alt="Fintheon"
            className="h-16 w-16 opacity-60"
          />
          <div className="flex items-center gap-2">
            <CircleQuarters size={11} color="#c79f4a" />
            <p className="text-[11px] tracking-[0.3em] text-[#c79f4a]/60">
              LOADING
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthShell onSignIn={signIn} isLoading={isLoading} />;
  }

  return (
    <div style={{ opacity: 1 }}>
      {/* Liquid glass splash — cold start only, fades when init completes */}
      {showSplash && <SplashScreen isReady={initComplete} />}
      <SettingsProvider>
        <NotificationsProvider>
          <ToastProvider>
            <GatewayProvider>
              <SystemStatusProvider>
                <FintheonAgentProvider>
                  <TeamPresenceProvider>
                    <RiskFlowProvider>
                      <ContextBankProvider>
                        <ThreadProvider>
                          <VoiceProvider>
                            <ERProvider>
                              <div className="dark">
                                <VoiceRimFrame />
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
                                <AiCreditToastBridge />
                                <VersionChecker />
                                <MainLayout />
                                <ConsulControlLayer />
                                <NotificationContainer />
                                <ToastContainer />
                                <PreMarketReminder />
                              </div>
                            </ERProvider>
                          </VoiceProvider>
                        </ThreadProvider>
                      </ContextBankProvider>
                    </RiskFlowProvider>
                  </TeamPresenceProvider>
                </FintheonAgentProvider>
              </SystemStatusProvider>
            </GatewayProvider>
          </ToastProvider>
        </NotificationsProvider>
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

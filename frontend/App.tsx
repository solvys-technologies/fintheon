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
import { GatewayProvider } from "./contexts/GatewayContext";
import { FintheonAgentProvider } from "./contexts/FintheonAgentContext";
import { TeamPresenceProvider } from "./contexts/TeamPresenceContext";
import { RiskFlowProvider } from "./contexts/RiskFlowContext";
import { ContextBankProvider } from "./contexts/ContextBankContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { VoiceProvider, useVoice } from "./contexts/VoiceContext";
import { ERProvider } from "./contexts/ERContext";
import { MainLayout } from "./components/layout/MainLayout";
import SplashScreen from "./components/SplashScreen";
import { NotificationContainer } from "./components/NotificationToast";
import { ToastContainer } from "./components/ui/Toast";
import { PreMarketReminder } from "./components/PreMarketReminder";
import { GitHubOAuthCallback } from "./components/GitHubOAuthCallback";
import { UpdateBanner } from "./components/UpdateBanner";
import { ApiErrorToastBridge } from "./components/ApiErrorToastBridge";
import { VersionChecker } from "./components/VersionChecker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SystemStatusProvider } from "./contexts/SystemStatusContext";
import { migrateStorageKeys } from "./lib/storage-migration";
import { AuthShell } from "./components/auth/AuthShell";

// Run storage migration before any providers read localStorage
migrateStorageKeys();

// [claude-code 2026-03-13] VoiceBorderPulse — green pulse when listening, gold when speaking
function VoiceBorderPulse() {
  const { runtimeState, enabled } = useVoice();
  if (!enabled || runtimeState === "idle") return null;

  const isListening = runtimeState === "listening";
  const isSpeaking = runtimeState === "speaking";
  if (!isListening && !isSpeaking) return null;

  const color = isListening ? "rgba(34,197,94," : "rgba(199,159,74,";

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
          animation: "voiceBorderPulse 2s ease-in-out infinite",
          boxShadow: `inset 0 0 20px ${color}0.15)`,
        }}
      />
    </>
  );
}

/**
 * Headless init hook — runs backend health check + cloud migration, then signals ready.
 * No UI — the SplashScreen overlay handles visuals.
 */
function useAppInit(onReady: () => void) {
  const { getAccessToken } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
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
  }, [getAccessToken, onReady]);
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
          <img
            src="./logo.png"
            alt="Fintheon"
            className="h-16 w-16 animate-pulse opacity-60"
          />
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
                <TeamPresenceProvider>
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
                              <VersionChecker />
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
                </TeamPresenceProvider>
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

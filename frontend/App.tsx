// [claude-code 2026-03-16] Added Clerk authentication with Google OAuth, AuthShell login screen
import React from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut, useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import { BackendProvider } from './lib/backend';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { ToastProvider } from './contexts/ToastContext';
import { GatewayProvider } from './contexts/GatewayContext';
import { PulseAgentProvider } from './contexts/PulseAgentContext';
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
import { AuthShell } from './components/auth/AuthShell';
import { pulseAppearance } from './components/auth/pulseAppearance';
import { migrateStorageKeys } from './lib/storage-migration';

// Run storage migration before any providers read localStorage
migrateStorageKeys();

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

const DEFAULT_CLERK_DOMAIN = 'clerk.app.pricedinresearch.io';
const DEFAULT_CLERK_PROXY_URL = 'https://clerk.app.pricedinresearch.io';

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

function AuthenticatedAppContent() {
  const { getToken, userId } = useClerkAuth();
  const { user } = useUser();
  return (
    <AppContent
      getToken={getToken}
      clerkUserId={userId ?? undefined}
      clerkEmail={user?.primaryEmailAddress?.emailAddress}
    />
  );
}

function AppContent({
  getToken,
  clerkUserId,
  clerkEmail,
}: {
  getToken?: () => Promise<string | null>;
  clerkUserId?: string;
  clerkEmail?: string;
}) {
  return (
    <ThemeProvider>
    <BackendProvider getToken={getToken}>
    <AuthProvider clerkUserId={clerkUserId} clerkEmail={clerkEmail}>
      <SettingsProvider>
        <ToastProvider>
          <GatewayProvider>
            <PulseAgentProvider>
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
            </PulseAgentProvider>
          </GatewayProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
    </BackendProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  // In dev mode with auth bypass, show app directly
  if (BYPASS_AUTH) {
    return <AppContent />;
  }

  return (
    <>
      <SignedOut>
        <AuthShell>
          <SignIn
            appearance={pulseAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        </AuthShell>
      </SignedOut>
      <SignedIn>
        <AuthenticatedAppContent />
      </SignedIn>
    </>
  );
}

export default function App() {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const clerkDomain = import.meta.env.VITE_CLERK_DOMAIN || DEFAULT_CLERK_DOMAIN;
  const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || DEFAULT_CLERK_PROXY_URL;

  // In dev mode with auth bypass, skip ClerkProvider entirely
  if (BYPASS_AUTH) {
    return <AppContent />;
  }

  if (!clerkKey) {
    console.warn('[Auth] Missing VITE_CLERK_PUBLISHABLE_KEY — falling back to bypass mode');
    return <AppContent />;
  }

  return (
    <ClerkProvider publishableKey={clerkKey} domain={clerkDomain} proxyUrl={clerkProxyUrl}>
      <AppInner />
    </ClerkProvider>
  );
}

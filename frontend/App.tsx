import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
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
import { migrateStorageKeys } from './lib/storage-migration';

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

/**
 * Fintheon - Local Single-User Trading Platform
 * No authentication required - company internal use only
 */
export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <GatewayProvider>
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
          </GatewayProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

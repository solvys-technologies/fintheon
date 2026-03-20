// [claude-code 2026-03-20] Shell rebuild: removed VIXProvider, PsychProvider, ThreadProvider, PsychOrientationModal
import { useState } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { NotificationContainer } from './components/NotificationToast';
import { AuthShell } from './components/auth/AuthShell';
import { fintheonAppearance } from './components/auth/fintheonAppearance';

const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost');
const BYPASS_AUTH = IS_ELECTRON || (DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true');

if (DEV_MODE) {
  console.log('[DEV MODE] Bypass Auth:', BYPASS_AUTH);
}

function AppInner() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <AuthProvider>
      <SettingsProvider>
        <div className="dark">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');
            * { scrollbar-width: thin; scrollbar-color: #D4AF37 #0a0a00; }
            *::-webkit-scrollbar { width: 8px; height: 8px; }
            *::-webkit-scrollbar-track { background: #0a0a00; }
            *::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: #FFD060; }
          `}</style>
          <MainLayout onSettingsClick={() => setShowSettings(true)} />
          {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
          <NotificationContainer />
        </div>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default function App() {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

  if (BYPASS_AUTH || !clerkKey) {
    return <AppInner />;
  }

  return (
    <ClerkProvider publishableKey={clerkKey} appearance={fintheonAppearance}>
      <SignedIn>
        <AppInner />
      </SignedIn>
      <SignedOut>
        <AuthShell>
          <SignIn appearance={fintheonAppearance} />
        </AuthShell>
      </SignedOut>
    </ClerkProvider>
  );
}

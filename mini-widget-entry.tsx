import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { FloatingWidget } from './components/layout/FloatingWidget';
import { useBackend } from './lib/backend';
import './index.css';

const DEFAULT_CLERK_DOMAIN = 'clerk.app.pricedinresearch.io';
const DEFAULT_CLERK_PROXY_URL = 'https://clerk.app.pricedinresearch.io';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CLERK_DOMAIN = import.meta.env.VITE_CLERK_DOMAIN || DEFAULT_CLERK_DOMAIN;
const CLERK_PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL || DEFAULT_CLERK_PROXY_URL;

/**
 * Mini Widget App - Standalone floating widget for persistent display
 * This is a lightweight version that runs in a separate Electron window
 */
function MiniWidgetApp() {
  const backend = useBackend();
  const [vix, setVix] = useState(20);
  const [ivScore, setIvScore] = useState(3.2);

  // Fetch VIX value
  useEffect(() => {
    const fetchVIX = async () => {
      try {
        const newsClient = (backend as any).news;
        const baseClient = (newsClient as any).baseClient;
        const response = await baseClient.callTypedAPI('/news/fetch-vix', { method: 'GET', body: undefined });
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.value === 'number') {
            setVix(data.value);
          }
        }
      } catch (error) {
        console.error('[MiniWidget] Failed to fetch VIX:', error);
      }
    };

    fetchVIX();
    const interval = setInterval(fetchVIX, 300000);
    return () => clearInterval(interval);
  }, [backend]);

  // Simulate IV score updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIvScore(prev => Math.max(0, Math.min(10, prev + (Math.random() - 0.5) * 0.5)));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    // Hide the widget window via Electron
    window.electron?.toggleMiniWidget();
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Draggable area for moving the window */}
      <div 
        className="fixed top-0 left-0 right-0 h-4 cursor-move"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      
      {/* Widget content - positioned to account for drag area */}
      <div className="pt-2">
        <FloatingWidget
          vix={vix}
          ivScore={ivScore}
          layoutOption="tickers-only"
          onClose={handleClose}
        />
      </div>
    </div>
  );
}

function MiniWidgetRoot() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-[#050500] flex items-center justify-center text-red-500">
        Missing Clerk publishable key
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      domain={CLERK_DOMAIN}
      proxyUrl={CLERK_PROXY_URL}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#D4AF37',
        },
      }}
    >
      <AuthProvider>
        <SettingsProvider>
          <MiniWidgetApp />
        </SettingsProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MiniWidgetRoot />);
}

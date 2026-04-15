// [claude-code 2026-04-15] T4: Provider tree + tab router + HomePage integration
import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { StatusProvider } from "./contexts/ToastContext";
import { MobileShell } from "./components/layout/MobileShell";
import { TAB_CONFIG } from "./components/layout/BottomTabBar";
import { HomePage } from "./components/home/HomePage";
import { useVixTicker } from "./hooks/useVixTicker";

const PAGE_LABELS = ["[HOME]", "[RISKFLOW]", "[CHAT]", "[SETTINGS]"];

function LoginScreen() {
  const { signIn, isLoading } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
      }}
    >
      <span
        style={{
          fontFamily: "'Doto', monospace",
          fontSize: "48px",
          color: "#fff",
          letterSpacing: "0.15em",
        }}
      >
        FINTHEON
      </span>
      <button
        onClick={() => signIn()}
        disabled={isLoading}
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "13px",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color: "#fff",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "999px",
          padding: "12px 32px",
          cursor: isLoading ? "wait" : "pointer",
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        {isLoading ? "[LOADING...]" : "[SIGN IN WITH GOOGLE]"}
      </button>
    </div>
  );
}

function TabPage({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 14,
          letterSpacing: "0.1em",
          color: "var(--text-disabled)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AuthenticatedApp() {
  // Start VIX polling globally
  useVixTicker();

  const [activeTab, setActiveTab] = useState(0);
  const prevTab = useRef(0);

  const handleTabChange = (index: number) => {
    prevTab.current = activeTab;
    setActiveTab(index);
  };

  // Slide direction: right when going to higher index, left when lower
  const direction = activeTab > prevTab.current ? 1 : -1;

  const renderPage = () => {
    if (activeTab === 0) return <HomePage />;
    return <TabPage label={PAGE_LABELS[activeTab]} />;
  };

  return (
    <MobileShell activeTab={activeTab} onTabChange={handleTabChange}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={activeTab}
          custom={direction}
          initial={{ x: `${direction * 100}%`, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: `${-direction * 100}%`, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: "100%" }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </MobileShell>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "12px",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
          }}
        >
          [RESTORING SESSION...]
        </span>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <StatusProvider>
            <AuthGate />
          </StatusProvider>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

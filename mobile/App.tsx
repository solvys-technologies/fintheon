// [claude-code 2026-04-15] S18: Provider tree + header-menu nav + floating chat overlay
import { useState, useRef, Suspense, lazy } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { StatusProvider } from "./contexts/ToastContext";
import { MobileRiskFlowProvider } from "./contexts/RiskFlowContext";
import { MobileShell } from "./components/layout/MobileShell";
import { HomePage } from "./components/home/HomePage";
import { SegmentedSpinner } from "./components/shared/SegmentedSpinner";
import { useVixTicker } from "./hooks/useVixTicker";
import { X } from "lucide-react";

const RiskFlowPage = lazy(() =>
  import("./components/riskflow/RiskFlowPage").then((m) => ({
    default: m.RiskFlowPage,
  })),
);
const ChatPage = lazy(() => import("./components/chat/ChatPage"));
const SettingsPage = lazy(() =>
  import("./components/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);

function LazyFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        minHeight: "40vh",
      }}
    >
      <SegmentedSpinner />
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING...]
      </span>
    </div>
  );
}

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

function AuthenticatedApp() {
  useVixTicker();

  const [activeTab, setActiveTab] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const prevTab = useRef(0);

  const handleTabChange = (index: number) => {
    prevTab.current = activeTab;
    navigator.vibrate?.(10);
    setActiveTab(index);
  };

  const direction = activeTab > prevTab.current ? 1 : -1;

  const renderPage = () => {
    switch (activeTab) {
      case 0:
        return <HomePage />;
      case 1:
        return (
          <Suspense fallback={<LazyFallback />}>
            <RiskFlowPage />
          </Suspense>
        );
      case 3:
        return (
          <Suspense fallback={<LazyFallback />}>
            <SettingsPage />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <MobileRiskFlowProvider>
      <MobileShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen(true)}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ x: `${direction * 100}%`, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: `${-direction * 100}%`, opacity: 0 }}
            transition={{
              x: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 0.2, ease: "easeOut" },
            }}
            style={{ width: "100%" }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </MobileShell>

      {/* Chat overlay — slides up from bottom, stays mounted */}
      <Suspense fallback={<LazyFallback />}>
        <ChatPage visible={chatOpen} />
      </Suspense>
      <AnimatePresence>
        {chatOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={() => setChatOpen(false)}
            aria-label="Close chat"
            style={{
              position: "fixed",
              top: "calc(env(safe-area-inset-top) + 12px)",
              right: 16,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-visible)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1000,
            }}
          >
            <X size={20} color="var(--text-primary)" />
          </motion.button>
        )}
      </AnimatePresence>
    </MobileRiskFlowProvider>
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

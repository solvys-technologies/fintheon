// [claude-code 2026-04-19] FAB chat button forwards to chat tab (no floating overlay) per TP
// [claude-code 2026-04-16] S20: Provider tree + activity status + haptic-gated nav
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  lazy,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { StatusProvider } from "./contexts/ToastContext";
import { ActivityStatusProvider } from "./contexts/ActivityStatusContext";
import { MobileRiskFlowProvider } from "./contexts/RiskFlowContext";
import { MobileShell } from "./components/layout/MobileShell";
import { HomePage } from "./components/home/HomePage";
import { SegmentedSpinner } from "./components/shared/SegmentedSpinner";
import { useVixTicker } from "./hooks/useVixTicker";
import { useHaptic } from "./hooks/useHaptic";

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
const EconCalendarPage = lazy(() =>
  import("./components/econ/EconCalendarPage").then((m) => ({
    default: m.EconCalendarPage,
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
  const vibrate = useHaptic();

  const [activeTab, setActiveTab] = useState(0);
  const prevTab = useRef(0);

  const handleTabChange = useCallback(
    (index: number) => {
      prevTab.current = activeTab;
      vibrate(10);
      setActiveTab(index);
    },
    [activeTab, vibrate],
  );

  // Service worker notification tap routing
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "notification-tap") return;
      const { category, conversationId } = event.data;

      // Route to correct tab based on notification category
      if (category === "riskflow") {
        handleTabChange(1);
      } else if (
        category === "chat" ||
        category === "toolApprovals" ||
        category === "chat_relay"
      ) {
        handleTabChange(2);
        // S21-T1 relay dispatch: stash pending convo so ChatPage can pick it up on mount
        if (category === "chat_relay" && conversationId) {
          try {
            sessionStorage.setItem(
              "fintheon:pending-relay-conv",
              conversationId,
            );
            // Also dispatch a window event in case the tab is already open
            window.dispatchEvent(
              new CustomEvent("fintheon:relay-dispatch", {
                detail: { conversationId },
              }),
            );
          } catch {
            /* ignore */
          }
        }
      } else if (category === "dailyBrief") {
        handleTabChange(0);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [handleTabChange]);

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
      case 2:
        return (
          <Suspense fallback={<LazyFallback />}>
            <ChatPage visible={true} />
          </Suspense>
        );
      case 3:
        return (
          <Suspense fallback={<LazyFallback />}>
            <EconCalendarPage />
          </Suspense>
        );
      case 4:
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
        onChatTap={() => handleTabChange(2)}
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
            style={{
              width: "100%",
              height: "100%",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </MobileShell>
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
          <ActivityStatusProvider>
            <StatusProvider>
              <AuthGate />
            </StatusProvider>
          </ActivityStatusProvider>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

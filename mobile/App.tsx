// [claude-code 2026-04-19] S25: NotificationModalProvider wraps AuthenticatedApp so push-tap
//   and card-press both open the full-viewport catalyst/approval DetailSheet. SW handler
//   promoted into useNotificationTapRouter which routes tab + modal in one pass.
// [claude-code 2026-04-19] FAB chat button forwards to chat tab (no floating overlay) per TP
// [claude-code 2026-04-16] S20: Provider tree + activity status + haptic-gated nav
import {
  useState,
  useRef,
  useCallback,
  useEffect,
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
import { NotificationModalProvider } from "./contexts/NotificationModalContext";
import { MobileShell } from "./components/layout/MobileShell";
import { HomePage } from "./components/home/HomePage";
import { SegmentedSpinner } from "./components/shared/SegmentedSpinner";
import { DotMatrixLoader } from "@frontend/components/icon-bank/DotMatrixLoader";
import { DetailSheetRoot } from "./components/catalyst-modal/DetailSheetRoot";
import { useVixTicker } from "./hooks/useVixTicker";
import { useHaptic } from "./hooks/useHaptic";
import { useNotificationTapRouter } from "./hooks/useNotificationTapRouter";

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
const ArbitrumPage = lazy(() =>
  import("./components/arbitrum/ArbitrumPage").then((m) => ({
    default: m.ArbitrumPage,
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
  const [submitted, setSubmitted] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => setShowLoader(true), 3000);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  function handleSignIn() {
    setSubmitted(true);
    void signIn();
  }

  const busy = isLoading || showLoader;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050402",
        color: "#f0ead6",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.75rem",
        padding: "24px",
      }}
    >
      <MobileGlobeMark accelerated={submitted} />
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "block",
            fontFamily: "'Doto', monospace",
            fontSize: "46px",
            color: "#f0ead6",
            letterSpacing: "0.15em",
          }}
        >
          FINTHEON
        </span>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 300,
          border: "1px solid rgba(199,159,74,0.18)",
          borderRadius: 22,
          background: "rgba(10,9,5,0.92)",
          padding: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 42,
              height: 2,
              overflow: "hidden",
              borderRadius: 2,
              background: "rgba(199,159,74,0.15)",
            }}
          >
            <span
              style={{
                display: "block",
                width: "50%",
                height: "100%",
                background: "rgba(199,159,74,0.55)",
                animation: "mobileAuthFuse 1800ms ease-in-out infinite",
              }}
            />
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "rgba(199,159,74,0.7)",
              textTransform: "uppercase",
            }}
          >
            {showLoader ? "Opening terminal" : "Access terminal"}
          </span>
        </div>
        {showLoader ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <DotMatrixLoader variant="diagonal-scan" size={28} label="Loading" />
          </div>
        ) : null}
        <button
          onClick={handleSignIn}
          disabled={busy || submitted}
          style={{
            width: "100%",
            fontFamily: "'Space Mono', monospace",
            fontSize: "12px",
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "#f0ead6",
            background: "transparent",
            border: "1px solid rgba(199,159,74,0.24)",
            borderRadius: "14px",
            padding: "12px 18px",
            cursor: busy || submitted ? "wait" : "pointer",
            opacity: busy || submitted ? 0.55 : 1,
          }}
        >
          [SIGN IN WITH GOOGLE]
        </button>
      </div>
      <style>{`
        @keyframes mobileAuthFuse {
          0%, 100% { transform: translateX(-85%); opacity: 0.35; }
          50% { transform: translateX(170%); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

function MobileGlobeMark({ accelerated }: { accelerated: boolean }) {
  return (
    <svg
      viewBox="0 0 160 160"
      style={{
        width: 154,
        height: 154,
        color: "#c79f4a",
      }}
      aria-hidden="true"
    >
      <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeOpacity=".42" />
      <g
        style={{
          transformOrigin: "80px 80px",
          animation: `mobileAuthGlobe ${accelerated ? "6s" : "18s"} linear infinite`,
        }}
      >
        <ellipse cx="80" cy="80" rx="58" ry="18" fill="none" stroke="currentColor" strokeOpacity=".28" />
        <ellipse cx="80" cy="80" rx="58" ry="34" fill="none" stroke="currentColor" strokeOpacity=".22" />
        <path d="M80 22c-22 20-22 96 0 116M80 22c22 20 22 96 0 116" fill="none" stroke="currentColor" strokeOpacity=".32" />
        <path d="M28 58h104M28 102h104" fill="none" stroke="currentColor" strokeOpacity=".2" />
      </g>
      <circle cx="80" cy="80" r="4" fill="currentColor" opacity=".75" />
      <style>{`
        @keyframes mobileAuthGlobe {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
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

  // [S25] SW notification-tap → tab + DetailSheet modal (via NotificationModalContext).
  useNotificationTapRouter({
    onTabChange: (idx) => handleTabChange(idx as number),
  });

  // [v5.22 polish] Notification drawer's "Ask CAO" swipe dispatches a
  // window event with {index} to switch tabs. Decoupled from the drawer so
  // the drawer doesn't need to know about layout state.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ index?: number }>).detail;
      if (typeof detail?.index === "number") {
        handleTabChange(detail.index);
      }
    };
    window.addEventListener("fintheon:tab-change", handler);
    return () => window.removeEventListener("fintheon:tab-change", handler);
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
            <ArbitrumPage />
          </Suspense>
        );
      case 5:
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
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
      {/* [S25] Sibling to MobileShell so it floats above the tab transition. */}
      <DetailSheetRoot onDispatched={() => handleTabChange(2)} />
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
        <DotMatrixLoader variant="diagonal-scan" size={28} label="Restoring session" />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <NotificationModalProvider>
      <AuthenticatedApp />
    </NotificationModalProvider>
  );
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

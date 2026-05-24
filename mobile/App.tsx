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
import { LoadingBootScreen } from "@frontend/components/loading/LoadingBootScreen";
import { MobileLoginScreen } from "./components/auth/MobileLoginScreen";
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
  const { isAuthenticated, isLoading, signIn } = useAuth();

  if (isLoading) {
    return <LoadingBootScreen phrase="Restoring session" compact />;
  }

  if (!isAuthenticated) {
    return <MobileLoginScreen onSignIn={signIn} isLoading={isLoading} />;
  }

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

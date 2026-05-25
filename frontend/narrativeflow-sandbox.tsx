import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Landmark, LineChart } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { FintheonAgentProvider } from "./contexts/FintheonAgentContext";
import { VoiceProvider } from "./contexts/VoiceContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NarrativeProvider } from "./contexts/NarrativeContext";
import { NarrativeCanvas } from "./components/narrative/NarrativeCanvas";
import { NarrativeAnalysisDropdown } from "./components/consilium/NarrativeAnalysisDropdown";
import { isNarrativeSurfaceMode, type NarrativeSurfaceMode } from "./components/narrative/narrative-surface-options";
import { installNarrativeFlowMockApi } from "./sandbox/narrativeflow/mock-api";
import { mockThemes } from "./sandbox/narrativeflow/mock-data";
import "./index.css";

installNarrativeFlowMockApi();

interface NarrativeFlowSandboxWindow extends Window {
  __narrativeFlowSandboxRoot?: ReactDOM.Root;
}

interface NarrativeFlowSandboxMount extends HTMLDivElement {
  __narrativeFlowSandboxRoot?: ReactDOM.Root;
}

function NarrativeFlowSandbox() {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [surfaceMode, setSurfaceMode] = useState<NarrativeSurfaceMode>("workspace");
  const [showChart, setShowChart] = useState(false);
  const [researchRailOpen, setResearchRailOpen] = useState(true);

  useEffect(() => {
    const handleSurfaceState = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
      if (isNarrativeSurfaceMode(mode)) setSurfaceMode(mode);
    };
    const handleResearchState = (event: Event) => {
      const open = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === "boolean") setResearchRailOpen(open);
    };
    window.addEventListener("fintheon:narrative-surface-state", handleSurfaceState);
    window.addEventListener("fintheon:narrative-research-rail-state", handleResearchState);
    return () => {
      window.removeEventListener("fintheon:narrative-surface-state", handleSurfaceState);
      window.removeEventListener("fintheon:narrative-research-rail-state", handleResearchState);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("fintheon:narrative-surface-change", {
          detail: { mode: surfaceMode },
        }),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [surfaceMode]);

  function selectSurface(mode: NarrativeSurfaceMode) {
    setSurfaceMode(mode);
  }

  return (
    <div className="narrativeflow-sandbox-shell dark relative h-screen overflow-hidden bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <div className="consilium-tab-bar absolute inset-x-0 top-0 flex items-center gap-0.5 px-4 pb-1.5 pt-3">
        <h2 className="consilium-tab-bar__title mr-3 flex items-center gap-1.5 text-sm font-medium uppercase tracking-[0.2em] text-[var(--fintheon-accent)]">
          <Landmark size={14} />
          <span>Consilium</span>
        </h2>
        <button className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--fintheon-accent)]/28 px-3 py-1.5 text-xs font-medium text-[var(--fintheon-accent)]">
          NarrativeFlow
        </button>
        <div className="flex-1" />
        <div id="narrativeflow-header-actions" className="flex items-center gap-1.5" />
        <div id="narrativeflow-map-controls" className="flex items-center gap-1.5" />
        <button
          type="button"
          onClick={() => setShowChart((value) => !value)}
          className={`flex items-center rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            showChart
              ? "border border-[var(--fintheon-accent)]/28 text-[var(--fintheon-accent)]"
              : "border border-transparent text-[var(--fintheon-accent)]/40 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-accent)]/70"
          }`}
          title={showChart ? "Close split panel" : "Open split panel"}
          aria-label={showChart ? "Close split panel" : "Open split panel"}
        >
          <LineChart size={14} />
        </button>
        <NarrativeAnalysisDropdown
          open={analysisOpen}
          currentMode={surfaceMode}
          showDeskRail={false}
          researchRailOpen={researchRailOpen}
          onOpenChange={setAnalysisOpen}
          onSelectMode={selectSurface}
          onToggleDeskRail={() => undefined}
          onToggleResearchRail={() => window.dispatchEvent(new Event("fintheon:narrative-research-rail-toggle"))}
        />
      </div>
      <main className="flex h-full min-h-0 overflow-hidden">
        <section
          className="min-w-0 transition-[flex-basis] duration-300 ease-out"
          style={{ flexBasis: showChart ? "50%" : "100%" }}
        >
          <NarrativeCanvas
            themes={mockThemes}
            chartMode={showChart}
            surfaceModeOverride={surfaceMode}
          />
        </section>
        <aside
          aria-hidden={!showChart}
          className={`grid shrink-0 place-items-center overflow-hidden border-l border-[var(--fintheon-accent)]/15 text-xs uppercase tracking-[0.16em] text-[var(--fintheon-muted)] transition-[flex-basis,transform] duration-300 ease-out ${
            showChart ? "" : "pointer-events-none"
          }`}
          style={{
            flexBasis: showChart ? "50%" : "0%",
            transform: showChart ? "translateX(0)" : "translateX(100%)",
          }}
        >
          <span className="whitespace-nowrap">Split panel reserved</span>
        </aside>
      </main>
    </div>
  );
}

function SandboxProviders() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <FintheonAgentProvider>
            <VoiceProvider>
              <NarrativeProvider>
                <NarrativeFlowSandbox />
              </NarrativeProvider>
            </VoiceProvider>
          </FintheonAgentProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const sandboxWindow = window as NarrativeFlowSandboxWindow;
const rootElement = document.getElementById("root")!;
const existingMount = document.getElementById(
  "narrativeflow-sandbox-mount",
) as NarrativeFlowSandboxMount | null;
const mountElement =
  existingMount ?? (document.createElement("div") as NarrativeFlowSandboxMount);
if (!existingMount) {
  rootElement.replaceChildren(mountElement);
  mountElement.id = "narrativeflow-sandbox-mount";
}
const root =
  sandboxWindow.__narrativeFlowSandboxRoot ??
  mountElement.__narrativeFlowSandboxRoot ??
  ReactDOM.createRoot(mountElement);
sandboxWindow.__narrativeFlowSandboxRoot = root;
mountElement.__narrativeFlowSandboxRoot = root;

root.render(
  <React.StrictMode>
    <SandboxProviders />
  </React.StrictMode>,
);

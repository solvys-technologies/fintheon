// [claude-code 2026-04-28] S48-T3: Added econ countdown test button
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — developer settings tab
import React, { useState, useRef, useCallback } from "react";
import Toggle from "../Toggle";
import { Button } from "../ui/Button";
import { RiskFlowSettings } from "./RiskFlowSettings";
import { DevPasswordGate } from "./DevPasswordGate";
import { CountdownFuse } from "../shared/CountdownFuse";

interface DeveloperTabProps {
  devAuthenticated: boolean;
  onAuthenticated: () => void;
  tier: string;
  setTier: (tier: any) => void;
  mockDataEnabled: boolean;
  setMockDataEnabled: (val: boolean) => void;
  developerSettings: any;
  setDeveloperSettings: (settings: any) => void;
}

export function DeveloperTab({
  devAuthenticated,
  onAuthenticated,
  tier,
  setTier,
  mockDataEnabled,
  setMockDataEnabled,
  developerSettings,
  setDeveloperSettings,
}: DeveloperTabProps) {
  const [countdownTestActive, setCountdownTestActive] = useState(false);
  const [countdownPhase, setCountdownPhase] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [testSeconds, setTestSeconds] = useState(60);
  const testTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdownTest = useCallback(() => {
    setCountdownTestActive(true);
    setCountdownPhase("running");
    setTestSeconds(60);
    testTimerRef.current = setInterval(() => {
      setTestSeconds((s) => {
        if (s <= 1) {
          if (testTimerRef.current) clearInterval(testTimerRef.current);
          setCountdownPhase("done");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const closeCountdownTest = useCallback(() => {
    if (testTimerRef.current) clearInterval(testTimerRef.current);
    setCountdownTestActive(false);
    setCountdownPhase("idle");
  }, []);

  if (!devAuthenticated) {
    return <DevPasswordGate onAuthenticated={onAuthenticated} />;
  }

  return (
    <div className="space-y-6">
      {/* RiskFlow Settings — new T6 section */}
      <RiskFlowSettings />

      {/* S48-T3: Econ Countdown Test */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Econ Countdown Test
        </h3>
        <div className="flex items-center gap-3">
          <Button
            variant={countdownTestActive ? "secondary" : "primary"}
            onClick={startCountdownTest}
            disabled={countdownTestActive}
            className="text-xs"
          >
            {countdownPhase === "running"
              ? `Running (${testSeconds}s)...`
              : "Test 60s Countdown"}
          </Button>
          {countdownTestActive && (
            <Button
              variant="secondary"
              onClick={closeCountdownTest}
              className="text-xs"
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Simulates a full countdown lifecycle: 60s drain, blink, beat/miss/par
          result
        </p>
        {countdownTestActive && (
          <div style={{ marginTop: 12 }}>
            <CountdownFuse
              eventName="NFP (TEST)"
              countdownSeconds={60}
              forecast="165K"
              actual={countdownPhase === "done" ? "175K" : null}
              previous="142K"
              beatMiss={countdownPhase === "done" ? "beat" : null}
              floating
              onClose={closeCountdownTest}
            />
          </div>
        )}
      </section>

      {/* Existing Developer Settings below */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Account Tier
        </h3>
        <div className="flex gap-2">
          {(["free", "fintheon", "fintheon_plus", "fintheon_pro"] as const).map(
            (t) => (
              <Button
                key={t}
                variant={tier === t ? "primary" : "secondary"}
                onClick={() => setTier(t)}
                className="text-xs"
              >
                {t.replace("_", " ").toUpperCase()}
              </Button>
            ),
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Developer Settings
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Enable Mock Data Feed"
            enabled={mockDataEnabled}
            onChange={setMockDataEnabled}
          />
          <p className="text-xs text-gray-500">
            Generates simulated market data and news items for testing
          </p>
          <Toggle
            label="Show Test Trade Button"
            enabled={developerSettings.showTestTradeButton}
            onChange={(val) =>
              setDeveloperSettings({
                ...developerSettings,
                showTestTradeButton: val,
              })
            }
          />
          <p className="text-xs text-gray-500">
            Display test trade button for firing mock market orders to TopstepX
          </p>
          <Toggle
            label="Show Mock Proposal Trigger"
            enabled={developerSettings.showMockProposal}
            onChange={(val) =>
              setDeveloperSettings({
                ...developerSettings,
                showMockProposal: val,
              })
            }
          />
          <p className="text-xs text-gray-500">
            Show a button on the Tape to trigger a mock trading proposal for UX
            testing
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Feature Flags
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Show placeholder briefings"
            enabled={developerSettings.showPlaceholderBriefings ?? false}
            onChange={(val) =>
              setDeveloperSettings({
                ...developerSettings,
                showPlaceholderBriefings: val,
              })
            }
          />
          <p className="text-xs text-gray-500">
            When off, empty briefs show "No brief available" instead of
            "Awaiting AI-generated brief..."
          </p>
          <Toggle
            label="AgentDesk simulations"
            enabled={developerSettings.agentDeskSimulations ?? false}
            onChange={(val) =>
              setDeveloperSettings({
                ...developerSettings,
                agentDeskSimulations: val,
              })
            }
          />
          <p className="text-xs text-gray-500">
            Enable AgentDesk simulation layer for narrative and IV prediction
            testing
          </p>
          <Toggle
            label="Agent auto-proposals"
            enabled={developerSettings.agentAutoProposals ?? false}
            onChange={(val) =>
              setDeveloperSettings({
                ...developerSettings,
                agentAutoProposals: val,
              })
            }
          />
          <p className="text-xs text-gray-500">
            Allow agents to automatically generate and submit trade proposals
            without manual trigger
          </p>
        </div>
      </section>
    </div>
  );
}

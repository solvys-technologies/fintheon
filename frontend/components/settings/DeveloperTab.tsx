// [claude-code 2026-04-26] Added Econ Countdown 1-min mock trigger so TP can
// verify the modal end-to-end without waiting for a real economic print.
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — developer settings tab
import React from "react";
import Toggle from "../Toggle";
import { Button } from "../ui/Button";
// [claude-code 2026-04-26] Removed RiskFlowSettings (Event Weight Calibration /
// Current Market Regime / Persons of Interest Tiers) per TP — those moved
// out of Developer settings.
import { DevPasswordGate } from "./DevPasswordGate";

function fireMockEconCountdown(): void {
  window.dispatchEvent(
    new CustomEvent("fintheon:econ-mock-countdown", {
      detail: {
        durationMs: 60_000,
        eventName: "MOCK · Test Print (1m)",
        country: "US",
        category: "Mock",
        forecast: 0.5,
        previous: 0.4,
        actual: 0.7,
      },
    }),
  );
}

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
  if (!devAuthenticated) {
    return <DevPasswordGate onAuthenticated={onAuthenticated} />;
  }

  return (
    <div className="space-y-6">
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
          Econ Countdown
        </h3>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fireMockEconCountdown}
            className="text-xs"
          >
            Trigger 1-Min Mock Countdown
          </Button>
          <p className="text-xs text-gray-500">
            Inserts a mock event scheduled 60s from now and fires a synthetic
            print on expiry — exercises fade-in, mm:ss tick, and printed-state
            cross-fade end-to-end.
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

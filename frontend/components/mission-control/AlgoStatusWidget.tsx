// [claude-code 2026-04-24] S37: converted the iOS-pill master toggle + "● Active/Idle" indicators into horizontal NothingFuse fills — same vertical-fuse vocabulary as RiskFlow cards, rotated 90°. Full fill = enabled/active, empty = disabled/idle. Master fuse tracks algoEnabled; each strategy-category fuse tracks enabledCount / totalCount.
import { Cpu } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useBackend } from "../../lib/backend";
import { useState, useEffect } from "react";
import { LockedCard } from "../ui/LockedCard";
import { NothingFuse } from "../shared/NothingFuse";
import { IS_INTERNAL_BUILD } from "../../lib/internal-build";

export function AlgoStatusWidget() {
  const { tier } = useAuth();
  const { tradingModels, developerSettings } = useSettings();
  const backend = useBackend();
  const [algoEnabled, setAlgoEnabled] = useState<boolean>(false);
  const isLocked = !IS_INTERNAL_BUILD && tier === "free";

  useEffect(() => {
    if (!developerSettings.accountTrackerEnabled) return;
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setAlgoEnabled(account.algoEnabled ?? false);
      } catch (err) {
        console.warn("Failed to fetch account:", err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend, developerSettings.accountTrackerEnabled]);

  const handleToggleAlgo = async () => {
    try {
      const result = await backend.trading.toggleAlgo({
        enabled: !algoEnabled,
      });
      setAlgoEnabled(result.algoEnabled ?? !algoEnabled);
    } catch (err) {
      console.warn("Failed to toggle algo:", err);
    }
  };

  // Map strategies to categories based on tradingModels
  const categories = [
    {
      name: "Price Action Strategies",
      strategies: [
        { name: "Morning Flush", key: "morningFlush" },
        { name: "Lunch Power Hour Flush", key: "lunchPowerHourFlush" },
        { name: "40/40 Club", key: "fortyFortyClub" },
        { name: "Momentum Model", key: "momentumModel" },
      ],
    },
    {
      name: "Volatility Strategies",
      strategies: [{ name: "22 VIX Fix", key: "vixFixer" }],
    },
    {
      name: "Risk Event-Based Strategies",
      strategies: [{ name: "Charged Up Rippers", key: "chargedUpRippers" }],
    },
    {
      name: "Mean Reversion",
      strategies: [{ name: "Mean Reversion Model", key: "meanReversionModel" }],
    },
  ];

  const content = (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Autopilot
          </h3>
        </div>
        {/* [S37] Master toggle = horizontal fuse. Full fill when on, empty when off. */}
        <button
          onClick={handleToggleAlgo}
          title={
            algoEnabled
              ? "Autopilot ON — tap to stop"
              : "Autopilot OFF — tap to start"
          }
          aria-pressed={algoEnabled}
          className="flex items-center gap-2 py-1 px-2 hover:bg-[var(--fintheon-accent)]/8 transition-colors"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: algoEnabled
                ? "var(--fintheon-accent)"
                : "var(--fintheon-muted)",
              opacity: algoEnabled ? 1 : 0.55,
              minWidth: 22,
              textAlign: "right",
            }}
          >
            {algoEnabled ? "ON" : "OFF"}
          </span>
          <div style={{ width: 44 }}>
            <NothingFuse
              value={algoEnabled ? 1 : 0}
              color={
                algoEnabled
                  ? "var(--fintheon-accent)"
                  : "var(--fintheon-muted)"
              }
              orientation="horizontal"
              thickness={6}
              segments={4}
            />
          </div>
        </button>
      </div>
      <div className="space-y-3">
        {categories.map((category) => {
          const total = category.strategies.length;
          const enabledCount = category.strategies.filter(
            (s) => tradingModels[s.key as keyof typeof tradingModels],
          ).length;
          const ratio = total === 0 ? 0 : enabledCount / total;
          const hasEnabled = enabledCount > 0;

          return (
            <div key={category.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">
                  {category.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: hasEnabled
                      ? "var(--fintheon-bullish)"
                      : "var(--fintheon-muted)",
                    opacity: hasEnabled ? 0.9 : 0.5,
                  }}
                >
                  {hasEnabled ? `Active · ${enabledCount}/${total}` : "Idle"}
                </span>
              </div>
              {/* [S37] Horizontal fuse replaces the `● Active / ● Idle` dot. Fill ratio
                  reflects how many sub-strategies inside the category are live. */}
              <NothingFuse
                value={ratio}
                color={
                  hasEnabled
                    ? "var(--fintheon-bullish)"
                    : "var(--fintheon-muted)"
                }
                orientation="horizontal"
                thickness={4}
                segments={Math.max(total, 4)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return <LockedCard locked={isLocked}>{content}</LockedCard>;
}

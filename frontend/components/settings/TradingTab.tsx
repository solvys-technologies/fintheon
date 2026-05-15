// [claude-code 2026-05-15] S66-T1: added instrument selector dropdown grouped by asset class.
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — trading tab
// [claude-code 2026-05-13] Added lockout controls + quick access URL
// [claude-code 2026-05-13] S64 T3: Enhanced lockout settings (auto-release, persistent, scheduled unlock status)
import React, { useState, useEffect } from "react";
import Toggle from "../Toggle";
import { useLockout } from "../../hooks/useLockout";

type PrimaryBroker = "rithmic" | "projectx" | "mmt";

const INSTRUMENT_GROUPS: { label: string; instruments: { symbol: string; name: string }[] }[] = [
  {
    label: "Equity Index Futures",
    instruments: [
      { symbol: "/NQ", name: "Nasdaq 100" },
      { symbol: "/ES", name: "S&P 500" },
      { symbol: "/YM", name: "Dow Jones" },
      { symbol: "/RTY", name: "Russell 2000" },
      { symbol: "/MNQ", name: "Micro Nasdaq" },
      { symbol: "/MES", name: "Micro S&P" },
      { symbol: "/MYM", name: "Micro Dow" },
      { symbol: "/M2K", name: "Micro Russell" },
    ],
  },
  {
    label: "Commodities",
    instruments: [
      { symbol: "/CL", name: "Crude Oil" },
      { symbol: "/GC", name: "Gold" },
      { symbol: "/SI", name: "Silver" },
      { symbol: "/NG", name: "Natural Gas" },
      { symbol: "/MCL", name: "Micro Crude" },
      { symbol: "/MGC", name: "Micro Gold" },
      { symbol: "/SIL", name: "Micro Silver" },
    ],
  },
  {
    label: "Bonds",
    instruments: [
      { symbol: "/ZB", name: "30-Year T-Bond" },
      { symbol: "/ZN", name: "10-Year T-Note" },
      { symbol: "/ZT", name: "2-Year T-Note" },
    ],
  },
  {
    label: "Crypto",
    instruments: [
      { symbol: "/BTC", name: "Bitcoin Futures" },
      { symbol: "/ETH", name: "Ethereum Futures" },
    ],
  },
  {
    label: "Currencies",
    instruments: [
      { symbol: "/6E", name: "Euro FX" },
      { symbol: "/6J", name: "Japanese Yen" },
      { symbol: "/6B", name: "British Pound" },
      { symbol: "/6A", name: "Australian Dollar" },
      { symbol: "/6C", name: "Canadian Dollar" },
      { symbol: "/6S", name: "Swiss Franc" },
    ],
  },
];

const LOCKOUT_PRESETS = [5, 10, 15, 30, 60, 120];

interface TradingTabProps {
  riskSettings: any;
  setRiskSettings: (settings: any) => void;
  contractsPerTrade: number;
  setContractsPerTrade: (val: number) => void;
  primaryBroker: PrimaryBroker;
  setPrimaryBroker: (broker: PrimaryBroker) => void;
  autoPilotSettings: any;
  setAutoPilotSettings: (settings: any) => void;
  tradingModels: any;
  setTradingModels: (models: any) => void;
  lockoutDefaultDuration: number;
  setLockoutDefaultDuration: (minutes: number) => void;
  lockoutAutoReleaseMinutes: number;
  setLockoutAutoReleaseMinutes: (minutes: number) => void;
  persistentLockout: boolean;
  setPersistentLockout: (enabled: boolean) => void;
  quickAccessUrl: string;
  setQuickAccessUrl: (url: string) => void;
  selectedInstrument: string;
  setSelectedInstrument: (instrument: string) => void;
}

export function TradingTab({
  riskSettings,
  setRiskSettings,
  contractsPerTrade,
  setContractsPerTrade,
  primaryBroker,
  setPrimaryBroker,
  autoPilotSettings,
  setAutoPilotSettings,
  tradingModels,
  setTradingModels,
  lockoutDefaultDuration,
  setLockoutDefaultDuration,
  lockoutAutoReleaseMinutes,
  setLockoutAutoReleaseMinutes,
  persistentLockout,
  setPersistentLockout,
  quickAccessUrl,
  setQuickAccessUrl,
  selectedInstrument,
  setSelectedInstrument,
}: TradingTabProps) {
  const {
    state: lockoutState,
    lock: lockoutLock,
    unlock: lockoutUnlock,
  } = useLockout();

  // [claude-code 2026-05-13] S63 T3: Sync quick access URL to main process for dock menu
  useEffect(() => {
    const el = (window as any).electron;
    if (el?.quickAccess?.setUrl) {
      el.quickAccess.setUrl(quickAccessUrl);
    }
  }, [quickAccessUrl]);

  return (
    <>
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">
          Instrument
        </h3>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Selected Instrument
            </label>
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            >
              {INSTRUMENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.instruments.map((inst) => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol} — {inst.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              IV scores and Desk Plan entries are tailored to the selected
              instrument. Changing applies globally.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">
          Risk Management
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Daily Profit Target
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={riskSettings.dailyProfitTarget}
                onChange={(e) =>
                  setRiskSettings({
                    ...riskSettings,
                    dailyProfitTarget: parseFloat(e.target.value) || 0,
                  })
                }
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Target profit amount per trading day
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Daily Loss Limit
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={riskSettings.dailyLossLimit}
                onChange={(e) =>
                  setRiskSettings({
                    ...riskSettings,
                    dailyLossLimit: parseFloat(e.target.value) || 0,
                  })
                }
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Maximum loss amount per trading day
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Contracts Per Trade
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={contractsPerTrade}
                onChange={(e) =>
                  setContractsPerTrade(
                    Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                  )
                }
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Number of contracts the algorithm will use per trade. Stop loss is
              automatically calculated to ensure $330 total risk per trade.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Over-Trading Monitor
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">
                  Max Trades
                </label>
                <select
                  value={riskSettings.maxTrades || 5}
                  onChange={(e) =>
                    setRiskSettings({
                      ...riskSettings,
                      maxTrades: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30].map(
                    (num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">
                  Duration
                </label>
                <select
                  value={riskSettings.overTradingDuration || 15}
                  onChange={(e) =>
                    setRiskSettings({
                      ...riskSettings,
                      overTradingDuration: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                >
                  {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(
                    (min) => (
                      <option key={min} value={min}>
                        {min} min
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Maximum number of trades allowed within the specified duration
              window
            </p>
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-4">
          Lockout
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  lockoutState.locked
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-green-500/10 text-green-400 border border-green-500/20"
                }`}
              >
                {lockoutState.locked ? "Locked" : "Unlocked"}
              </span>
              {lockoutState.locked && lockoutState.remaining && (
                <span className="text-xs text-gray-400 font-mono">
                  {Math.floor(lockoutState.remaining / 60)}m{" "}
                  {lockoutState.remaining % 60}s
                </span>
              )}
            </div>
            {lockoutState.locked ? (
              <button
                onClick={() => lockoutUnlock()}
                className="text-xs px-2 py-1 rounded border bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
              >
                Unlock
              </button>
            ) : (
              <div className="flex gap-1.5">
                {LOCKOUT_PRESETS.map((min) => (
                  <button
                    key={min}
                    onClick={() => lockoutLock(min)}
                    className="text-xs px-2 py-1 rounded border bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400 hover:text-white"
                  >
                    {min >= 60
                      ? `${Math.floor(min / 60)}h${min % 60 > 0 ? min % 60 : ""}`
                      : `${min}m`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 shrink-0">Default</label>
            <select
              value={lockoutDefaultDuration}
              onChange={(e) =>
                setLockoutDefaultDuration(parseInt(e.target.value))
              }
              className="bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
            >
              {LOCKOUT_PRESETS.map((min) => (
                <option key={min} value={min}>
                  {min >= 60
                    ? `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ""}`
                    : `${min}m`}
                </option>
              ))}
            </select>
          </div>

          {/* S64 T3: Enhanced lockout settings */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 shrink-0">
                Auto-release (min before window)
              </label>
              <input
                type="number"
                min={5}
                max={30}
                value={lockoutAutoReleaseMinutes}
                onChange={(e) =>
                  setLockoutAutoReleaseMinutes(
                    Math.max(5, Math.min(30, parseInt(e.target.value) || 15)),
                  )
                }
                className="w-16 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <Toggle
              label="Persistent lockout (survives restart)"
              enabled={persistentLockout}
              onChange={setPersistentLockout}
            />
            {lockoutState.locked && lockoutState.autoReleaseAt && (
              <div className="bg-[var(--fintheon-surface)] border border-zinc-800 rounded p-3 text-xs text-gray-400 space-y-1">
                <p>
                  <span className="text-gray-500">Scheduled unlock:</span>{" "}
                  {new Date(lockoutState.autoReleaseAt).toLocaleTimeString()}
                </p>
                {lockoutState.scheduledBy && (
                  <p>
                    <span className="text-gray-500">Triggered by:</span>{" "}
                    {lockoutState.scheduledBy === "desk_plan"
                      ? "Desk Plan"
                      : lockoutState.scheduledBy === "system"
                        ? "System"
                        : "Manual"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-4">
          Quick Access
        </h2>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Quick Access URL
            </h4>
            <input
              type="url"
              value={quickAccessUrl}
              onChange={(e) => setQuickAccessUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder-gray-600"
            />
            <p className="text-xs text-gray-500 mt-2">
              URL opened from the macOS dock menu / system tray quick access
              item
            </p>
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-4">
          Autopilot
        </h2>

        <div className="space-y-6">
          {/* Primary broker (execution) */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Primary broker
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => setPrimaryBroker("rithmic")}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === "rithmic"
                    ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
                    : "bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400"
                }`}
              >
                Rithmic (primary)
              </button>
              <button
                onClick={() => setPrimaryBroker("projectx")}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === "projectx"
                    ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
                    : "bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400"
                }`}
              >
                ProjectX
              </button>
              <button
                onClick={() => setPrimaryBroker("mmt")}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === "mmt"
                    ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
                    : "bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400"
                }`}
              >
                MMT (crypto)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Autopilot execution uses the selected broker. Rithmic for futures,
              ProjectX for sim, MMT for crypto order flow.
            </p>
          </div>

          {/* Broker connection info */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Broker Status
            </h4>
            <div className="bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg p-4 text-sm text-gray-400 space-y-1">
              <p>
                <span className="text-gray-500">Rithmic:</span> Gateway sidecar
                on localhost:3002
              </p>
              <p>
                <span className="text-gray-500">ProjectX:</span> TopStepX API
              </p>
              <p>
                <span className="text-gray-500">Hyperliquid:</span> Wallet auth
                — set HYPERLIQUID_PRIVATE_KEY in backend .env
              </p>
            </div>
          </div>

          {/* AutoPilot Mode Selector */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Autopilot Mode
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "off", label: "Off", desc: "Manual trading only" },
                {
                  value: "semi",
                  label: "Semi-Auto",
                  desc: "Proposals require approval",
                },
                {
                  value: "autonomous",
                  label: "Autonomous",
                  desc: "Auto-execute trades",
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() =>
                    setAutoPilotSettings({
                      ...autoPilotSettings,
                      mode: mode.value as "off" | "semi" | "autonomous",
                      requireConfirmation: mode.value !== "autonomous",
                    })
                  }
                  className={`p-3 rounded-lg border text-left transition-all ${
                    autoPilotSettings.mode === mode.value
                      ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40"
                      : "bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${autoPilotSettings.mode === mode.value ? "text-[var(--fintheon-accent)]" : "text-white"}`}
                  >
                    {mode.label}
                  </div>
                  <div className="text-[10px] text-gray-500">{mode.desc}</div>
                </button>
              ))}
            </div>
            {autoPilotSettings.mode === "autonomous" && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                Autonomous mode will execute trades automatically without
                confirmation
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Price Action Strategies
            </h4>
            <div className="space-y-3">
              <Toggle
                label="Morning Flush"
                enabled={tradingModels.morningFlush}
                onChange={(val) =>
                  setTradingModels({ ...tradingModels, morningFlush: val })
                }
              />
              <Toggle
                label="Lunch/Power Hour Flush"
                enabled={tradingModels.lunchPowerHourFlush}
                onChange={(val) =>
                  setTradingModels({
                    ...tradingModels,
                    lunchPowerHourFlush: val,
                  })
                }
              />
              <Toggle
                label="40/40 Club"
                enabled={tradingModels.fortyFortyClub}
                onChange={(val) =>
                  setTradingModels({ ...tradingModels, fortyFortyClub: val })
                }
              />
              <Toggle
                label="Momentum Model"
                enabled={tradingModels.momentumModel}
                onChange={(val) =>
                  setTradingModels({ ...tradingModels, momentumModel: val })
                }
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Volatility Strategies
            </h4>
            <div className="space-y-3">
              <Toggle
                label="22 VIX Fix"
                enabled={tradingModels.vixFixer}
                onChange={(val) =>
                  setTradingModels({ ...tradingModels, vixFixer: val })
                }
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Risk Event-Based Strategies
            </h4>
            <div className="space-y-3">
              <Toggle
                label="Charged Up Rippers"
                enabled={tradingModels.chargedUpRippers}
                onChange={(val) =>
                  setTradingModels({ ...tradingModels, chargedUpRippers: val })
                }
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
              Mean Reversion
            </h4>
            <div className="space-y-3">
              <Toggle
                label="Mean Reversion Model"
                enabled={tradingModels.meanReversionModel}
                onChange={(val) =>
                  setTradingModels({
                    ...tradingModels,
                    meanReversionModel: val,
                  })
                }
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Enable or disable specific trading models for your algorithmic
          strategy
        </p>
      </section>
    </>
  );
}

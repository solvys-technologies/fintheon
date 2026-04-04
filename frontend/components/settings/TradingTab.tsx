// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — trading tab
import React from 'react';
import Toggle from '../Toggle';

type PrimaryBroker = 'rithmic' | 'projectx' | 'mmt';

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
}

export function TradingTab({
  riskSettings, setRiskSettings,
  contractsPerTrade, setContractsPerTrade,
  primaryBroker, setPrimaryBroker,
  autoPilotSettings, setAutoPilotSettings,
  tradingModels, setTradingModels,
}: TradingTabProps) {
  return (
    <>
      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">Risk Management</h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Profit Target</h4>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={riskSettings.dailyProfitTarget}
                onChange={(e) => setRiskSettings({ ...riskSettings, dailyProfitTarget: parseFloat(e.target.value) || 0 })}
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Target profit amount per trading day
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Loss Limit</h4>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={riskSettings.dailyLossLimit}
                onChange={(e) => setRiskSettings({ ...riskSettings, dailyLossLimit: parseFloat(e.target.value) || 0 })}
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Maximum loss amount per trading day
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Contracts Per Trade</h4>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={contractsPerTrade}
                onChange={(e) => setContractsPerTrade(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Number of contracts the algorithm will use per trade. Stop loss is automatically calculated to ensure $330 total risk per trade.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Over-Trading Monitor</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Max Trades</label>
                <select
                  value={riskSettings.maxTrades || 5}
                  onChange={(e) => setRiskSettings({ ...riskSettings, maxTrades: parseInt(e.target.value) })}
                  className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Duration</label>
                <select
                  value={riskSettings.overTradingDuration || 15}
                  onChange={(e) => setRiskSettings({ ...riskSettings, overTradingDuration: parseInt(e.target.value) })}
                  className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                >
                  {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(min => (
                    <option key={min} value={min}>{min} min</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Maximum number of trades allowed within the specified duration window
            </p>
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-4">Autopilot</h2>

        <div className="space-y-6">
          {/* Primary broker (execution) */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Primary broker</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setPrimaryBroker('rithmic')}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === 'rithmic'
                    ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                    : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                }`}
              >
                Rithmic (primary)
              </button>
              <button
                onClick={() => setPrimaryBroker('projectx')}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === 'projectx'
                    ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                    : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                }`}
              >
                ProjectX
              </button>
              <button
                onClick={() => setPrimaryBroker('mmt')}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  primaryBroker === 'mmt'
                    ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                    : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                }`}
              >
                MMT (crypto)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Autopilot execution uses the selected broker. Rithmic for futures, ProjectX for sim, MMT for crypto order flow.
            </p>
          </div>

          {/* Broker connection info */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Broker Status</h4>
            <div className="bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg p-4 text-sm text-gray-400 space-y-1">
              <p><span className="text-gray-500">Rithmic:</span> Gateway sidecar on localhost:3002</p>
              <p><span className="text-gray-500">ProjectX:</span> TopStepX API</p>
              <p><span className="text-gray-500">Hyperliquid:</span> Wallet auth — set HYPERLIQUID_PRIVATE_KEY in backend .env</p>
            </div>
          </div>

          {/* AutoPilot Mode Selector */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Autopilot Mode</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'off', label: 'Off', desc: 'Manual trading only' },
                { value: 'semi', label: 'Semi-Auto', desc: 'Proposals require approval' },
                { value: 'autonomous', label: 'Autonomous', desc: 'Auto-execute trades' },
              ].map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setAutoPilotSettings({
                    ...autoPilotSettings,
                    mode: mode.value as 'off' | 'semi' | 'autonomous',
                    requireConfirmation: mode.value !== 'autonomous'
                  })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    autoPilotSettings.mode === mode.value
                      ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40'
                      : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`text-sm font-medium ${autoPilotSettings.mode === mode.value ? 'text-[var(--fintheon-accent)]' : 'text-white'}`}>
                    {mode.label}
                  </div>
                  <div className="text-[10px] text-gray-500">{mode.desc}</div>
                </button>
              ))}
            </div>
            {autoPilotSettings.mode === 'autonomous' && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                Autonomous mode will execute trades automatically without confirmation
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Price Action Strategies</h4>
            <div className="space-y-3">
              <Toggle
                label="Morning Flush"
                enabled={tradingModels.morningFlush}
                onChange={(val) => setTradingModels({ ...tradingModels, morningFlush: val })}
              />
              <Toggle
                label="Lunch/Power Hour Flush"
                enabled={tradingModels.lunchPowerHourFlush}
                onChange={(val) => setTradingModels({ ...tradingModels, lunchPowerHourFlush: val })}
              />
              <Toggle
                label="40/40 Club"
                enabled={tradingModels.fortyFortyClub}
                onChange={(val) => setTradingModels({ ...tradingModels, fortyFortyClub: val })}
              />
              <Toggle
                label="Momentum Model"
                enabled={tradingModels.momentumModel}
                onChange={(val) => setTradingModels({ ...tradingModels, momentumModel: val })}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Volatility Strategies</h4>
            <div className="space-y-3">
              <Toggle
                label="22 VIX Fix"
                enabled={tradingModels.vixFixer}
                onChange={(val) => setTradingModels({ ...tradingModels, vixFixer: val })}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Risk Event-Based Strategies</h4>
            <div className="space-y-3">
              <Toggle
                label="Charged Up Rippers"
                enabled={tradingModels.chargedUpRippers}
                onChange={(val) => setTradingModels({ ...tradingModels, chargedUpRippers: val })}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Mean Reversion</h4>
            <div className="space-y-3">
              <Toggle
                label="Mean Reversion Model"
                enabled={tradingModels.meanReversionModel}
                onChange={(val) => setTradingModels({ ...tradingModels, meanReversionModel: val })}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Enable or disable specific trading models for your algorithmic strategy
        </p>
      </section>
    </>
  );
}

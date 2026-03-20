import { X, Settings, Bell, Shield, CreditCard, Cpu, Code, Radio, Volume2, Terminal } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { usePsych } from '../contexts/PsychContext';
import { useAuth } from '../contexts/AuthContext';
import Toggle from './Toggle';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import { useBackend } from '../lib/backend';
import { HEALING_BOWL_SOUNDS, healingBowlPlayer } from '../utils/healingBowlSounds';
import type { HealingBowlSound } from '../utils/healingBowlSounds';

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsTab = 'general' | 'notifications' | 'trading' | 'api' | 'developer';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { tier, setTier } = useAuth();
  const {
    apiKeys,
    setAPIKeys,
    tradingModels,
    setTradingModels,
    alertConfig,
    setAlertConfig,
    mockDataEnabled,
    setMockDataEnabled,
    selectedSymbol,
    setSelectedSymbol,
    riskSettings,
    setRiskSettings,
    developerSettings,
    setDeveloperSettings,
  } = useSettings();
  const backend = useBackend();
  const {
    profile: psychProfile,
    saveProfile: savePsychProfile,
    loading: psychLoading
  } = usePsych();
  const [contractsPerTrade, setContractsPerTrade] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const handleTabChange = (tab: SettingsTab) => {
    if (tab === activeTab || tabTransitioning) return;
    setTabTransitioning(true);
    setPrevTab(activeTab);
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => {
        setTabTransitioning(false);
        setPrevTab(null);
      }, 50);
    }, 300);
  };

  const availableSymbols = [
    { 
      symbol: 'MNQ', 
      contractName: 'MNQ Z25', 
      description: 'E-mini Micro Nasdaq Futures' 
    },
    { 
      symbol: 'ES', 
      contractName: 'ES Z25', 
      description: 'E-mini S&P 500 Futures' 
    },
    { 
      symbol: 'NQ', 
      contractName: 'NQ Z25', 
      description: 'E-mini Nasdaq-100 Futures' 
    },
    { 
      symbol: 'YM', 
      contractName: 'YM Z25', 
      description: 'E-mini Dow Jones Futures' 
    },
    { 
      symbol: 'RTY', 
      contractName: 'RTY Z25', 
      description: 'E-mini Russell 2000 Futures' 
    },
  ];

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [prevTab, setPrevTab] = useState<SettingsTab | null>(null);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [psychBlindSpots, setPsychBlindSpots] = useState<string[]>(['', '', '']);
  const [psychGoal, setPsychGoal] = useState('');
  const [psychSaveMessage, setPsychSaveMessage] = useState<string | null>(null);
  const [psychSaving, setPsychSaving] = useState(false);

  useEffect(() => {
    if (psychProfile) {
      const spots = [...psychProfile.blindSpots, '', '', ''].slice(0, 3);
      setPsychBlindSpots(spots);
      setPsychGoal(psychProfile.goal ?? '');
    }
  }, [psychProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Save risk settings, selected symbol, and contracts per trade
      await backend.account.updateSettings({
        dailyTarget: riskSettings.dailyProfitTarget,
        dailyLossLimit: riskSettings.dailyLossLimit,
        topstepxUsername: apiKeys.topstepxUsername,
        topstepxApiKey: apiKeys.topstepxApiKey,
        selectedSymbol: selectedSymbol.symbol, // Save selected symbol to database for algorithm
        contractsPerTrade: contractsPerTrade, // Save contracts per trade for algorithm
      });

      // Save ProjectX credentials if provided
      if (apiKeys.topstepxUsername || apiKeys.topstepxApiKey) {
        await backend.account.updateProjectXCredentials({
          username: apiKeys.topstepxUsername || undefined,
          apiKey: apiKeys.topstepxApiKey || undefined,
        });
      }

      setSaveMessage('Settings saved successfully!');
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 1300);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePsychSave = async () => {
    setPsychSaving(true);
    setPsychSaveMessage(null);
    try {
      await savePsychProfile({
        blindSpots: psychBlindSpots,
        goal: psychGoal,
        source: 'settings'
      });
      setPsychSaveMessage('Psych Assist profile updated.');
    } catch (error) {
      console.error('Failed to save psych profile:', error);
      setPsychSaveMessage('Failed to save Psych Assist settings. Please try again.');
    } finally {
      setPsychSaving(false);
    }
  };

  // Load existing account settings from backend when component mounts
  useEffect(() => {
    async function loadAccountSettings() {
      try {
        const account = await backend.account.get();
        if (account.contractsPerTrade) {
          setContractsPerTrade(account.contractsPerTrade);
        }
      } catch (error) {
        console.error('Failed to load account settings:', error);
      }
    }
    loadAccountSettings();
  }, [backend]);

  // Load existing ProjectX credentials from backend when component mounts
  useEffect(() => {
    async function loadCredentials() {
      try {
        const account = await backend.account.get();
        if (account.projectxUsername) {
          setAPIKeys({
            ...apiKeys,
            topstepxUsername: account.projectxUsername,
          });
        }
      } catch (error) {
        console.error('Failed to load ProjectX credentials:', error);
      }
    }
    loadCredentials();
  }, []);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'psych' as const, label: 'Psych Assist', icon: Shield },
    { id: 'trading' as const, label: 'Trading', icon: Cpu },
    { id: 'api' as const, label: 'API', icon: Code },
    { id: 'developer' as const, label: 'Developer', icon: Terminal },
  ];

  return (
    <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`bg-[#0a0a00] border border-[#D4AF37]/30 rounded-lg w-full max-w-4xl max-h-[80vh] mx-4 flex ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="w-48 border-r border-[#D4AF37]/20 p-4">
          <div className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-lush ${activeTab === tab.id
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'text-gray-400 hover:bg-[#D4AF37]/10 hover:text-gray-300'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="sticky top-0 bg-[#0a0a00] border-b border-[#D4AF37]/20 p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#D4AF37]">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => onClose(), 1300);
              }}
              className="p-2 hover:bg-[#D4AF37]/10 rounded transition-lush"
            >
              <X className="w-5 h-5 text-[#D4AF37]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pb-20 space-y-6 relative">
            {activeTab === 'notifications' && (
              <div key="notifications" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Alert Configuration</h3>
                  <div className="space-y-3">
                    <Toggle
                      label="Price Alerts"
                      enabled={alertConfig.priceAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, priceAlerts: val })}
                    />
                    <Toggle
                      label="Psychological Alerts"
                      enabled={alertConfig.psychAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, psychAlerts: val })}
                    />
                    <Toggle
                      label="News Alerts"
                      enabled={alertConfig.newsAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, newsAlerts: val })}
                    />
                    <Toggle
                      label="Sound Enabled"
                      enabled={alertConfig.soundEnabled}
                      onChange={(val) => setAlertConfig({ ...alertConfig, soundEnabled: val })}
                    />
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Healing Bowl Sound</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Select a sound to play when emotional tilt is detected. Calm sounds are relaxing, shock sounds are alerting.
                  </p>
                  <div className="space-y-2">
                    {HEALING_BOWL_SOUNDS.map((sound) => (
                      <div
                        key={sound.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${alertConfig.healingBowlSound === sound.id
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40'
                            : 'bg-[#0a0a00] border-zinc-800 hover:border-zinc-700'
                          }`}
                        onClick={() => setAlertConfig({ ...alertConfig, healingBowlSound: sound.id })}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{sound.name}</span>
                            <span
                              className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${sound.type === 'calm'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                }`}
                            >
                              {sound.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{sound.description}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            healingBowlPlayer.preview(sound.id);
                          }}
                          className="ml-3 p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 transition-colors"
                          title="Preview sound"
                        >
                          <Volume2 className="w-4 h-4 text-[#D4AF37]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'psych' && (
              <div key="psych" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                {psychLoading ? (
                  <div className="text-sm text-zinc-500">Loading Psych Assist profile…</div>
                ) : (
                  <>
                    <section>
                      <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Orientation Status</h3>
                      <div className="bg-[#050500] border border-[#D4AF37]/30 rounded-lg p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-white">
                            {psychProfile?.orientationComplete ? 'Complete' : 'Required'}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {psychProfile?.updatedAt
                              ? `Updated ${new Date(psychProfile.updatedAt).toLocaleString()}`
                              : 'Not yet configured'}
                          </p>
                        </div>
                        {!psychProfile?.orientationComplete && (
                          <span className="text-xs uppercase tracking-[0.2em] text-red-400">
                            Action Needed
                          </span>
                        )}
                      </div>
                    </section>

                    <section className="pt-6 border-t border-zinc-800">
                      <h3 className="text-sm font-semibold text-[#D4AF37] mb-4">Blind Spots & Goal</h3>
                      <div className="space-y-4">
                        {psychBlindSpots.map((spot, idx) => (
                          <div key={idx}>
                            <label className="text-xs text-gray-500 mb-1 block">
                              Blind Spot #{idx + 1}
                            </label>
                            <input
                              type="text"
                              value={spot}
                              onChange={(e) =>
                                setPsychBlindSpots((prev) =>
                                  prev.map((current, sIdx) => (sIdx === idx ? e.target.value : current))
                                )
                              }
                              className="w-full bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
                              placeholder={
                                idx === 0
                                  ? 'Example: Oversizing after a streak'
                                  : idx === 1
                                  ? 'Example: Fighting trend days'
                                  : 'Example: Skipping resets after tilt'
                              }
                            />
                          </div>
                        ))}

                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Primary Goal</label>
                          <textarea
                            value={psychGoal}
                            onChange={(e) => setPsychGoal(e.target.value)}
                            rows={3}
                            className="w-full bg-[#0a0a00] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30 resize-none"
                            placeholder="Define the outcome Price should reinforce during sessions."
                          />
                        </div>

                        {psychSaveMessage && (
                          <div
                            className={`text-sm px-3 py-2 rounded border ${
                              psychSaveMessage.includes('Failed')
                                ? 'text-red-400 border-red-500/30 bg-red-500/10'
                                : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            }`}
                          >
                            {psychSaveMessage}
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button variant="primary" onClick={handlePsychSave} disabled={psychSaving}>
                            {psychSaving ? 'Saving…' : 'Save Psych Profile'}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

            {activeTab === 'trading' && (
              <div key="trading" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-4">Risk Management</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Profit Target</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={riskSettings.dailyProfitTarget}
                          onChange={(e) => setRiskSettings({ ...riskSettings, dailyProfitTarget: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
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
                          className="flex-1 bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
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
                          className="flex-1 bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
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
                            className="w-full bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
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
                            className="w-full bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
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

              </div>
            )}

            {activeTab === 'general' && (
              <div key="general" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Trading Symbol</h3>
                  <div className="relative">
                    {(() => {
                      const symbolKey = selectedSymbol.symbol.replace('/', '');
                      const selected = availableSymbols.find(s => s.symbol === symbolKey) || availableSymbols[0];
                      return (
                        <>
                          <button
                            onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                            className="w-full bg-[#0a0a00] border border-zinc-800 rounded-lg px-4 py-3 text-left hover:border-[#D4AF37]/30 focus:outline-none focus:border-[#D4AF37]/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">{selected.symbol}</div>
                                <div className="text-xs text-gray-400">{selected.contractName}</div>
                                <div className="text-xs text-gray-500">{selected.description}</div>
                              </div>
                              <svg className="w-5 h-5 text-gray-400 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {showSymbolDropdown && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowSymbolDropdown(false)}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a0a00] border border-[#D4AF37]/30 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                                {availableSymbols.map(sym => {
                                  const isSelected = sym.symbol === symbolKey;
                                  return (
                                    <button
                                      key={sym.symbol}
                                      onClick={() => {
                                        setSelectedSymbol({
                                          symbol: `/${sym.symbol}`,
                                          contractName: `/${sym.contractName.replace(' ', '')}`,
                                        });
                                        setShowSymbolDropdown(false);
                                      }}
                                      className={`w-full text-left px-4 py-3 hover:bg-[#D4AF37]/10 transition-colors border-b border-zinc-800 last:border-b-0 ${
                                        isSelected ? 'bg-[#D4AF37]/20' : ''
                                      }`}
                                    >
                                      <div className="text-sm font-bold text-white">{sym.symbol}</div>
                                      <div className="text-xs text-gray-400">{sym.contractName}</div>
                                      <div className="text-xs text-gray-500">{sym.description}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Billing</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Current Plan</h4>
                      <div className="bg-[#050500] border border-[#D4AF37]/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-lg font-bold text-[#D4AF37]">{tier.replace('_', ' ').toUpperCase()}</p>
                            <p className="text-xs text-gray-500">Active subscription</p>
                          </div>
                          <Button variant="secondary" className="text-xs">
                            Change Plan
                          </Button>
                        </div>
                        <div className="text-sm text-gray-400">
                          <p>Next billing date: <span className="text-white">Jan 4, 2026</span></p>
                          <p className="mt-1">Amount: <span className="text-white">$149.00</span></p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Payment Method</h4>
                      <div className="bg-[#050500] border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-white">•••• •••• •••• 4242</p>
                              <p className="text-xs text-gray-500">Expires 12/2027</p>
                            </div>
                          </div>
                          <Button variant="secondary" className="text-xs">
                            Update
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Billing History</h4>
                      <div className="bg-[#050500] border border-zinc-800 rounded-lg overflow-hidden">
                        {[
                          { date: 'Dec 4, 2025', amount: '$149.00', status: 'Paid' },
                          { date: 'Nov 4, 2025', amount: '$149.00', status: 'Paid' },
                          { date: 'Oct 4, 2025', amount: '$149.00', status: 'Paid' },
                        ].map((invoice, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 last:border-b-0 hover:bg-[#D4AF37]/5 transition-colors"
                          >
                            <div>
                              <p className="text-sm text-white">{invoice.date}</p>
                              <p className="text-xs text-gray-500">{invoice.status}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold text-white">{invoice.amount}</p>
                              <button className="text-xs text-[#D4AF37] hover:underline">
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-red-500 mb-3">Danger Zone</h4>
                      <div className="bg-[#050500] border border-red-500/30 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">
                          Cancel your subscription. You will retain access until the end of your billing period.
                        </p>
                        <Button variant="secondary" className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10">
                          Cancel Subscription
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'api' && (
              <div key="api" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-4">TopstepX Credentials</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Username</label>
                      <input
                        type="text"
                        value={apiKeys.topstepxUsername || ''}
                        onChange={(e) => setAPIKeys({ ...apiKeys, topstepxUsername: e.target.value })}
                        placeholder="Enter your TopstepX username"
                        className="w-full bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">API Key</label>
                      <input
                        type="password"
                        value={apiKeys.topstepxApiKey || ''}
                        onChange={(e) => setAPIKeys({ ...apiKeys, topstepxApiKey: e.target.value })}
                        placeholder="Enter your TopstepX API key"
                        className="w-full bg-[#0a0a00] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Sign up at <a href="https://topstepx.com" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">topstepx.com</a> and contact support for API access
                    </p>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'developer' && (
              <div key="developer" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Account Tier</h3>
                  <div className="flex gap-2">
                    {(['free', 'pulse', 'pulse_plus', 'pulse_pro'] as const).map(t => (
                      <Button
                        key={t}
                        variant={tier === t ? 'primary' : 'secondary'}
                        onClick={() => setTier(t)}
                        className="text-xs"
                      >
                        {t.replace('_', ' ').toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Developer Settings</h3>
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
                      onChange={(val) => setDeveloperSettings({ ...developerSettings, showTestTradeButton: val })}
                    />
                    <p className="text-xs text-gray-500">
                      Display test trade button for firing mock market orders to TopstepX
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-[#0a0a00] border-t border-[#D4AF37]/20 p-4">
            {saveMessage && (
              <div className={`mb-3 px-4 py-2 rounded text-sm ${saveMessage.includes('success')
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                {saveMessage}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={onClose} className="px-4 py-2" disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} className="px-4 py-2" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

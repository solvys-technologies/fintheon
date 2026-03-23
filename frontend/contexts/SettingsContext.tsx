// [claude-code 2026-03-10] Added backend settings sync (source of truth when authenticated)
import { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import type { HealingBowlSound } from '../utils/healingBowlSounds';

export interface APIKeys {
  openai?: string;
  tradingAPI?: string;
  newsAPI?: string;
  topstepxUsername?: string;
  topstepxApiKey?: string;
}

interface TradingModelToggles {
  momentumModel: boolean;
  meanReversionModel: boolean;
  fortyFortyClub: boolean;
  chargedUpRippers: boolean;
  morningFlush: boolean;
  lunchPowerHourFlush: boolean;
  vixFixer: boolean;
}

interface AlertConfig {
  priceAlerts: boolean;
  psychAlerts: boolean;
  newsAlerts: boolean;
  soundEnabled: boolean;
  healingBowlSound: HealingBowlSound;
  nametagEmoPulse: boolean;
  /** VIX level threshold for spike toast (default: 22) */
  vixSpikeThreshold: number;
}

interface RiskSettings {
  dailyProfitTarget: number;
  dailyLossLimit: number;
  maxTrades?: number;
  overTradingDuration?: number;
}

interface TradingSymbol {
  symbol: string;
  contractName: string;
}

interface DeveloperSettings {
  showTestTradeButton: boolean;
  showMockProposal: boolean;
  showPlaceholderBriefings: boolean;
  mirofishSimulations: boolean;
  agentAutoProposals: boolean;
}

type AutoPilotMode = 'off' | 'semi' | 'autonomous';

interface AutoPilotSettings {
  mode: AutoPilotMode;
  requireConfirmation: boolean;
  maxDailyProposals: number;
}

export interface IframeUrls {
  boardroom: string;
  research: string;
}

export type PrimaryBroker = 'rithmic' | 'projectx' | 'mmt';

interface SettingsContextType {
  apiKeys: APIKeys;
  setAPIKeys: (keys: APIKeys | ((prev: APIKeys) => APIKeys)) => void;
  tradingModels: TradingModelToggles;
  setTradingModels: (models: TradingModelToggles) => void;
  alertConfig: AlertConfig;
  setAlertConfig: (config: AlertConfig) => void;
  mockDataEnabled: boolean;
  setMockDataEnabled: (enabled: boolean) => void;
  selectedSymbol: TradingSymbol;
  setSelectedSymbol: (symbol: TradingSymbol) => void;
  riskSettings: RiskSettings;
  setRiskSettings: (settings: RiskSettings) => void;
  developerSettings: DeveloperSettings;
  setDeveloperSettings: (settings: DeveloperSettings) => void;
  autoPilotSettings: AutoPilotSettings;
  setAutoPilotSettings: (settings: AutoPilotSettings) => void;
  primaryBroker: PrimaryBroker;
  setPrimaryBroker: (broker: PrimaryBroker) => void;
  iframeUrls: IframeUrls;
  setIframeUrls: (urls: IframeUrls) => void;
  gatewayPort: number;
  setGatewayPort: (port: number) => void;
  traderName: string;
  setTraderName: (name: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  interviewCompleted: boolean;
  setInterviewCompleted: (done: boolean) => void;
  tradingGoals: string;
  setTradingGoals: (goals: string) => void;
  instrumentsTraded: string[];
  setInstrumentsTraded: (instruments: string[]) => void;
  discordUsername: string;
  setDiscordUsername: (username: string) => void;
  tradingRoadblocks: string[];
  setTradingRoadblocks: (roadblocks: string[]) => void;
  /** 8g: Auto-start all PsychAssist features EXCEPT mic-based ER monitoring */
  psychAssistAutoStart: boolean;
  setPsychAssistAutoStart: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'fintheon:settings';
const BACKEND_SETTINGS_URL = '/api/settings';

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed[key] !== undefined ? parsed[key] : defaultValue;
    }
  } catch { }
  return defaultValue;
}

async function fetchBackendSettings(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(BACKEND_SETTINGS_URL, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.settings ?? null;
  } catch {
    return null;
  }
}

async function saveBackendSettings(settings: Record<string, unknown>): Promise<void> {
  try {
    await fetch(BACKEND_SETTINGS_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
  } catch {
    // Silently fail — localStorage is the fallback
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setAPIKeys] = useState<APIKeys>(() =>
    loadFromStorage('apiKeys', {})
  );
  const [tradingModels, setTradingModels] = useState<TradingModelToggles>(() =>
    loadFromStorage('tradingModels', {
      momentumModel: true,
      meanReversionModel: false,
      fortyFortyClub: true,
      chargedUpRippers: true,
      morningFlush: true,
      lunchPowerHourFlush: true,
      vixFixer: true,
    })
  );
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(() =>
    loadFromStorage('alertConfig', {
      priceAlerts: true,
      psychAlerts: true,
      newsAlerts: false,
      soundEnabled: true,
      healingBowlSound: 'calm-1' as HealingBowlSound,
      nametagEmoPulse: true,
      vixSpikeThreshold: 22,
    })
  );
  const [mockDataEnabled, setMockDataEnabled] = useState(() =>
    loadFromStorage('mockDataEnabled', false)
  );
  const [selectedSymbol, setSelectedSymbol] = useState<TradingSymbol>(() =>
    loadFromStorage('selectedSymbol', {
      symbol: '/MNQ',
      contractName: '/MNQZ25',
    })
  );
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(() =>
    loadFromStorage('riskSettings', {
      dailyProfitTarget: 1500,
      dailyLossLimit: 750,
      maxTrades: 5,
      overTradingDuration: 15,
    })
  );
  const [developerSettings, setDeveloperSettings] = useState<DeveloperSettings>(() =>
    loadFromStorage('developerSettings', {
      showTestTradeButton: false,
      showMockProposal: false,
      showPlaceholderBriefings: false,
      mirofishSimulations: false,
      agentAutoProposals: false,
    })
  );
  const [autoPilotSettings, setAutoPilotSettings] = useState<AutoPilotSettings>(() =>
    loadFromStorage('autoPilotSettings', {
      mode: 'off' as AutoPilotMode,
      requireConfirmation: true,
      maxDailyProposals: 5,
    })
  );
  const [primaryBroker, setPrimaryBroker] = useState<PrimaryBroker>(() =>
    loadFromStorage('primaryBroker', 'rithmic' as PrimaryBroker)
  );
  const [iframeUrls, setIframeUrls] = useState<IframeUrls>(() =>
    loadFromStorage('iframeUrls', {
      boardroom: '',
      research: '',
    })
  );
  const [gatewayPort, setGatewayPort] = useState<number>(() =>
    loadFromStorage('gatewayPort', 8080)
  );
  const [traderName, setTraderName] = useState<string>(() =>
    loadFromStorage('traderName', '')
  );
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() =>
    loadFromStorage('autoRefresh', true)
  );
  const [interviewCompleted, setInterviewCompleted] = useState<boolean>(() =>
    loadFromStorage('interviewCompleted', false)
  );
  const [tradingGoals, setTradingGoals] = useState<string>(() =>
    loadFromStorage('tradingGoals', '')
  );
  const [instrumentsTraded, setInstrumentsTraded] = useState<string[]>(() =>
    loadFromStorage('instrumentsTraded', [])
  );
  const [discordUsername, setDiscordUsername] = useState<string>(() =>
    loadFromStorage('discordUsername', '')
  );
  const [tradingRoadblocks, setTradingRoadblocks] = useState<string[]>(() =>
    loadFromStorage('tradingRoadblocks', [])
  );
  const [psychAssistAutoStart, setPsychAssistAutoStart] = useState<boolean>(() =>
    loadFromStorage('psychAssistAutoStart', true)
  );

  // Track whether initial backend fetch has completed to avoid saving back stale data
  const backendSynced = useRef(false);

  // On mount: fetch from backend, merge with localStorage (backend is source of truth)
  useEffect(() => {
    fetchBackendSettings().then((remote) => {
      if (remote && typeof remote === 'object') {
        if (remote.apiKeys) setAPIKeys(prev => ({ ...prev, ...(remote.apiKeys as APIKeys) }));
        if (remote.tradingModels) setTradingModels(prev => ({ ...prev, ...(remote.tradingModels as TradingModelToggles) }));
        if (remote.alertConfig) setAlertConfig(prev => ({ ...prev, ...(remote.alertConfig as AlertConfig) }));
        if (remote.mockDataEnabled !== undefined) setMockDataEnabled(remote.mockDataEnabled as boolean);
        if (remote.selectedSymbol) setSelectedSymbol(prev => ({ ...prev, ...(remote.selectedSymbol as TradingSymbol) }));
        if (remote.riskSettings) setRiskSettings(prev => ({ ...prev, ...(remote.riskSettings as RiskSettings) }));
        if (remote.developerSettings) setDeveloperSettings(prev => ({ ...prev, ...(remote.developerSettings as DeveloperSettings) }));
        if (remote.autoPilotSettings) setAutoPilotSettings(prev => ({ ...prev, ...(remote.autoPilotSettings as AutoPilotSettings) }));
        if (remote.primaryBroker) setPrimaryBroker(remote.primaryBroker as PrimaryBroker);
        if (remote.iframeUrls) setIframeUrls(prev => ({ ...prev, ...(remote.iframeUrls as IframeUrls) }));
        if (remote.gatewayPort) setGatewayPort(remote.gatewayPort as number);
        if (remote.traderName) setTraderName(remote.traderName as string);
        if (remote.autoRefresh !== undefined) setAutoRefresh(remote.autoRefresh as boolean);
        if (remote.interviewCompleted !== undefined) setInterviewCompleted(remote.interviewCompleted as boolean);
        if (remote.tradingGoals) setTradingGoals(remote.tradingGoals as string);
        if (remote.instrumentsTraded) setInstrumentsTraded(remote.instrumentsTraded as string[]);
        if (remote.discordUsername) setDiscordUsername(remote.discordUsername as string);
        if (remote.tradingRoadblocks) setTradingRoadblocks(remote.tradingRoadblocks as string[]);
      }
      backendSynced.current = true;
    });
  }, []);

  // On save: write to both localStorage + backend
  useEffect(() => {
    const settings = {
      apiKeys,
      tradingModels,
      alertConfig,
      mockDataEnabled,
      selectedSymbol,
      riskSettings,
      developerSettings,
      autoPilotSettings,
      primaryBroker,
      iframeUrls,
      gatewayPort,
      traderName,
      autoRefresh,
      interviewCompleted,
      tradingGoals,
      instrumentsTraded,
      discordUsername,
      tradingRoadblocks,
      psychAssistAutoStart,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to persist settings:', error);
    }
    // Only sync to backend after initial fetch completes
    if (backendSynced.current) {
      saveBackendSettings(settings);
    }
  }, [apiKeys, tradingModels, alertConfig, mockDataEnabled, selectedSymbol, riskSettings, developerSettings, autoPilotSettings, primaryBroker, iframeUrls, gatewayPort, traderName, autoRefresh, interviewCompleted, tradingGoals, instrumentsTraded, discordUsername, tradingRoadblocks]);

  return (
    <SettingsContext.Provider
      value={{
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
        autoPilotSettings,
        setAutoPilotSettings,
        primaryBroker,
        setPrimaryBroker,
        iframeUrls,
        setIframeUrls,
        gatewayPort,
        setGatewayPort,
        traderName,
        setTraderName,
        autoRefresh,
        setAutoRefresh,
        interviewCompleted,
        setInterviewCompleted,
        tradingGoals,
        setTradingGoals,
        instrumentsTraded,
        setInstrumentsTraded,
        discordUsername,
        setDiscordUsername,
        tradingRoadblocks,
        setTradingRoadblocks,
        psychAssistAutoStart,
        setPsychAssistAutoStart,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

import React, { useState, useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TopHeader } from './TopHeader';
import { NavSidebar } from './NavSidebar';
import { MissionControlPanel } from '../mission-control/MissionControlPanel';
import { FeedSection } from '../feed/FeedSection';
import { MinimalFeedSection } from '../feed/MinimalFeedSection';
import { MinimalTapeWidget } from '../feed/MinimalTapeWidget';
import { NewsSection } from '../feed/NewsSection';
import { AnalysisSection } from '../analysis/AnalysisSection';
import { TopStepXBrowser } from '../TopStepXBrowser';
import { FloatingWidget } from './FloatingWidget';
import { PanelPosition } from './DraggablePanel';
import { useBackend } from '../../lib/backend';
import { useSettings } from '../../contexts/SettingsContext';
import { EmotionalResonanceMonitor } from '../mission-control/EmotionalResonanceMonitor';
import { BlindspotsWidget } from '../mission-control/BlindspotsWidget';
import { AccountTrackerWidget } from '../mission-control/AccountTrackerWidget';
import { AlgoStatusWidget } from '../mission-control/AlgoStatusWidget';
import { PanelNotificationWidget } from './PanelNotificationWidget';
import { MinimalERMeter } from '../MinimalERMeter';
import { ModelDashboard } from '../models/ModelDashboard';

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

type NavTab = 'feed' | 'analysis' | 'news' | 'models';
type LayoutOption = 'movable' | 'tickers-only' | 'combined';

interface MainLayoutProps {
  onSettingsClick: () => void;
}

// Inner component that doesn't use Clerk hooks directly
function MainLayoutInner({ onSettingsClick, signOut }: MainLayoutProps & { signOut?: () => Promise<void> }) {
  const { selectedSymbol } = useSettings();
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [missionControlCollapsed, setMissionControlCollapsed] = useState(false);
  const [tapeCollapsed, setTapeCollapsed] = useState(false);
  const [combinedPanelCollapsed, setCombinedPanelCollapsed] = useState(false);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [prevTab, setPrevTab] = useState<NavTab | null>(null);
  const [topStepXEnabled, setTopStepXEnabled] = useState(false);
  const [layoutOption, setLayoutOption] = useState<LayoutOption>('movable');
  const [prevLayoutOption, setPrevLayoutOption] = useState<LayoutOption | null>(null);
  const [lastMovableLayout, setLastMovableLayout] = useState<LayoutOption | null>(null);
  const [missionControlPosition, setMissionControlPosition] = useState<PanelPosition>('left');
  const [tapePosition, setTapePosition] = useState<PanelPosition>('right');
  const [vix, setVix] = useState(20);
  const [ivScore, setIvScore] = useState(3.2);
  const [showMissionControlNotification, setShowMissionControlNotification] = useState(false);
  const [showTapeNotification, setShowTapeNotification] = useState(false);
  const [combinedPanelErScore, setCombinedPanelErScore] = useState(0);
  const [combinedPanelPnl, setCombinedPanelPnl] = useState(0);
  const [combinedPanelAlgoEnabled, setCombinedPanelAlgoEnabled] = useState(false);
  
  const backend = useBackend();

  // Reset layout when TopStepX is toggled
  useEffect(() => {
    if (topStepXEnabled) {
      // When TopStepX is enabled, set default positions
      setMissionControlPosition('left');
      setTapePosition('right');
      setLayoutOption('movable');
    } else {
      // When TopStepX is disabled, reset to static layout
      setMissionControlPosition('right');
      setTapePosition('right');
      setMissionControlCollapsed(false);
      setTapeCollapsed(false);
    }
  }, [topStepXEnabled]);

  // Restore panels to default when switching back to a movable panels layout
  useEffect(() => {
    const isMovableLayout = layoutOption === 'movable' || layoutOption === 'combined';
    
    // Track the last movable layout we were on
    if (isMovableLayout) {
      // If we're switching back to the same movable layout we were on before
      if (lastMovableLayout === layoutOption && prevLayoutOption !== layoutOption) {
        // Restore default settings for the layout
        if (layoutOption === 'movable') {
          setMissionControlPosition('left');
          setTapePosition('right');
          setMissionControlCollapsed(false);
          setTapeCollapsed(false);
        } else if (layoutOption === 'combined') {
          setCombinedPanelCollapsed(false);
        }
      }
      // Update the last movable layout we were on
      setLastMovableLayout(layoutOption);
    } else {
      // When switching away from a movable layout, remember which one we were on
      // (lastMovableLayout stays the same)
    }
    
    // Update previous layout option
    setPrevLayoutOption(layoutOption);
  }, [layoutOption, prevLayoutOption, lastMovableLayout]);

  // Fetch IV Aggregate (includes VIX and computed IV score) - update every 30 seconds
  useEffect(() => {
    const fetchIVAggregate = async () => {
      try {
        const data = await backend.riskflow.getIVAggregate({
          instrument: selectedSymbol?.symbol || '/ES',
        });
        
        if (data && typeof data.score === 'number') {
          setIvScore(data.score);
          
          // Also update VIX from the response
          if (data.vix?.level) {
            setVix(data.vix.level);
          }
        }
      } catch (error) {
        console.error('[IV] Failed to fetch IV aggregate:', error);
        // Keep current values on error
      }
    };

    fetchIVAggregate();
    const interval = setInterval(fetchIVAggregate, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [backend]);

  // Fetch account data for combined panel collapsed state
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setCombinedPanelPnl(account.dailyPnl);
        setCombinedPanelAlgoEnabled(account.algoEnabled);
      } catch (err) {
        console.error('Failed to fetch account:', err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend]);

  // Listen for ER score updates for combined panel
  useEffect(() => {
    const handleERUpdate = (event: CustomEvent<number>) => {
      setCombinedPanelErScore(event.detail);
    };
    window.addEventListener('erScoreUpdate', handleERUpdate as EventListener);
    return () => {
      window.removeEventListener('erScoreUpdate', handleERUpdate as EventListener);
    };
  }, []);

  // Normalize ER score from -10 to 10 range to 0-1 range for display
  const normalizedCombinedPanelResonance = Math.max(0, Math.min(1, (combinedPanelErScore + 10) / 20));

  const handleTabChange = (tab: NavTab) => {
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

  const handleLogout = async () => {
    if (!signOut) {
      console.warn('Logout not available in dev mode');
      return;
    }
    try {
      await signOut();
      // Clerk will automatically redirect to sign-in page
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Determine layout based on TopStepX state and layout option
  const showMissionControl = topStepXEnabled && missionControlPosition !== 'floating';
  const showTape = topStepXEnabled && tapePosition !== 'floating';
  const showFloatingWidget = topStepXEnabled && (
    layoutOption === 'tickers-only' || 
    (layoutOption === 'movable' && missionControlPosition === 'floating' && tapePosition === 'floating')
  );
  const showCombinedPanel = topStepXEnabled && layoutOption === 'combined';

  // Determine panel order based on position and layout option
  const leftPanels: React.ReactNode[] = [];
  const rightPanels: React.ReactNode[] = [];

  // When TopStepX is enabled, render panels based on layout option
  if (topStepXEnabled) {
    if (layoutOption === 'combined') {
      // Combined panel: both Mission Control and Tape stacked on the right
      rightPanels.push(
        <div key="combined" className={`bg-[#0a0a00] border-l border-[#D4AF37]/20 transition-lush ${combinedPanelCollapsed ? 'w-16' : 'w-80'}`}>
          <div className="h-full flex flex-col">
            <div className="h-12 flex items-center justify-between px-3 border-b border-[#D4AF37]/20">
              {!combinedPanelCollapsed && (
                <h2 className="text-sm font-semibold text-[#D4AF37]">Panels</h2>
              )}
              <button
                onClick={() => setCombinedPanelCollapsed(!combinedPanelCollapsed)}
                className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors ml-auto"
              >
                {combinedPanelCollapsed ? (
                  <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
                )}
              </button>
            </div>
            {!combinedPanelCollapsed && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="h-1/2 overflow-hidden border-b border-[#D4AF37]/20 flex flex-col">
                  <div className="h-12 flex items-center justify-between px-3 border-b border-[#D4AF37]/20">
                    <h3 className="text-xs font-semibold text-[#D4AF37]">Mission Control</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-2 space-y-2">
                      <EmotionalResonanceMonitor onERScoreChange={setCombinedPanelErScore} />
                      <BlindspotsWidget />
                      <AccountTrackerWidget />
                      <AlgoStatusWidget />
                    </div>
                  </div>
                </div>
                <div className="h-1/2 overflow-hidden flex flex-col">
                  <div className="h-12 flex items-center justify-between px-3 border-b border-[#D4AF37]/20">
                    <h3 className="text-xs font-semibold text-[#D4AF37]">The Tape</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-2">
                      <MinimalFeedSection 
                        collapsed={false}
                        position="right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {combinedPanelCollapsed && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-2 bg-[#0a0a00]">
                {/* Minimalist ER Meter */}
                <div className="w-full max-w-[120px]">
                  <MinimalERMeter 
                    resonance={normalizedCombinedPanelResonance} 
                    pnl={combinedPanelPnl} 
                    algoEnabled={combinedPanelAlgoEnabled} 
                  />
                </div>
                {/* Minimalist Tape Widget */}
                <div className="w-full max-w-[120px]">
                  <MinimalTapeWidget />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (layoutOption === 'movable') {
      // Movable panels: Mission Control and Tape can be positioned independently
      if (missionControlPosition === 'left' && showMissionControl) {
        leftPanels.push(
          <MissionControlPanel
            key="mission-control"
            collapsed={missionControlCollapsed}
            onToggleCollapse={() => setMissionControlCollapsed(!missionControlCollapsed)}
            topStepXEnabled={topStepXEnabled}
            position={missionControlPosition}
            onPositionChange={setMissionControlPosition}
            onHide={() => {
              setMissionControlPosition('floating');
              setShowMissionControlNotification(true);
            }}
          />
        );
      } else if (missionControlPosition === 'right' && showMissionControl) {
        rightPanels.push(
          <MissionControlPanel
            key="mission-control"
            collapsed={missionControlCollapsed}
            onToggleCollapse={() => setMissionControlCollapsed(!missionControlCollapsed)}
            topStepXEnabled={topStepXEnabled}
            position={missionControlPosition}
            onPositionChange={setMissionControlPosition}
            onHide={() => {
              setMissionControlPosition('floating');
              setShowMissionControlNotification(true);
            }}
          />
        );
      }

      if (tapePosition === 'left' && showTape) {
        leftPanels.push(
          <div key="tape" className={`bg-[#0a0a00] border-r border-[#D4AF37]/20 transition-lush ${tapeCollapsed ? 'w-16' : 'w-80'}`}>
            <MinimalFeedSection 
              collapsed={tapeCollapsed}
              onToggleCollapse={() => setTapeCollapsed(!tapeCollapsed)}
              position={tapePosition}
              onPositionChange={setTapePosition}
              onHide={() => {
                setTapePosition('floating');
                setShowTapeNotification(true);
              }}
            />
          </div>
        );
      } else if (tapePosition === 'right' && showTape) {
        rightPanels.push(
          <div key="tape" className={`bg-[#0a0a00] border-l border-[#D4AF37]/20 transition-lush ${tapeCollapsed ? 'w-16' : 'w-80'}`}>
            <MinimalFeedSection 
              collapsed={tapeCollapsed}
              onToggleCollapse={() => setTapeCollapsed(!tapeCollapsed)}
              position={tapePosition}
              onPositionChange={setTapePosition}
              onHide={() => {
                setTapePosition('floating');
                setShowTapeNotification(true);
              }}
            />
          </div>
        );
      }
    }
    // For 'tickers-only', no panels are shown (only floating widget)
  } else {
    // When TopStepX is disabled, show static layout with Mission Control on right
    rightPanels.push(
      <MissionControlPanel
        key="mission-control"
        collapsed={missionControlCollapsed}
        onToggleCollapse={() => setMissionControlCollapsed(!missionControlCollapsed)}
        topStepXEnabled={false}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050500] text-white">
      <TopHeader 
        topStepXEnabled={topStepXEnabled}
        onTopStepXToggle={() => setTopStepXEnabled(!topStepXEnabled)}
        layoutOption={layoutOption}
        onLayoutOptionChange={setLayoutOption}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <NavSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSettingsClick={onSettingsClick}
          onLogout={handleLogout}
          topStepXEnabled={topStepXEnabled}
        />

        {/* Left Panels */}
        {leftPanels.length > 0 && (
          <div className="flex">
            {leftPanels}
          </div>
        )}

        {/* Center Content - TopStepX or Main Content */}
        <div className="flex-1 overflow-hidden relative min-w-0 flex flex-col">
          {topStepXEnabled ? (
            <div className="h-full w-full flex-1 p-4 min-h-0">
              <TopStepXBrowser onClose={() => setTopStepXEnabled(false)} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto relative flex-1">
              {activeTab === 'feed' && (
                <div key="feed" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <FeedSection />
                </div>
              )}
              {activeTab === 'analysis' && (
                <div key="analysis" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <AnalysisSection />
                </div>
              )}
              {activeTab === 'news' && (
                <div key="news" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <NewsSection />
                </div>
              )}
              {activeTab === 'models' && (
                <div key="models" className={`h-full w-full ${tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}`}>
                  <ModelDashboard />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panels */}
        {rightPanels.length > 0 && (
          <div className="flex">
            {rightPanels}
          </div>
        )}

        {/* Floating Widget */}
        {showFloatingWidget && (
          <FloatingWidget 
            vix={vix} 
            ivScore={ivScore}
            layoutOption={layoutOption}
            onClose={() => {
              if (layoutOption === 'movable') {
                setMissionControlPosition('right');
                setTapePosition('right');
              }
            }}
          />
        )}

        {/* Panel Notification Widgets */}
        {showMissionControlNotification && (
          <PanelNotificationWidget
            panelName="Mission Control"
            onRestore={() => {
              setMissionControlPosition('right');
              setShowMissionControlNotification(false);
            }}
            onDismiss={() => setShowMissionControlNotification(false)}
          />
        )}
        {showTapeNotification && (
          <PanelNotificationWidget
            panelName="The Tape"
            onRestore={() => {
              setTapePosition('right');
              setShowTapeNotification(false);
            }}
            onDismiss={() => setShowTapeNotification(false)}
          />
        )}
      </div>
    </div>
  );
}

// Wrapper component that uses Clerk (only rendered when ClerkProvider is available)
function MainLayoutWithClerk({ onSettingsClick }: MainLayoutProps) {
  const clerk = useClerk();
  return <MainLayoutInner onSettingsClick={onSettingsClick} signOut={clerk.signOut} />;
}

// Wrapper component for dev mode without Clerk
function MainLayoutWithoutClerk({ onSettingsClick }: MainLayoutProps) {
  return <MainLayoutInner onSettingsClick={onSettingsClick} signOut={undefined} />;
}

// Main export that chooses the right implementation
export function MainLayout({ onSettingsClick }: MainLayoutProps) {
  if (BYPASS_AUTH) {
    return <MainLayoutWithoutClerk onSettingsClick={onSettingsClick} />;
  }
  return <MainLayoutWithClerk onSettingsClick={onSettingsClick} />;
}

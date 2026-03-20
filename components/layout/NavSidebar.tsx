import { useState, useEffect } from 'react';
import { Activity, Newspaper, Settings, LogOut, Sparkles, Crosshair } from 'lucide-react';

type NavTab = 'feed' | 'analysis' | 'news' | 'models';

interface NavSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  topStepXEnabled?: boolean;
}

export function NavSidebar({ activeTab, onTabChange, onSettingsClick, onLogout, topStepXEnabled = false }: NavSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const navItems = [
    { id: 'feed' as NavTab, icon: Activity, label: 'Feed' },
    { id: 'analysis' as NavTab, icon: Sparkles, label: 'Analysis' },
    { id: 'news' as NavTab, icon: Newspaper, label: 'Market News & Events' },
    { id: 'models' as NavTab, icon: Crosshair, label: 'Trading Models' },
  ];

  // Auto-hide after tab selection
  const handleTabChange = (tab: NavTab) => {
    onTabChange(tab);
    // Hide after a short delay
    setTimeout(() => {
      setIsHovered(false);
      setIsVisible(false);
    }, 500);
  };

  // Show on hover
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Delay hiding to allow moving to sidebar
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  // When TopStepX is enabled, sidebar should be hover-only
  if (topStepXEnabled) {
    return (
      <div
        className={`fixed left-0 top-[70px] bottom-0 z-50 transition-all duration-300 ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-16 bg-[#0a0a00] border-r border-[#D4AF37]/20 flex flex-col items-center py-4 h-full">
          <div className="flex-1 space-y-4">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-lush ${
                  activeTab === id
                    ? 'bg-[#D4AF37] text-black'
                    : 'text-[#D4AF37]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10'
                }`}
                title={label}
              >
                <Icon className="w-6 h-6" />
              </button>
            ))}
          </div>
          
          <div className="space-y-4">
            <button
              onClick={onSettingsClick}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-[#D4AF37]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-lush"
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button
              onClick={onLogout}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-lush"
              title="Logout"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
        {/* Hover trigger area on left edge */}
        {!isVisible && (
          <div className="absolute left-0 top-0 bottom-0 w-4" />
        )}
      </div>
    );
  }

  // Normal sidebar when TopStepX is disabled
  return (
    <div className="w-16 bg-[#0a0a00] border-r border-[#D4AF37]/20 flex flex-col items-center py-4">
      <div className="flex-1 space-y-4">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-lush ${
              activeTab === id
                ? 'bg-[#D4AF37] text-black'
                : 'text-[#D4AF37]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10'
            }`}
            title={label}
          >
            <Icon className="w-6 h-6" />
          </button>
        ))}
      </div>
      
      <div className="space-y-4">
        <button
          onClick={onSettingsClick}
          className="w-12 h-12 flex items-center justify-center rounded-lg text-[#D4AF37]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-lush"
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
        <button
          onClick={onLogout}
          className="w-12 h-12 flex items-center justify-center rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-lush"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

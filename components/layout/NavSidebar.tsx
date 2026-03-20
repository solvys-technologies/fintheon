// [claude-code 2026-03-20] Shell rebuild: stripped to 2 tabs (models + consilium), removed TopStepX hover logic
import { Settings, LogOut, Crosshair, Users } from 'lucide-react';

type NavTab = 'models' | 'consilium';

interface NavSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSettingsClick: () => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'models' as NavTab, icon: Crosshair, label: 'Trading Models' },
  { id: 'consilium' as NavTab, icon: Users, label: 'Consilium' },
];

export function NavSidebar({ activeTab, onTabChange, onSettingsClick, onLogout }: NavSidebarProps) {
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

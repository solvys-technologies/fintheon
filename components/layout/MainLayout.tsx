// [claude-code 2026-03-20] Shell rebuild: clean layout with useSafeClerk for logout in all modes
import { useState } from 'react';
import { useSafeClerk } from '../../lib/clerk-hooks';
import { TopHeader } from './TopHeader';
import { NavSidebar } from './NavSidebar';
import { ModelDashboard } from '../models/ModelDashboard';
import { AgentChattr } from '../consilium/AgentChattr';

type NavTab = 'models' | 'consilium';

interface MainLayoutProps {
  onSettingsClick: () => void;
}

export function MainLayout({ onSettingsClick }: MainLayoutProps) {
  const { signOut } = useSafeClerk();
  const [activeTab, setActiveTab] = useState<NavTab>('consilium');

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#050500] text-white">
      <TopHeader />

      <div className="flex-1 flex overflow-hidden">
        <NavSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSettingsClick={onSettingsClick}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-hidden">
          {activeTab === 'models' && <ModelDashboard />}
          {activeTab === 'consilium' && <AgentChattr />}
        </div>
      </div>
    </div>
  );
}

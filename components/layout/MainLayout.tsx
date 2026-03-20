// [claude-code 2026-03-20] Shell rebuild: stripped 481-line spaghetti to clean ~60-line layout (consilium + models only)
import { useState } from 'react';
import { useSafeClerk as useClerk } from '../../lib/clerk-hooks';
import { TopHeader } from './TopHeader';
import { NavSidebar } from './NavSidebar';
import { ModelDashboard } from '../models/ModelDashboard';
import { AgentChattr } from '../consilium/AgentChattr';

const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_ELECTRON = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost');
const BYPASS_AUTH = IS_ELECTRON || (DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true');

type NavTab = 'models' | 'consilium';

interface MainLayoutProps {
  onSettingsClick: () => void;
}

function MainLayoutInner({ onSettingsClick, signOut }: MainLayoutProps & { signOut?: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<NavTab>('consilium');

  const handleLogout = async () => {
    if (!signOut) return;
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

function MainLayoutWithClerk({ onSettingsClick }: MainLayoutProps) {
  const clerk = useClerk();
  return <MainLayoutInner onSettingsClick={onSettingsClick} signOut={clerk.signOut} />;
}

function MainLayoutWithoutClerk({ onSettingsClick }: MainLayoutProps) {
  return <MainLayoutInner onSettingsClick={onSettingsClick} />;
}

export function MainLayout({ onSettingsClick }: MainLayoutProps) {
  if (BYPASS_AUTH) {
    return <MainLayoutWithoutClerk onSettingsClick={onSettingsClick} />;
  }
  return <MainLayoutWithClerk onSettingsClick={onSettingsClick} />;
}

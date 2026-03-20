import { LayoutDashboard, Trash2 } from "lucide-react";
import { useState } from "react";
import SystemFeed from "./SystemFeed";
import ChatInterface from "./ChatInterface";
import NewsFeed from "./NewsFeed";

interface MainContentProps {
  activeTab: "feed" | "chat" | "news";
  onOpenMissionControl: () => void;
  missionControlOpen: boolean;
}

export default function MainContent({ activeTab, onOpenMissionControl, missionControlOpen }: MainContentProps) {
  const [feedKey, setFeedKey] = useState(0);
  const [newsKey, setNewsKey] = useState(0);

  const handleClearFeed = () => {
    if (activeTab === "feed") {
      setFeedKey(prev => prev + 1);
    } else if (activeTab === "news") {
      setNewsKey(prev => prev + 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black">
      <div className="h-14 bg-[var(--fintheon-bg)] border-b border-zinc-900 flex items-center justify-between px-6">
        <h2 className="text-sm font-medium text-[var(--fintheon-accent)] tracking-wider uppercase">
          {activeTab === "feed" && "System Feed"}
          {activeTab === "chat" && "AI Analysis"}
          {activeTab === "news" && "Market News & Events"}
        </h2>
        
        <div className="flex items-center gap-3">
          {(activeTab === "feed" || activeTab === "news") && (
            <button
              onClick={handleClearFeed}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Feed</span>
            </button>
          )}
          
          {!missionControlOpen && (
            <button
              onClick={onOpenMissionControl}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--fintheon-accent)]/10 hover:bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] text-xs transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Mission Control</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {activeTab === "feed" && <SystemFeed key={feedKey} />}
        {activeTab === "chat" && <ChatInterface />}
        {activeTab === "news" && <NewsFeed key={newsKey} />}
      </div>
    </div>
  );
}

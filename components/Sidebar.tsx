import { Activity, Sparkles, Newspaper } from "lucide-react";

interface SidebarProps {
  activeTab: "feed" | "chat" | "news";
  onTabChange: (tab: "feed" | "chat" | "news") => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: "feed" as const, icon: Activity, label: "System Feed" },
    { id: "chat" as const, icon: Sparkles, label: "AI Analysis" },
    { id: "news" as const, icon: Newspaper, label: "Market News & Events" },
  ];
  
  return (
    <div className="w-16 bg-[#050500] border-r border-zinc-900 flex flex-col items-center py-4 gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              w-12 h-12 rounded-lg flex items-center justify-center transition-all
              ${isActive 
                ? "bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_12px_rgba(255,192,56,0.2)]" 
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30"
              }
            `}
            title={tab.label}
          >
            <Icon className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
}

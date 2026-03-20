import { Settings } from "lucide-react";
import { useState } from "react";
import SettingsModal from "./SettingsModal";

export default function Header() {
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <>
      <header className="h-14 bg-[#050500] border-b border-zinc-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00FF85] shadow-[0_0_8px_rgba(0,255,133,0.5)]" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Online</span>
        </div>
        
        <h1 className="text-2xl font-bold text-[#D4AF37] tracking-widest">PULSE</h1>
        
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded hover:bg-zinc-900/50 transition-colors"
        >
          <Settings className="w-5 h-5 text-[#D4AF37]" />
        </button>
      </header>
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

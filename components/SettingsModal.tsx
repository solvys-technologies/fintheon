import { X } from "lucide-react";
import { useState } from "react";
import { useBackend } from '../lib/backend';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const backend = useBackend();
  const [provider, setProvider] = useState<'projectx' | 'alpaca' | 'interactive_brokers'>('projectx');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 1300);
  };

  const handleSaveConnection = async () => {
    if (!apiKey || !apiSecret) {
      setMessage({ text: 'Please enter API Key and Secret', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      setMessage({ text: 'Broker connection management coming soon!', type: 'success' });
      
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 1300);
      
      setApiKey('');
      setApiSecret('');
    } catch (err) {
      console.error('Failed to save connection:', err);
      setMessage({ text: 'Failed to save API connection', type: 'error' });
    } finally {
      setSaving(false);
      setSyncing(false);
    }
  };
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}
        onClick={handleClose}
      />
      
      <div className={`relative w-full max-w-2xl bg-[#0a0a00] border border-[#D4AF37]/20 rounded-lg shadow-[0_0_24px_rgba(255,192,56,0.15)] mx-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-900">
          <h2 className="text-lg font-medium text-[#D4AF37] tracking-wider uppercase">Settings</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-zinc-900/50 transition-lush"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">ProjectX Connection</h3>
            <div className="bg-[#140a00] rounded-lg p-4 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-400 mb-2">Configure ProjectX Credentials</h4>
                <p className="text-xs text-zinc-400 mb-3">
                  This terminal trades exclusively on ProjectX (TopStepX) prop firm accounts. 
                  Configure your ProjectX credentials in Leap Settings (sidebar) to enable trading.
                </p>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div><span className="font-medium text-zinc-300">Required Secrets:</span></div>
                  <div className="ml-3">
                    • <code className="text-[#D4AF37]">ProjectXUsername</code> - Your TopStepX username
                  </div>
                  <div className="ml-3">
                    • <code className="text-[#D4AF37]">ProjectXApiKey</code> - Your TopStepX API key
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  Once configured, use the "Establish Uplink" button in Mission Control to connect your account.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">General</h3>
            <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">Theme</span>
                <span className="text-xs text-zinc-500">Dark (Default)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">Language</span>
                <span className="text-xs text-zinc-500">English</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Notifications</h3>
            <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">Trade Alerts</span>
                <span className="text-xs text-[#00FF85]">Enabled</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">Price Alerts</span>
                <span className="text-xs text-[#00FF85]">Enabled</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">System Updates</span>
                <span className="text-xs text-[#00FF85]">Enabled</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">About</h3>
            <div className="bg-[#140a00] rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-300">Version</span>
                <span className="text-xs text-zinc-500 font-mono">1.0.0</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-zinc-900 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm transition-lush"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

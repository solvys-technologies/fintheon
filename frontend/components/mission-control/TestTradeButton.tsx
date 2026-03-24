import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import { useSettings } from '../../contexts/SettingsContext';

interface TestTradeButtonProps {
  selectedAccount: string;
}

export function TestTradeButton({ selectedAccount }: TestTradeButtonProps) {
  const backend = useBackend();
  const { apiKeys } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFireTestTrade = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await backend.trading.fireTestTrade({
        accountId: selectedAccount,
        symbol: '/MNQ', // Hardcoded to micro-NASDAQ (MNQ)
        // quantity is calculated automatically based on $330 risk
        side: 'buy',
      });

      setMessage(`✓ ${result.message}`);
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to fire test trade:', err);
      const errorMessage = err?.message || err?.error || 'Failed to submit order';
      setMessage(`✗ ${errorMessage}`);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleFireTestTrade}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-gray-500 rounded-lg transition-all font-semibold text-sm text-white shadow-lg"
      >
        <Zap className="w-4 h-4" />
        {isLoading ? 'Firing...' : 'Fire Test Trade'}
      </button>
      {message && (
        <p className="text-xs text-center text-gray-400">{message}</p>
      )}
    </div>
  );
}

import { Cpu, Circle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useBackend } from '../../lib/backend';
import { useState, useEffect } from 'react';
import { LockedCard } from '../ui/LockedCard';

export function AlgoStatusWidget() {
  const { tier } = useAuth();
  const { tradingModels } = useSettings();
  const backend = useBackend();
  const [algoEnabled, setAlgoEnabled] = useState<boolean>(false);
  const isLocked = tier === 'free';

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setAlgoEnabled(account.algoEnabled);
      } catch (err) {
        console.error('Failed to fetch account:', err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend]);

  const handleToggleAlgo = async () => {
    try {
      const result = await backend.trading.toggleAlgo({ enabled: !algoEnabled });
      setAlgoEnabled(result.algoEnabled);
    } catch (err) {
      console.error('Failed to toggle algo:', err);
    }
  };

  // Map strategies to categories based on tradingModels
  const categories = [
    {
      name: 'Price Action Strategies',
      strategies: [
        { name: 'Morning Flush', key: 'morningFlush' },
        { name: 'Lunch Power Hour Flush', key: 'lunchPowerHourFlush' },
        { name: '40/40 Club', key: 'fortyFortyClub' },
        { name: 'Momentum Model', key: 'momentumModel' },
      ],
    },
    {
      name: 'Volatility Strategies',
      strategies: [
        { name: '22 VIX Fix', key: 'vixFixer' },
      ],
    },
    {
      name: 'Risk Event-Based Strategies',
      strategies: [
        { name: 'Charged Up Rippers', key: 'chargedUpRippers' },
      ],
    },
    {
      name: 'Mean Reversion',
      strategies: [
        { name: 'Mean Reversion Model', key: 'meanReversionModel' },
      ],
    },
  ];

  const content = (
    <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-[#D4AF37]">Trading Models</h3>
        </div>
        <button
          onClick={handleToggleAlgo}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            algoEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
          }`}
        >
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            algoEnabled ? 'translate-x-[18px]' : 'translate-x-0'
          }`} />
        </button>
      </div>
      <div className="space-y-3">
        {categories.map(category => {
          const enabledCount = category.strategies.filter(
            s => tradingModels[s.key as keyof typeof tradingModels]
          ).length;
          const hasEnabled = enabledCount > 0;
          
          return (
            <div key={category.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium">{category.name}</span>
                <div className="flex items-center gap-2">
                  <Circle
                    className={`w-2 h-2 fill-current ${
                      hasEnabled ? 'text-emerald-400' : 'text-gray-600'
                    }`}
                  />
                  <span className={hasEnabled ? 'text-emerald-400' : 'text-gray-500'}>
                    {hasEnabled ? 'Active' : 'Idle'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return <LockedCard locked={isLocked}>{content}</LockedCard>;
}

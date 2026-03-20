import { Lock, ArrowUp } from 'lucide-react';
import { Button } from './Button';

interface FeatureLockScreenProps {
  featureName: string;
  requiredTier: 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';
  currentTier?: 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro' | null;
  onUpgrade?: () => void;
}

const tierNames: Record<string, string> = {
  free: 'Free',
  pulse: 'Equestrian',
  pulse_plus: 'Equestrian+',
  pulse_pro: 'Consul',
};

const tierDescriptions: Record<string, string> = {
  free: 'Basic features for getting started',
  pulse: 'Essential trading tools and PsychAssist',
  pulse_plus: 'Advanced RiskFlow and autonomous trading',
  pulse_pro: 'Full access with custom AI agents and priority support',
};

export function FeatureLockScreen({
  featureName,
  requiredTier,
  currentTier,
  onUpgrade,
}: FeatureLockScreenProps) {
  const tierLevels: Record<string, number> = {
    free: 0,
    pulse: 1,
    pulse_plus: 2,
    pulse_pro: 3,
  };

  const currentLevel = currentTier ? tierLevels[currentTier] : -1;
  const requiredLevel = tierLevels[requiredTier];
  const needsUpgrade = currentLevel < requiredLevel;

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg">
      <div className="mb-6">
        <Lock className="w-16 h-16 text-[var(--fintheon-accent)]/50 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2 text-center">
          Feature Locked
        </h3>
        <p className="text-sm text-gray-400 text-center max-w-md">
          {featureName} requires <span className="text-[var(--fintheon-accent)] font-semibold">{tierNames[requiredTier]}</span> tier
        </p>
      </div>

      {currentTier && (
        <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Current Tier</p>
          <p className="text-sm font-semibold text-white">{tierNames[currentTier]}</p>
          <p className="text-xs text-gray-400 mt-1">{tierDescriptions[currentTier]}</p>
        </div>
      )}

      {!currentTier && (
        <div className="mb-6 p-4 bg-yellow-900/20 rounded-lg border border-yellow-800/50">
          <p className="text-sm text-yellow-400 text-center">
            Please select a billing tier to access features
          </p>
        </div>
      )}

      <div className="mb-6 p-4 bg-[var(--fintheon-accent)]/10 rounded-lg border border-[var(--fintheon-accent)]/30">
        <p className="text-xs text-gray-500 mb-2">Required Tier</p>
        <p className="text-sm font-semibold text-[var(--fintheon-accent)]">{tierNames[requiredTier]}</p>
        <p className="text-xs text-gray-400 mt-1">{tierDescriptions[requiredTier]}</p>
      </div>

      {onUpgrade && (
        <Button
          variant="primary"
          onClick={onUpgrade}
          className="flex items-center gap-2"
        >
          <ArrowUp className="w-4 h-4" />
          {currentTier ? 'Upgrade to ' + tierNames[requiredTier] : 'Select Billing Tier'}
        </Button>
      )}
    </div>
  );
}

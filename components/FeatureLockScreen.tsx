import { Lock } from 'lucide-react';
import { Button } from './ui/Button';

interface FeatureLockScreenProps {
  featureName: string;
  requiredTier: string;
  currentTier?: string;
  onUpgrade?: () => void;
}

const tierDisplayNames: Record<string, string> = {
  free: 'Free',
  pulse: 'Pulse',
  pulse_plus: 'Pulse+',
  pulse_pro: 'Pulse Pro',
};

export function FeatureLockScreen({
  featureName,
  requiredTier,
  currentTier,
  onUpgrade,
}: FeatureLockScreenProps) {
  const requiredTierName = tierDisplayNames[requiredTier] || requiredTier;
  const currentTierName = currentTier ? tierDisplayNames[currentTier] || currentTier : 'None';

  return (
    <div className="relative bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Lock className="w-12 h-12 text-[#D4AF37]/50" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Feature Locked</h3>
          <p className="text-sm text-gray-400 mb-1">
            This feature requires <span className="text-[#D4AF37] font-semibold">{requiredTierName}</span> tier.
          </p>
          {currentTier && (
            <p className="text-xs text-gray-500">
              Your current tier: <span className="text-gray-400">{currentTierName}</span>
            </p>
          )}
        </div>
        {onUpgrade && (
          <Button
            variant="primary"
            onClick={onUpgrade}
            className="mt-2"
          >
            Upgrade to {requiredTierName}
          </Button>
        )}
      </div>
    </div>
  );
}

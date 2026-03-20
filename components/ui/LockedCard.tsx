import { Lock } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from './Button';

interface LockedCardProps {
  locked: boolean;
  children: ReactNode;
  onUpgrade?: () => void;
}

export function LockedCard({ locked, children, onUpgrade }: LockedCardProps) {
  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm grayscale pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="text-center space-y-3">
          <Lock className="w-8 h-8 text-[#D4AF37] mx-auto" />
          <p className="text-[#D4AF37] font-semibold">Premium Feature</p>
          <p className="text-sm text-gray-400">Upgrade to access this feature</p>
          {onUpgrade && (
            <Button variant="primary" onClick={onUpgrade} className="mt-2">
              Upgrade Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

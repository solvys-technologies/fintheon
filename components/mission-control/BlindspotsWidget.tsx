import { Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LockedCard } from '../ui/LockedCard';
import { usePsych } from '../../contexts/PsychContext';

export function BlindspotsWidget() {
  const { tier } = useAuth();
  const { profile, loading, orientationRequired, openOrientationModal } = usePsych();
  const isLocked = tier === 'free';

  const blindspots = profile?.blindSpots ?? [];

  const content = (
    <div className="bg-[#050500] border border-[#D4AF37]/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="text-sm font-semibold text-[#D4AF37]">Blindspots</h3>
      </div>
      {loading ? (
        <p className="text-xs text-zinc-500">Syncing Psych Assist…</p>
      ) : orientationRequired ? (
        <div className="text-xs text-zinc-400 space-y-2">
          <p>Complete your Psych Assist orientation to populate blind spots here.</p>
          <button
            onClick={() => openOrientationModal()}
            className="text-[#D4AF37] underline-offset-2 hover:underline"
          >
            Launch Orientation
          </button>
        </div>
      ) : blindspots.length === 0 ? (
        <p className="text-xs text-zinc-500">No blind spots logged yet. Add them inside Settings → Psych Assist.</p>
      ) : (
        <div className="space-y-2">
          {blindspots.map((spot, idx) => (
            <div
              key={`${spot}-${idx}`}
              className="text-xs p-2 rounded bg-black/30 border-l-2 border-l-red-500"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-300 flex-1">{spot}</span>
                <span
                  className={`text-xs uppercase whitespace-nowrap ${
                    idx === 0 ? 'text-red-500' : 'text-yellow-500'
                  }`}
                >
                  {idx === 0 ? 'CRITICAL' : 'WATCH'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return <LockedCard locked={isLocked}>{content}</LockedCard>;
}

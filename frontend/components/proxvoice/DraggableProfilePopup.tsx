import { useState } from "react";
import { ProfileCard } from "./ProfileCard";
import type { ProxVoiceProfile } from "../../lib/services";

interface DraggableProfilePopupProps {
  profile: ProxVoiceProfile;
  onClose: () => void;
  initial?: { x: number; y: number };
}

export function DraggableProfilePopup({
  profile,
  onClose,
  initial = { x: 80, y: 120 },
}: DraggableProfilePopupProps) {
  const [position, setPosition] = useState(initial);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  return (
    <div
      className="fixed z-[10000] fintheon-fade-in"
      style={{ left: position.x, top: position.y }}
      onMouseMove={(event) => {
        if (!drag) return;
        setPosition({ x: event.clientX - drag.dx, y: event.clientY - drag.dy });
      }}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
      <div
        className="cursor-move bg-[var(--fintheon-surface)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)] fintheon-fade-divider"
        onMouseDown={(event) =>
          setDrag({
            dx: event.clientX - position.x,
            dy: event.clientY - position.y,
          })
        }
      >
        Profile
      </div>
      <ProfileCard profile={profile} onClose={onClose} />
    </div>
  );
}

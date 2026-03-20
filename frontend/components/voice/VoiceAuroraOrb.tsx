// [claude-code 2026-03-05] Phase 3B-E: Redesigned voice orb — idle lens, green listening, waveform speaking, radar thinking
import { getVoiceOrbColor, type VoiceOrbState } from '../../types/voice';

interface VoiceAuroraOrbProps {
  state: VoiceOrbState;
  compact?: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function VoiceAuroraOrb({ state, compact = false }: VoiceAuroraOrbProps) {
  const size = compact ? 24 : 28;
  const color = getVoiceOrbColor(state);

  return (
    <>
      <style>{`
        @keyframes voiceListenPulse {
          0%, 100% { border-color: #16a34a; box-shadow: 0 0 6px rgba(34,197,94,0.2); }
          50% { border-color: #22c55e; box-shadow: 0 0 14px rgba(34,197,94,0.5); }
        }
        @keyframes waveBar {
          0%, 100% { height: 20%; }
          50% { height: 80%; }
        }
        @keyframes radarPulse {
          0% { transform: scale(0); opacity: 0.7; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes voiceAlert {
          0%, 100% { transform: scale(1); opacity: 0.88; }
          50% { transform: scale(1.16); opacity: 1; }
        }
        .voice-alert { animation: voiceAlert 0.66s ease-in-out infinite; }
      `}</style>

      <div
        aria-hidden="true"
        className="relative rounded-full shrink-0"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* === IDLE: empty gold-bordered circle === */}
        {state === 'idle' && (
          <div
            className="absolute inset-0 rounded-full bg-[#070704]"
            style={{ border: '1.5px solid var(--fintheon-accent)' }}
          />
        )}

        {/* === LISTENING: green pulsing border === */}
        {state === 'listening' && (
          <div
            className="absolute inset-0 rounded-full bg-[#070704]"
            style={{
              border: '1.5px solid #16a34a',
              animation: 'voiceListenPulse 2s ease-in-out infinite',
              background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, #070704 70%)',
            }}
          />
        )}

        {/* === SPEAKING: 7 dynamic waveform bars with glow === */}
        {state === 'speaking' && (
          <div
            className="absolute inset-0 rounded-full bg-[#070704] overflow-hidden"
            style={{ border: '1.5px solid var(--fintheon-accent)' }}
          >
            <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(199,159,74,0.12) 0%, transparent 70%)' }} />
            <div className="absolute inset-0 flex items-center justify-center gap-[1.5px]">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: '2px',
                    height: '15%',
                    backgroundColor: 'var(--fintheon-accent)',
                    opacity: 0.7 + (i % 2) * 0.3,
                    boxShadow: '0 0 6px rgba(199,159,74,0.5)',
                    animation: `waveBar ${0.6 + (i % 3) * 0.15}s ease-in-out ${i * 0.08}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* === THINKING: gold radar pulses === */}
        {state === 'thinking' && (
          <div
            className="absolute inset-0 rounded-full bg-[#070704] overflow-hidden"
            style={{ border: '1.5px solid var(--fintheon-accent)' }}
          >
            {[0, 0.6, 1.2].map((delay, i) => (
              <div
                key={i}
                className="absolute inset-[15%] rounded-full"
                style={{
                  border: '1px solid rgba(199,159,74,0.5)',
                  animation: `radarPulse 1.8s ease-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* === INFRACTION: red pulsing === */}
        {state === 'infraction' && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-[#070704]"
              style={{
                border: '1.5px solid #ef4444',
                background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, #070704 70%)',
              }}
            />
            <div
              className="absolute inset-0 rounded-full voice-alert"
              style={{ boxShadow: `0 0 20px ${hexToRgba('#ef4444', 0.3)}` }}
            />
          </>
        )}
      </div>
    </>
  );
}

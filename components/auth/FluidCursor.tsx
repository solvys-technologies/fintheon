import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

type TrailPoint = {
  x: number;
  y: number;
  id: number;
  opacity: number;
  scale: number;
};

export type FluidCursorHandle = {
  snapTo: (x: number, y: number) => void;
};

const SNAP_DURATION = 450;

export const FluidCursor = forwardRef<FluidCursorHandle>((_, ref) => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [pulseBoost, setPulseBoost] = useState(false);
  const trailAnimationRef = useRef<number>();
  const snapAnimationRef = useRef<number>();
  const trailIdCounter = useRef(0);
  const isSnappingRef = useRef(false);
  const positionRef = useRef(position);
  const snapStateRef = useRef<{
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startTime: number;
  } | null>(null);

  const addTrailPoint = useCallback((x: number, y: number) => {
    const newPoint: TrailPoint = {
      x,
      y,
      id: trailIdCounter.current++,
      opacity: 1,
      scale: 1,
    };
    setTrail((prev) => [...prev.slice(-20), newPoint]);
  }, []);

  // Update mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isSnappingRef.current) return;
      const nextPos = { x: e.clientX, y: e.clientY };
      positionRef.current = nextPos;
      setPosition(nextPos);
      addTrailPoint(e.clientX, e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [addTrailPoint]);

  const runSnap = useCallback(
    (timestamp: number) => {
      const state = snapStateRef.current;
      if (!state) return;

      const elapsed = timestamp - state.startTime;
      const progress = Math.min(elapsed / SNAP_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextX = state.startX + (state.targetX - state.startX) * eased;
      const nextY = state.startY + (state.targetY - state.startY) * eased;

      const nextPos = { x: nextX, y: nextY };
      positionRef.current = nextPos;
      setPosition(nextPos);
      addTrailPoint(nextX, nextY);

      if (progress < 1) {
        snapAnimationRef.current = requestAnimationFrame(runSnap);
      } else {
        snapStateRef.current = null;
        isSnappingRef.current = false;
        setPulseBoost(true);
        window.setTimeout(() => setPulseBoost(false), 650);
      }
    },
    [addTrailPoint]
  );

  useImperativeHandle(
    ref,
    () => ({
      snapTo: (x, y) => {
        isSnappingRef.current = true;
        snapStateRef.current = {
          startX: positionRef.current.x,
          startY: positionRef.current.y,
          targetX: x,
          targetY: y,
          startTime: performance.now(),
        };
        if (snapAnimationRef.current) cancelAnimationFrame(snapAnimationRef.current);
        snapAnimationRef.current = requestAnimationFrame(runSnap);
      },
    }),
    [runSnap]
  );

  // Animation loop for the "melting" effect
  const animateTrail = () => {
    setTrail((prevTrail) =>
      prevTrail
        .map((point) => ({
          ...point,
          opacity: point.opacity - 0.02, // Fade out
          scale: point.scale + 0.015, // Expand slightly (melt)
        }))
        .filter((point) => point.opacity > 0)
    );
    trailAnimationRef.current = requestAnimationFrame(animateTrail);
  };

  useEffect(() => {
    trailAnimationRef.current = requestAnimationFrame(animateTrail);
    return () => {
      if (trailAnimationRef.current) cancelAnimationFrame(trailAnimationRef.current);
      if (snapAnimationRef.current) cancelAnimationFrame(snapAnimationRef.current);
    };
  }, []);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden mix-blend-screen">
      {/* The Melting Trail */}
      {trail.map((point) => (
        <div
          key={point.id}
          className="absolute rounded-full border border-yellow-500/50"
          style={{
            left: point.x,
            top: point.y,
            width: '20px',
            height: '20px',
            transform: `translate(-50%, -50%) scale(${point.scale})`,
            opacity: point.opacity,
            filter: 'blur(2px)', // Soften the edges for "butter" effect
          }}
        />
      ))}

      {/* The Main Pulsating Cursor Rings */}
      <div
        className="absolute"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Inner Ring */}
        <div
          className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-400 opacity-90 shadow-[0_0_12px_rgba(234,179,8,0.5)] ${
            pulseBoost ? 'animate-ping' : 'animate-pulse'
          }`}
        ></div>

        {/* Outer Ring (Counter Pulse) */}
        <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-600/60 opacity-70 transition-all duration-300 ease-out"></div>

        {/* Center Dot */}
        <div
          className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400"
          style={{ boxShadow: '0 0 6px rgba(234,179,8,0.8)' }}
        ></div>
      </div>
    </div>
  );
});

FluidCursor.displayName = 'FluidCursor';

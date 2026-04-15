// [claude-code 2026-04-15] T5: Swipe-to-action wrapper — left swipe reveals error bg, triggers callback
import { type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
} from "framer-motion";

interface SwipeActionProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  threshold?: number;
}

export function SwipeAction({
  children,
  onSwipeLeft,
  threshold = 100,
}: SwipeActionProps) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const bgOpacity = useTransform(x, [-threshold, 0], [0.6, 0]);
  const opacity = useTransform(x, [-200, -threshold], [0, 1]);

  const handleDragEnd = async (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -threshold && onSwipeLeft) {
      await controls.start({
        opacity: 0,
        x: -300,
        transition: { duration: 0.2, ease: "easeOut" },
      });
      onSwipeLeft();
    } else {
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 300, damping: 30 },
      });
    }
  };

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6"
        style={{ opacity: bgOpacity, backgroundColor: "var(--error)" }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "11px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-display)",
          }}
        >
          DISMISS
        </span>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, opacity }}
      >
        {children}
      </motion.div>
    </div>
  );
}

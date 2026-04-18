// [claude-code 2026-04-19] TP beta polish: glassmorphic accordion for Settings sections.
//   Header tap toggles open. Open state persists to localStorage by id so TP's choices
//   stick across reloads. Animations use the Nothing ease — no bounce, opacity-led.
import { useState, useCallback, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useHaptic } from "../../hooks/useHaptic";

const OPEN_STATE_KEY = "fintheon-mobile:settings-open";
const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

interface CollapsibleSectionProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

function loadOpenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(OPEN_STATE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistOpenSet(next: Set<string>) {
  try {
    localStorage.setItem(OPEN_STATE_KEY, JSON.stringify(Array.from(next)));
  } catch {}
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  trailing,
  subtitle,
  children,
}: CollapsibleSectionProps) {
  const vibrate = useHaptic();
  const [open, setOpen] = useState<boolean>(() => {
    const stored = loadOpenSet();
    if (stored.has(`!${id}`)) return false;
    if (stored.has(id)) return true;
    return defaultOpen;
  });

  useEffect(() => {
    const stored = loadOpenSet();
    stored.delete(id);
    stored.delete(`!${id}`);
    if (open !== defaultOpen) stored.add(open ? id : `!${id}`);
    persistOpenSet(stored);
  }, [open, id, defaultOpen]);

  const toggle = useCallback(() => {
    vibrate(6);
    setOpen((v) => !v);
  }, [vibrate]);

  return (
    <section
      style={{
        background: "color-mix(in srgb, var(--accent) 3%, transparent)",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
        border: "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
        borderRadius: 14,
        overflow: "hidden",
        transition: "border-color 200ms ease, background 200ms ease",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 12,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {trailing}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: NOTHING_EASE }}
            style={{
              display: "inline-flex",
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            <ChevronDown size={18} strokeWidth={1.6} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: NOTHING_EASE }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "4px 16px 18px",
                borderTop:
                  "1px solid color-mix(in srgb, var(--accent) 8%, transparent)",
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

# Sprint Brief: S44-T1 — RefinementGlassGate (data-center glass + slide-down auth)

## Context

The Refinement Engine currently uses `RefinementEditLockModal` — a plain gray dialog that doesn't match the Solvys aesthetic. TP wants a "data-center glass" overlay that obscures the engine for view-only users (everyone except the editor session), with a password input that "slides the glass down like a car window" on unlock. This track builds the gate. The orchestrator (T5) mounts it in `RefinementEngine.tsx`.

This is part of the S44 sprint that polishes the Refinement Engine end-to-end. Wave 1 runs T1-T4 in parallel. T1 is independent in file ownership.

## Branch Target

`s35-unified` (current branch — do NOT cut a new branch)

## Scope — Included

- [ ] Create `frontend/components/refinement/RefinementGlassGate.tsx` (NEW)
- [ ] Create `frontend/components/refinement/glass-gate.css` (NEW)
- [ ] Replace overlay logic in `frontend/components/refinement/AdvancedPane.tsx` (current overlay at lines 161-175 is a placeholder — strip it; `RefinementGlassGate` supersedes)
- [ ] Create `public/textures/wired-mesh.svg` (NEW — monochrome gold wired-glass texture)
- [ ] Mark `frontend/components/refinement/RefinementEditLockModal.tsx` as deprecated by adding a top-of-file comment `// [claude-code 2026-04-26] DEPRECATED — replaced by RefinementGlassGate; remove in T5 unification once verified.` Do NOT delete it; T5 deletes after smoke-test.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/refinement/RefinementEngine.tsx` — T5 mounts the gate
- `frontend/components/refinement/NotchedFuse.tsx` — T2 owns
- `frontend/components/refinement/QuickWeightEditor.tsx` — T2 owns
- `frontend/components/refinement/SourceAccountsManager.tsx` — T3 owns
- `frontend/components/refinement/EconFiltersManager.tsx` — T3 owns
- `frontend/components/refinement/CommentatorManager.tsx` — T3 owns
- `frontend/components/refinement/RegimeControl.tsx` — T3 owns
- `frontend/components/layout/FooterToolbar.tsx` — T4 owns
- `frontend/components/SettingsPanel.tsx` — uncommitted WIP, off-limits

## Glass-Rule Override (READ THIS)

The standing memory rule "no glass effects, no `backdrop-blur`, no `box-shadow`" is **explicitly overridden inside `RefinementGlassGate.tsx` and `glass-gate.css` only**, per direct TP authorization on 2026-04-26. The override does NOT apply to any other component. Do NOT propagate `backdrop-filter` outside these two files. Do NOT introduce gradients, AI sparkles, or emojis under any circumstance — those bans are absolute.

## Reuse Inventory

- `frontend/lib/dev-settings-auth.ts` — exports:
  - `authenticateDev(password: string): Promise<boolean>` (SHA-256 validates)
  - `isDevAuthenticated(): boolean` (reads dual storage: localStorage + sessionStorage)
  - `clearDevAuth(): void`
  - Re-exported aliases: `isRefinementEditUnlocked`, `unlockRefinementEdit`, `lockRefinementEdit`
- `frontend/components/SettingsModal.tsx` lines 61-71 — fixed-inset overlay pattern (custom HTML, NOT Radix Dialog). Use this exact pattern.
- `frontend/styles/custom.css` — existing `t-dropdown` and `t-panel-slide` transitions if needed (decorative only; the slide-down keyframe is bespoke)
- `frontend/fonts.css` lines 147-154 — Doto font (apply via inline style if numerals needed)
- Solvys palette — no central CSS var, use hex literals: `#050402` (BG), `#c79f4a` (gold), `#f0ead6` (text)

## Known Issues to Preserve

- Don't change `dev-settings-auth.ts` — S37 password rotation lives there (`PricedInResearch122356`)
- `editUnlocked` polling in `RefinementEngine.tsx` runs every 1.5s — your component must update auth state synchronously so the poll picks it up; no special hook needed
- The auto-checkpoint hook (`.claude/hooks/`) commits WIP every few minutes — your in-flight files will commit; that's expected

## Implementation Steps

### 1. Create the wired-mesh texture

`public/textures/wired-mesh.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <pattern id="wire" patternUnits="userSpaceOnUse" width="40" height="40">
      <line x1="0" y1="0" x2="40" y2="40" stroke="#c79f4a" stroke-width="0.5" opacity="1"/>
      <line x1="40" y1="0" x2="0" y2="40" stroke="#c79f4a" stroke-width="0.5" opacity="1"/>
      <line x1="0" y1="20" x2="40" y2="20" stroke="#c79f4a" stroke-width="0.3" opacity="0.5"/>
      <line x1="20" y1="0" x2="20" y2="40" stroke="#c79f4a" stroke-width="0.3" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="40" height="40" fill="url(#wire)"/>
</svg>
```

### 2. Create `glass-gate.css`

```css
.rg-glass {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(5, 4, 2, 0.45);
  backdrop-filter: blur(6px) saturate(0.85);
  -webkit-backdrop-filter: blur(6px) saturate(0.85);
  border-top: 1px solid rgba(199, 159, 74, 0.35);
  pointer-events: auto; /* parent gate-shell allows pointer-events on dock only */
  will-change: transform;
}

.rg-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("/textures/wired-mesh.svg");
  background-size: 40px 40px;
  opacity: 0.08;
  pointer-events: none;
}

@keyframes rg-window-down {
  0% {
    transform: translateY(0);
  }
  6% {
    transform: translateY(-2px);
  }
  100% {
    transform: translateY(100%);
  }
}

@keyframes rg-window-up {
  0% {
    transform: translateY(100%);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes rg-shudder {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-1px);
  }
  40% {
    transform: translateX(1px);
  }
  60% {
    transform: translateX(-1px);
  }
  80% {
    transform: translateX(1px);
  }
}

.rg-glass.unlocking {
  animation: rg-window-down 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.rg-glass.relocking {
  animation: rg-window-up 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.rg-dock.shudder {
  animation: rg-shudder 200ms ease-in-out;
}

.rg-dock {
  position: absolute;
  top: 50%;
  right: 48px;
  transform: translateY(-50%);
  pointer-events: auto;
  width: 320px;
  background: rgba(5, 4, 2, 0.85);
  border: 1px solid rgba(199, 159, 74, 0.4);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rg-content {
  /* engine content sits below; glass overlays it */
  pointer-events: none;
}

.rg-content.unlocked {
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .rg-glass.unlocking {
    animation: none;
    opacity: 0;
    transition: opacity 200ms;
  }
  .rg-glass.relocking {
    animation: none;
    opacity: 1;
    transition: opacity 200ms;
  }
  .rg-dock.shudder {
    animation: none;
  }
}
```

### 3. Create `RefinementGlassGate.tsx`

```tsx
// [claude-code 2026-04-26] Data-center glass gate for Refinement Engine; replaces RefinementEditLockModal.
import { useEffect, useRef, useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import {
  authenticateDev,
  isDevAuthenticated,
  clearDevAuth,
} from "../../lib/dev-settings-auth";
import "./glass-gate.css";

const MAX_ATTEMPTS = 10;
const LOCKOUT_KEY = "refinement.lockout";
const ATTEMPTS_KEY = "refinement.attempts";
const OVERRIDE_KEY = "refinementOverrideToken";

interface Props {
  children: React.ReactNode;
  onUnlocked?: () => void;
  onLocked?: () => void;
}

type State = "locked" | "unlocking" | "unlocked" | "relocking" | "lockedOut";

export function RefinementGlassGate({ children, onUnlocked, onLocked }: Props) {
  const [state, setState] = useState<State>(() =>
    isDevAuthenticated()
      ? "unlocked"
      : sessionStorage.getItem(LOCKOUT_KEY)
        ? "lockedOut"
        : "locked",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number>(() =>
    Number(sessionStorage.getItem(ATTEMPTS_KEY) || 0),
  );
  const [shudder, setShudder] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // Override-token reset path
  useEffect(() => {
    const token = sessionStorage.getItem(OVERRIDE_KEY);
    if (token && state === "lockedOut") {
      sessionStorage.removeItem(LOCKOUT_KEY);
      sessionStorage.removeItem(ATTEMPTS_KEY);
      sessionStorage.removeItem(OVERRIDE_KEY);
      setAttempts(0);
      setState("locked");
    }
  }, [state]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (state === "lockedOut") return;
    const ok = await authenticateDev(password);
    if (ok) {
      setState("unlocking");
      setError(null);
      sessionStorage.removeItem(ATTEMPTS_KEY);
      setTimeout(() => {
        setState("unlocked");
        onUnlocked?.();
      }, 1400);
    } else {
      const next = attempts + 1;
      setAttempts(next);
      sessionStorage.setItem(ATTEMPTS_KEY, String(next));
      setShudder(true);
      setTimeout(() => setShudder(false), 220);
      if (next >= MAX_ATTEMPTS) {
        sessionStorage.setItem(LOCKOUT_KEY, "1");
        setState("lockedOut");
        setError("Locked — request override token from administrator.");
      } else {
        setError(`Wrong password — ${MAX_ATTEMPTS - next} attempts remaining.`);
      }
      setPassword("");
    }
  }

  function handleRelock() {
    clearDevAuth();
    setState("relocking");
    setTimeout(() => {
      setState("locked");
      onLocked?.();
    }, 1000);
  }

  const showGlass = state !== "unlocked";
  const glassClass = `rg-glass${state === "unlocking" ? " unlocking" : ""}${state === "relocking" ? " relocking" : ""}`;

  return (
    <div style={{ position: "relative" }}>
      <div
        className={`rg-content${state === "unlocked" ? " unlocked" : ""}`}
        aria-hidden={showGlass}
      >
        {children}
      </div>
      {showGlass && (
        <div className={glassClass} aria-hidden="true">
          <div
            ref={dockRef}
            className={`rg-dock${shudder ? " shudder" : ""}`}
            aria-hidden="false"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {state === "lockedOut" ? (
                <Lock size={14} color="#c79f4a" />
              ) : (
                <KeyRound size={14} color="#c79f4a" />
              )}
              <span
                style={{
                  color: "#f0ead6",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {state === "lockedOut"
                  ? "Engine Locked"
                  : "Unlock Refinement Engine"}
              </span>
            </div>
            <p
              style={{
                color: "rgba(240, 234, 214, 0.65)",
                fontSize: 11,
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {state === "lockedOut"
                ? "Maximum attempts exceeded for this session. An administrator override token is required to reset."
                : "Enter the developer-settings password to edit the Refinement Engine. Read-only mode shows live values without write access."}
            </p>
            {state !== "lockedOut" && (
              <form
                onSubmit={handleUnlock}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  style={{
                    background: "rgba(5,4,2,0.6)",
                    border: "1px solid rgba(199,159,74,0.3)",
                    color: "#f0ead6",
                    padding: "8px 10px",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                {error && (
                  <span
                    style={{ color: "#c79f4a", fontSize: 10, opacity: 0.85 }}
                  >
                    {error}
                  </span>
                )}
                <button
                  type="submit"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(199,159,74,0.5)",
                    color: "#c79f4a",
                    padding: "6px 12px",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Unlock
                </button>
              </form>
            )}
            {state === "lockedOut" && error && (
              <span style={{ color: "#c79f4a", fontSize: 10, opacity: 0.85 }}>
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Exposed for parent (RefinementEngine) to trigger relock from existing Lock button
export function useRefinementGlassRelock() {
  return () => {
    clearDevAuth();
  };
}
```

### 4. Update `AdvancedPane.tsx`

Strip the existing overlay at lines 161-175 (the placeholder "glass-of-data-center" overlay). Leave the rest of the component intact. The new gate wraps the entire engine, not just the advanced pane, so AdvancedPane no longer owns the overlay. Add comment at top:

```tsx
// [claude-code 2026-04-26] Removed placeholder overlay; RefinementGlassGate now owns the lock UI.
```

### 5. Add a deprecation header to `RefinementEditLockModal.tsx`

Top of file:

```tsx
// [claude-code 2026-04-26] DEPRECATED — replaced by RefinementGlassGate; T5 will delete after smoke-test.
```

Do NOT delete the file in this track. T5 deletes.

## Acceptance Criteria

- [ ] Cold load with `isDevAuthenticated()` false → glass visible, engine readable through blur, controls non-interactive (verify by trying to click a fuse — nothing happens)
- [ ] Correct password → 1.4s slide-down animation, glass disappears, engine becomes interactive, `isDevAuthenticated()` returns true
- [ ] Wrong password → 200ms red shudder on dock, attempts counter increments, error message shows remaining attempts
- [ ] 10 wrong attempts → permanent session lock, error shows "request override token"
- [ ] Setting `sessionStorage.refinementOverrideToken = "anything"` and reloading → lockout cleared
- [ ] Reload after unlock → still unlocked (auth persists via dev-settings-auth dual-storage)
- [ ] `prefers-reduced-motion: reduce` → 200ms fade instead of slide
- [ ] Screen reader sees glass as `aria-hidden`, sees password dock as live UI
- [ ] No use of `backdrop-filter` outside `glass-gate.css`
- [ ] No gradients, no emojis, no AI sparkles, no Kanban borders

## Validation Commands

```bash
# From repo root
cd /Users/tifos/Documents/Codebases/fintheon

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Smoke test (T5 will run end-to-end; this track only validates compile + render)
```

## Commit Format

```
[v5.28.0] feat: S44-T1 RefinementGlassGate (data-center glass + slide-down auth)
```

The auto-checkpoint hook will commit WIP automatically every few minutes. Final manual commit with the message above when track is done.

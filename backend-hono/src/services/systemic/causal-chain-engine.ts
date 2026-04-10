// [claude-code 2026-03-11] Causal chain engine for third-order macro thinking
// Tracks cause-effect chains, evaluates pending effects, provides score overlays

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CausalChainsConfig,
  CausalChain,
  CausalLink,
  ActiveChainInstance,
} from "../../types/volatility-taxonomy.js";

// ── Config Loader ──────────────────────────────────────────────────────────────

let _chainsConfig: CausalChainsConfig | null = null;

export function loadCausalChainsConfig(): CausalChainsConfig {
  if (_chainsConfig) return _chainsConfig;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(__dirname, "../../config/causal-chains.json");
    const raw = readFileSync(configPath, "utf-8");
    _chainsConfig = JSON.parse(raw);
    console.log(`[CausalChains] Loaded ${_chainsConfig!.chains.length} chains`);
  } catch (err) {
    console.warn("[CausalChains] Failed to load config:", err);
    _chainsConfig = { _version: "0.0.0", chains: [] };
  }

  return _chainsConfig!;
}

// ── Active Chain State ─────────────────────────────────────────────────────────

let _activeChains: ActiveChainInstance[] = [];

/**
 * Get all active chain instances
 */
export function getActiveChains(): ActiveChainInstance[] {
  return _activeChains;
}

/**
 * Restore active chains from persisted state (e.g., DB on restart)
 */
export function restoreActiveChains(chains: ActiveChainInstance[]): void {
  _activeChains = chains;
  console.log(`[CausalChains] Restored ${chains.length} active chains`);
}

/**
 * Get serializable state for DB persistence
 */
export function getChainState(): ActiveChainInstance[] {
  return [..._activeChains];
}

// ── Chain Triggering ───────────────────────────────────────────────────────────

/**
 * When an event is detected, check if it triggers any causal chains.
 * If so, register the chain as active with its first link.
 */
export function triggerChain(
  eventType: string,
  timestamp: Date = new Date(),
): ActiveChainInstance[] {
  const config = loadCausalChainsConfig();
  const triggered: ActiveChainInstance[] = [];

  for (const chain of config.chains) {
    // Check if this event type is the "from" of the first link
    const firstLink = chain.links[0];
    if (!firstLink || firstLink.from !== eventType) continue;

    // Check if we already have an active instance of this chain
    // (don't re-trigger the same chain within the first link's lag window)
    const existing = _activeChains.find(
      (ac) =>
        ac.chainId === chain.id &&
        !ac.exhausted &&
        Date.now() - new Date(ac.triggerTimestamp).getTime() <
          firstLink.lagMaxMinutes * 60000,
    );
    if (existing) continue;

    const instance: ActiveChainInstance = {
      chainId: chain.id,
      chainName: chain.name,
      triggerEventType: eventType,
      triggerTimestamp: timestamp.toISOString(),
      currentLinkIndex: 0,
      cumulativeProbability: firstLink.probability,
      cumulativeScoreImpact: firstLink.scoreTransmission,
      nextEffectWindow: {
        effectType: firstLink.to,
        opensAt: new Date(
          timestamp.getTime() + firstLink.lagMinMinutes * 60000,
        ).toISOString(),
        closesAt: new Date(
          timestamp.getTime() + firstLink.lagMaxMinutes * 60000,
        ).toISOString(),
        probability: firstLink.probability,
        scoreTransmission: firstLink.scoreTransmission,
      },
      exhausted: false,
      createdAt: new Date().toISOString(),
    };

    _activeChains.push(instance);
    triggered.push(instance);

    console.log(
      `[CausalChains] Triggered "${chain.name}" by ${eventType}. ` +
        `Next effect: ${firstLink.to} in ${firstLink.lagMinMinutes / 1440}-${firstLink.lagMaxMinutes / 1440} days (p=${firstLink.probability})`,
    );
  }

  return triggered;
}

// ── Chain Evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate all active chains, advancing them if their effect windows have opened.
 * Returns chains that have advanced and may need alerts generated.
 */
export function evaluateActiveChains(now: Date = new Date()): {
  advancedChains: ActiveChainInstance[];
  exhaustedChains: ActiveChainInstance[];
} {
  const config = loadCausalChainsConfig();
  const advancedChains: ActiveChainInstance[] = [];
  const exhaustedChains: ActiveChainInstance[] = [];

  for (const instance of _activeChains) {
    if (instance.exhausted) continue;

    const chain = config.chains.find((c) => c.id === instance.chainId);
    if (!chain) {
      instance.exhausted = true;
      exhaustedChains.push(instance);
      continue;
    }

    const nextWindow = instance.nextEffectWindow;
    if (!nextWindow) {
      instance.exhausted = true;
      exhaustedChains.push(instance);
      continue;
    }

    const windowOpensAt = new Date(nextWindow.opensAt).getTime();
    const windowClosesAt = new Date(nextWindow.closesAt).getTime();
    const nowMs = now.getTime();

    // If we're past the close of the effect window, advance to next link
    if (nowMs > windowClosesAt) {
      const nextLinkIndex = instance.currentLinkIndex + 1;
      if (nextLinkIndex >= chain.links.length) {
        // Chain is fully played out
        instance.exhausted = true;
        instance.nextEffectWindow = undefined;
        exhaustedChains.push(instance);
        continue;
      }

      const nextLink = chain.links[nextLinkIndex];
      const prevCumulativeProb = instance.cumulativeProbability;
      const prevCumulativeScore = instance.cumulativeScoreImpact;

      instance.currentLinkIndex = nextLinkIndex;
      instance.cumulativeProbability =
        prevCumulativeProb * nextLink.probability;
      instance.cumulativeScoreImpact =
        prevCumulativeScore * nextLink.scoreTransmission;
      instance.nextEffectWindow = {
        effectType: nextLink.to,
        opensAt: new Date(nowMs + nextLink.lagMinMinutes * 60000).toISOString(),
        closesAt: new Date(
          nowMs + nextLink.lagMaxMinutes * 60000,
        ).toISOString(),
        probability: nextLink.probability,
        scoreTransmission: nextLink.scoreTransmission,
      };

      advancedChains.push(instance);
    }
    // If we're within the effect window, the chain is "active" at this stage
    // (score overlay already accounts for it via getChainScoreOverlay)
  }

  // Clean up exhausted chains older than 7 days
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  _activeChains = _activeChains.filter(
    (c) =>
      !c.exhausted || new Date(c.triggerTimestamp).getTime() > sevenDaysAgo,
  );

  return { advancedChains, exhaustedChains };
}

// ── Score Overlay ──────────────────────────────────────────────────────────────

/**
 * Calculate the aggregate score contribution from all active causal chains.
 * This is probability-weighted: a third-order effect with p=0.8*0.7*0.6=0.336
 * contributes only 33.6% of its score transmission.
 *
 * Returns 0-10 score.
 */
export function getChainScoreOverlay(instrument?: string): {
  score: number;
  activeCount: number;
  rationale: string[];
} {
  const config = loadCausalChainsConfig();
  let totalScore = 0;
  const rationale: string[] = [];
  let activeCount = 0;
  const now = Date.now();

  for (const instance of _activeChains) {
    if (instance.exhausted) continue;
    activeCount++;

    const chain = config.chains.find((c) => c.id === instance.chainId);
    if (!chain) continue;

    const nextWindow = instance.nextEffectWindow;
    if (!nextWindow) continue;

    // Score contribution = cumulative probability * cumulative score transmission * base weight
    // Attenuated by how deep we are in the chain (deeper = less certain)
    const linkDepth = instance.currentLinkIndex + 1;
    const depthLabel =
      linkDepth === 1
        ? "2nd-order"
        : linkDepth === 2
          ? "3rd-order"
          : `${linkDepth + 1}th-order`;

    // Check if we're within the effect window (active anticipation)
    const windowOpens = new Date(nextWindow.opensAt).getTime();
    const windowCloses = new Date(nextWindow.closesAt).getTime();
    const isInWindow = now >= windowOpens && now <= windowCloses;
    const isPreWindow = now < windowOpens;

    // Score contribution scales with proximity to window
    let windowFactor = 0;
    if (isInWindow) {
      windowFactor = 1.0;
    } else if (isPreWindow) {
      // Ramp up as we approach the window (50% at half-way point)
      const timeUntilWindow = windowOpens - now;
      const totalWait =
        windowOpens - new Date(instance.triggerTimestamp).getTime();
      windowFactor =
        totalWait > 0 ? Math.max(0.1, 1 - timeUntilWindow / totalWait) : 0.1;
    }

    const contribution =
      instance.cumulativeProbability *
      instance.cumulativeScoreImpact *
      windowFactor;
    totalScore += contribution;

    if (contribution > 0.05) {
      rationale.push(
        `${chain.name}: ${depthLabel} effect "${nextWindow.effectType}" ` +
          `(p=${(instance.cumulativeProbability * 100).toFixed(0)}%, ` +
          `${isInWindow ? "IN WINDOW" : isPreWindow ? "approaching" : "passed"}) → +${contribution.toFixed(2)}`,
      );
    }
  }

  // Cap at 10
  totalScore = Math.min(10, totalScore);

  return { score: totalScore, activeCount, rationale };
}

/**
 * Get a human-readable summary of all active chains for UI/API
 */
export function getActiveChainSummary(): {
  chainId: string;
  name: string;
  trigger: string;
  triggeredAt: string;
  currentStage: string;
  nextEffect: string | null;
  cumulativeProbability: number;
  linkDepth: number;
  exhausted: boolean;
}[] {
  const config = loadCausalChainsConfig();

  return _activeChains.map((instance) => {
    const chain = config.chains.find((c) => c.id === instance.chainId);
    const currentLink = chain?.links[instance.currentLinkIndex];

    return {
      chainId: instance.chainId,
      name: instance.chainName,
      trigger: instance.triggerEventType,
      triggeredAt: instance.triggerTimestamp,
      currentStage: currentLink?.to ?? "unknown",
      nextEffect: instance.nextEffectWindow?.effectType ?? null,
      cumulativeProbability: instance.cumulativeProbability,
      linkDepth: instance.currentLinkIndex + 1,
      exhausted: instance.exhausted,
    };
  });
}

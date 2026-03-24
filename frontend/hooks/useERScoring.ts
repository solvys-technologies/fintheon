// [claude-code 2026-03-24] PsychAssist ER Scoring Engine — deterministic client-side tilt detection
//   Replaces slow Claude sentiment analysis with instant regex-based curse/breathing detection.
//   Scale: 12.5 (calm) → 0 (neutral) → -12.5 (full tilt). Decay: 5x per curse.
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const ER_MIN = -12.5;
const ER_MAX = 12.5;
const CURSE_PENALTY = -1.25;
const BREATHING_PENALTY = -0.2;
const BASE_DECAY_MINUTES = 1;
const DECAY_MULTIPLIER = 5;
const DECAY_TICK_MS = 1000;
const STORAGE_KEY = 'psychassist_current_score';
const CURSE_COUNT_KEY = 'psychassist_curse_count';
const LAST_TRIGGER_KEY = 'psychassist_last_trigger';

// ─── Detection patterns ────────────────────────────────────────────────────

// Order matters: longer compound phrases first so they match before shorter substrings
const CURSE_PATTERNS = [
  /\bwhat the fuck\b/i,
  /\boh my god\b/i,
  /\bson of a bitch\b/i,
  /\bgod damn\b/i,
  /\bfucking hell\b/i,
  /\bholy shit\b/i,
  /\bbull ?shit\b/i,
  /\bhorse ?shit\b/i,
  /\bfuck(?:ing|ed|er|s)?\b/i,
  /\bshit(?:ty|s)?\b/i,
  /\bdamn(?:it)?\b/i,
  /\bass(?:hole)?\b/i,
  /\bbitch\b/i,
  /\bhell\b/i,
];

const BREATHING_PATTERNS = [
  /\[labored breathing\]/i,
  /\[heavy breathing\]/i,
  /\[breathing heavily\]/i,
  /\[panting\]/i,
  /\[sighs?\]/i,
  /\[deep breath\]/i,
  /\[exhales?\]/i,
];

export type EREventType = 'curse' | 'breathing' | 'decay_reset';

export interface EREvent {
  eventType: EREventType;
  triggerText: string | null;
  penalty: number;
  scoreBefore: number;
  scoreAfter: number;
  curseCount: number;
  decayWindowMinutes: number | null;
  transcriptSnippet: string | null;
}

interface ERScoringState {
  score: number;
  curseCount: number;
  lastTriggerAt: number | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function computeDecayWindowMs(curseCount: number): number {
  if (curseCount <= 0) return 0;
  return BASE_DECAY_MINUTES * Math.pow(DECAY_MULTIPLIER, curseCount - 1) * 60_000;
}

function readPersistedState(): ERScoringState {
  try {
    const score = parseFloat(localStorage.getItem(STORAGE_KEY) || '0');
    const curseCount = parseInt(localStorage.getItem(CURSE_COUNT_KEY) || '0', 10);
    const lastTrigger = localStorage.getItem(LAST_TRIGGER_KEY);
    return {
      score: Number.isFinite(score) ? score : 0,
      curseCount: Number.isFinite(curseCount) ? curseCount : 0,
      lastTriggerAt: lastTrigger ? parseInt(lastTrigger, 10) : null,
    };
  } catch {
    return { score: 0, curseCount: 0, lastTriggerAt: null };
  }
}

function persistState(state: ERScoringState): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.score));
    localStorage.setItem(CURSE_COUNT_KEY, String(state.curseCount));
    if (state.lastTriggerAt) {
      localStorage.setItem(LAST_TRIGGER_KEY, String(state.lastTriggerAt));
    }
  } catch { /* ignore */ }
}

// ─── Detection ─────────────────────────────────────────────────────────────

/**
 * Greedy consume: compound phrases matched first blank out their region,
 * so "what the fuck" doesn't also match "fuck" as a second hit.
 */
function detectCurses(text: string): string[] {
  const matches: string[] = [];
  let remaining = text.toLowerCase();

  for (const pattern of CURSE_PATTERNS) {
    const match = remaining.match(pattern);
    if (match) {
      matches.push(match[0]);
      // Blank out the matched region so shorter patterns can't re-match
      remaining = remaining.slice(0, match.index!) + ' '.repeat(match[0].length) + remaining.slice(match.index! + match[0].length);
    }
  }
  return matches;
}

function detectBreathing(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of BREATHING_PATTERNS) {
    const match = text.match(pattern);
    if (match) matches.push(match[0]);
  }
  return matches;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseERScoringOptions {
  /** Fire-and-forget POST to backend. Called for each trigger event. */
  onEvent?: (event: EREvent) => void;
}

export function useERScoring(options?: UseERScoringOptions) {
  const [state, setState] = useState<ERScoringState>(readPersistedState);
  const stateRef = useRef(state);
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Keep ref in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Decay timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        // Nothing to decay
        if (prev.score === 0 || !prev.lastTriggerAt) return prev;

        const decayWindowMs = computeDecayWindowMs(prev.curseCount);
        const elapsed = Date.now() - prev.lastTriggerAt;

        // Still within trigger grace period — no decay yet
        if (elapsed <= 0) return prev;

        // Decay: linear interpolation from last trigger score toward 0
        // Rate: score moves to 0 over the full decay window
        const decayRate = Math.abs(prev.score) / (decayWindowMs / DECAY_TICK_MS);
        const direction = prev.score > 0 ? -1 : 1;
        const newScore = prev.score + direction * decayRate;

        // If crossed zero or decay window expired, reset
        if ((direction > 0 && newScore >= 0) || (direction < 0 && newScore <= 0) || elapsed >= decayWindowMs) {
          const resetState: ERScoringState = { score: 0, curseCount: 0, lastTriggerAt: null };
          persistState(resetState);

          // Dispatch score event
          window.dispatchEvent(new CustomEvent('psychassist:score', {
            detail: { score: 0, timestamp: Date.now() },
          }));

          return resetState;
        }

        const clamped = clamp(newScore, ER_MIN, ER_MAX);
        const nextState = { ...prev, score: clamped };
        persistState(nextState);

        // Dispatch score event on decay tick
        window.dispatchEvent(new CustomEvent('psychassist:score', {
          detail: { score: clamped, timestamp: Date.now() },
        }));

        return nextState;
      });
    }, DECAY_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  // ─── Process transcript ──────────────────────────────────────────────────

  const processTranscript = useCallback((text: string): void => {
    const curseMatches = detectCurses(text);
    const breathingMatches = detectBreathing(text);

    if (curseMatches.length === 0 && breathingMatches.length === 0) return;

    const snippet = text.slice(0, 200);
    const now = Date.now();
    const indicators: string[] = [];

    // Compute new state synchronously from ref (not inside setState updater)
    // so we can dispatch events IMMEDIATELY without waiting for React's batch flush
    let current = { ...stateRef.current };

    // Process each curse as a flat penalty
    for (const match of curseMatches) {
      const scoreBefore = current.score;
      const newCurseCount = current.curseCount + 1;
      const scoreAfter = clamp(scoreBefore + CURSE_PENALTY, ER_MIN, ER_MAX);

      current = {
        score: scoreAfter,
        curseCount: newCurseCount,
        lastTriggerAt: now,
      };

      indicators.push(match);

      onEventRef.current?.({
        eventType: 'curse',
        triggerText: match,
        penalty: CURSE_PENALTY,
        scoreBefore,
        scoreAfter,
        curseCount: newCurseCount,
        decayWindowMinutes: BASE_DECAY_MINUTES * Math.pow(DECAY_MULTIPLIER, newCurseCount - 1),
        transcriptSnippet: snippet,
      });
    }

    // Process breathing markers (flat penalty, no curse count bump)
    for (const match of breathingMatches) {
      const scoreBefore = current.score;
      const scoreAfter = clamp(scoreBefore + BREATHING_PENALTY, ER_MIN, ER_MAX);

      current = {
        ...current,
        score: scoreAfter,
        // lastTriggerAt NOT updated for breathing — spec says breathing doesn't affect decay timer
      };

      indicators.push(match);

      onEventRef.current?.({
        eventType: 'breathing',
        triggerText: match,
        penalty: BREATHING_PENALTY,
        scoreBefore,
        scoreAfter,
        curseCount: current.curseCount,
        decayWindowMinutes: null,
        transcriptSnippet: snippet,
      });
    }

    // Persist + update ref synchronously BEFORE dispatching events
    persistState(current);
    stateRef.current = current;

    // Dispatch events IMMEDIATELY (synchronous, not deferred by React batching)
    window.dispatchEvent(new CustomEvent('psychassist:score', {
      detail: { score: current.score, timestamp: now },
    }));

    if (indicators.length > 0) {
      window.dispatchEvent(new CustomEvent('psychassist:infraction', {
        detail: { timestamp: now, indicators },
      }));
    }

    // Then update React state (can be batched — UI will catch up, but event bus is already hot)
    setState(current);
  }, []);

  // ─── Manual reset (for testing / session boundaries) ─────────────────────

  const reset = useCallback(() => {
    const resetState: ERScoringState = { score: 0, curseCount: 0, lastTriggerAt: null };
    setState(resetState);
    persistState(resetState);
    window.dispatchEvent(new CustomEvent('psychassist:score', {
      detail: { score: 0, timestamp: Date.now() },
    }));
  }, []);

  return {
    score: state.score,
    curseCount: state.curseCount,
    lastTriggerAt: state.lastTriggerAt,
    decayWindowMinutes: state.curseCount > 0
      ? BASE_DECAY_MINUTES * Math.pow(DECAY_MULTIPLIER, state.curseCount - 1)
      : 0,
    processTranscript,
    reset,
  };
}

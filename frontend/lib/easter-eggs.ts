// [claude-code 2026-03-14] Easter egg handlers — SPQR, Konami, Ides of March, logo triple-click

import { isPompaEnabled, playSound } from './pompa';

const ROMAN_EAGLE = `
      .     .
     /|\\   /|\\
    / | \\ / | \\
   /  |  V  |  \\
  /   |     |   \\
 /    |     |    \\
      | S P |
      | Q R |
      |_____|
      |     |
     /|     |\\
    / |     | \\
   /  |     |  \\
      |     |
     _|     |_
    |_________|
`;

/**
 * Check if input matches 'spqr' and return ASCII eagle art.
 */
export function spqrHandler(input: string): string | null {
  if (input.toLowerCase() === 'spqr') return ROMAN_EAGLE;
  return null;
}

/**
 * Listen for Konami code: up up down down left right left right B A
 */
export function initKonamiCode(): () => void {
  const sequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA',
  ];
  let position = 0;

  const handler = (e: KeyboardEvent) => {
    if (!isPompaEnabled()) return;

    const expected = sequence[position];
    if (e.code === expected) {
      position++;
      if (position === sequence.length) {
        position = 0;
        showGladiatorOverlay();
      }
    } else {
      position = 0;
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

function showGladiatorOverlay(): void {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '99999',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(5, 4, 2, 0.85)', pointerEvents: 'none',
  });

  const icon = document.createElement('div');
  icon.textContent = '\u2694\uFE0E';
  Object.assign(icon.style, { fontSize: '4rem', marginBottom: '1rem', opacity: '0.8' });

  const label = document.createElement('div');
  label.textContent = 'GLADIATOR MODE';
  Object.assign(label.style, {
    fontFamily: "'Cinzel', 'Georgia', serif",
    fontSize: '1.5rem', fontWeight: '700',
    color: '#c79f4a', letterSpacing: '0.22em',
    textTransform: 'uppercase',
  });

  overlay.appendChild(icon);
  overlay.appendChild(label);
  document.body.appendChild(overlay);
  playSound('colosseum-cheers');

  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => overlay.remove(), 500);
  }, 2000);
}

/**
 * Check if today is March 15 (Ides of March).
 */
export function checkIdesOfMarch(): string | null {
  const now = new Date();
  if (now.getMonth() === 2 && now.getDate() === 15) {
    return 'Beware the Ides of March';
  }
  return null;
}

/**
 * Listen for triple-click on element, then play roman-march sound.
 */
export function initLogoTripleClick(element: HTMLElement): () => void {
  let clicks = 0;
  let timer: ReturnType<typeof setTimeout>;

  const handler = () => {
    if (!isPompaEnabled()) return;
    clicks++;
    clearTimeout(timer);
    if (clicks >= 3) {
      clicks = 0;
      playSound('roman-march');
    } else {
      timer = setTimeout(() => { clicks = 0; }, 500);
    }
  };

  element.addEventListener('click', handler);
  return () => element.removeEventListener('click', handler);
}

/**
 * Initialize all easter eggs. Returns cleanup function.
 */
export function initEasterEggs(): () => void {
  const cleanupKonami = initKonamiCode();
  const idesBanner = checkIdesOfMarch();

  if (idesBanner) {
    console.log(`%c${idesBanner}`, 'color: #c79f4a; font-size: 1.2rem; font-family: Cinzel, serif;');
  }

  return () => {
    cleanupKonami();
  };
}

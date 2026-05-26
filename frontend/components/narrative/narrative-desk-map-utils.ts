import type { DeskMapDesk } from "../../lib/desk-map-api";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";

export interface DeskMapPoint {
  x: number;
  y: number;
}

export interface CoverFocus {
  x: number;
  y: number;
}

export const deskMapPositions: DeskMapPoint[] = [
  { x: 23, y: 36 },
  { x: 52, y: 30 },
  { x: 75, y: 46 },
  { x: 36, y: 64 },
  { x: 61, y: 68 },
  { x: 18, y: 75 },
];

export function buildDeskMapLinks(sessions: NarrativeSessionSummary[]) {
  return sessions.slice(0, 8).flatMap((session, index) =>
    sessions.slice(index + 1, index + 3).map((next, offset) => ({
      id: `${session.id}-${next.id}`,
      from: deskMapPositions[index % deskMapPositions.length],
      to: deskMapPositions[(index + offset + 1) % deskMapPositions.length],
      color: hexToRgba(session.color, 0.22),
    })),
  );
}

export function loadCoverFocus(deskId: string | undefined): CoverFocus {
  try {
    const raw = localStorage.getItem(focusKey(deskId));
    if (!raw) return { x: 50, y: 40 };
    const parsed = JSON.parse(raw) as Partial<CoverFocus>;
    return {
      x: clamp(Number(parsed.x ?? 50), 0, 100),
      y: clamp(Number(parsed.y ?? 40), 0, 100),
    };
  } catch {
    return { x: 50, y: 40 };
  }
}

export function saveCoverFocus(deskId: string | undefined, focus: CoverFocus) {
  try {
    localStorage.setItem(focusKey(deskId), JSON.stringify(focus));
  } catch {
    // local-only crop memory is best effort
  }
}

export function buildImagePrompt(
  desk: DeskMapDesk | null,
  sessions: NarrativeSessionSummary[],
): string {
  const titles = sessions
    .slice(0, 5)
    .map((session) => session.title)
    .join(" / ");
  return `${desk?.name ?? "Trading Desk"} active narrative map${titles ? ` | ${titles}` : ""}`.slice(
    0,
    900,
  );
}

export function buildGeneratedImage(
  desk: DeskMapDesk | null,
  sessions: NarrativeSessionSummary[],
): string {
  const prompt = buildImagePrompt(desk, sessions);
  const color = desk?.color ?? "#c79f4a";
  const hash = Array.from(prompt + Date.now()).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  const title = escapeXml(prompt.split("|")[0]?.trim() || "DeskMap");
  const accent = hexToRgba(color, 0.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 520"><rect width="1600" height="520" fill="#050402"/><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4"/></filter><rect width="1600" height="520" opacity=".12" filter="url(#n)"/><circle cx="${240 + (hash % 340)}" cy="${130 + (hash % 150)}" r="240" fill="${accent}"/><path d="M80 360 C360 220 600 430 860 260 S1190 170 1510 335" fill="none" stroke="${accent}" stroke-width="5" opacity=".35"/><text x="72" y="112" fill="rgba(240,234,214,.86)" font-family="Inter,system-ui,sans-serif" font-size="42" font-weight="650">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function formatDeskMapAge(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recent";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function hexToRgba(value: string, alpha: number): string {
  const hex = value.replace("#", "");
  if (hex.length !== 6) return `rgba(199,159,74,${alpha})`;
  const parsed = Number.parseInt(hex, 16);
  return `rgba(${(parsed >> 16) & 255},${(parsed >> 8) & 255},${parsed & 255},${alpha})`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function focusKey(deskId: string | undefined): string {
  return `fintheon:desk-map-cover-focus:${deskId ?? "default"}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

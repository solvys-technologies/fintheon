// [claude-code 2026-04-26] S46: minimal RFC5545 .ics parser scoped to TradingView
// "Add to Calendar" downloads. We need: UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, URL.
// Inline + dep-free; node-ical was overkill for the 6 fields we touch.

export interface ParsedIcsEvent {
  uid: string;
  startsAt: string;
  endsAt: string | null;
  title: string;
  description: string | null;
  url: string | null;
}

function unfoldLines(raw: string): string[] {
  const lines: string[] = [];
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      lines[lines.length - 1] = (lines[lines.length - 1] ?? "") + line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string, params: Record<string, string>): string {
  // Forms TV emits in practice:
  //   20260427T123000Z          (UTC)
  //   20260427T083000           (floating)
  //   20260427                  (date-only)
  // TZID=...:20260427T083000   (zone-stamped — captured via params.TZID)
  const v = value.trim();
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`,
    ).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(v)) {
    const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}`;
    if (params.TZID) {
      const tzOffsetMin = guessTzOffsetMinutes(params.TZID, iso);
      const ts = Date.parse(`${iso}Z`) - tzOffsetMin * 60_000;
      return new Date(ts).toISOString();
    }
    return new Date(iso).toISOString();
  }
  if (/^\d{8}$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`,
    ).toISOString();
  }
  const fallback = new Date(v);
  if (Number.isFinite(fallback.getTime())) return fallback.toISOString();
  throw new Error(`Unrecognized .ics date value: ${value}`);
}

function guessTzOffsetMinutes(tzid: string, iso: string): number {
  // Cheap DST-aware lookup via Intl. Returns minutes EAST of UTC.
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      timeZoneName: "shortOffset",
      year: "numeric",
    });
    const parts = fmt.formatToParts(new Date(`${iso}Z`));
    const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = tz.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
    if (!match) return 0;
    const hours = Number(match[1]);
    const mins = match[2] ? Number(match[2]) : 0;
    return hours * 60 + (hours < 0 ? -mins : mins);
  } catch {
    return 0;
  }
}

function parseLine(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

export function parseIcsEvents(raw: string): ParsedIcsEvent[] {
  const lines = unfoldLines(raw);
  const events: ParsedIcsEvent[] = [];
  let current: Partial<ParsedIcsEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.uid && current.startsAt && current.title) {
        events.push({
          uid: current.uid,
          startsAt: current.startsAt,
          endsAt: current.endsAt ?? null,
          title: current.title,
          description: current.description ?? null,
          url: current.url ?? null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    switch (parsed.name) {
      case "UID":
        current.uid = parsed.value.trim();
        break;
      case "DTSTART":
        current.startsAt = parseIcsDate(parsed.value, parsed.params);
        break;
      case "DTEND":
        current.endsAt = parseIcsDate(parsed.value, parsed.params);
        break;
      case "SUMMARY":
        current.title = unescape(parsed.value);
        break;
      case "DESCRIPTION":
        current.description = unescape(parsed.value);
        break;
      case "URL":
        current.url = parsed.value.trim();
        break;
    }
  }
  return events;
}

const HIGH_TOKENS = ["high", "high impact", "high volatility", "★★★", "***"];
const MED_TOKENS = ["medium", "med ", "med.", "moderate", "★★", "**"];

export function inferSeverity(
  title: string,
  description: string | null,
): number | null {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  if (HIGH_TOKENS.some((t) => blob.includes(t))) return 3;
  if (MED_TOKENS.some((t) => blob.includes(t))) return 2;
  if (blob.includes("low")) return 1;
  return null;
}

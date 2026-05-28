const EASTERN_TIME_ZONE = "America/New_York";

const BRIEFING_TIMES_ET: Record<string, { hour: number; minute: number }> = {
  mdb: { hour: 6, minute: 30 },
  adb: { hour: 10, minute: 45 },
  pmdb: { hour: 17, minute: 15 },
};

interface EtParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function resolveBriefingTime(anchor: string): string | null {
  const times = BRIEFING_TIMES_ET[anchor];
  if (!times) return null;

  const now = new Date();
  let target = getEasternDateParts(now);
  if (isWeekend(target)) target = nextWeekday(target);

  let candidate = easternWallTimeToUtc({
    ...target,
    hour: times.hour,
    minute: times.minute,
  });

  if (candidate.getTime() <= now.getTime()) {
    target = nextWeekday(addEasternDays(target, 1));
    candidate = easternWallTimeToUtc({
      ...target,
      hour: times.hour,
      minute: times.minute,
    });
  }

  return candidate.toISOString();
}

function getEasternDateParts(date: Date): EtParts {
  const values = Object.fromEntries(
    etFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function easternWallTimeToUtc(parts: EtParts): Date {
  let utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );

  for (let i = 0; i < 3; i += 1) {
    const actual = getEasternDateParts(new Date(utcMs));
    const desiredSerial = wallSerial(parts);
    const actualSerial = wallSerial(actual);
    utcMs += (desiredSerial - actualSerial) * 60_000;
  }

  return new Date(utcMs);
}

function wallSerial(parts: EtParts): number {
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day) / 60_000 +
    parts.hour * 60 +
    parts.minute
  );
}

function isWeekend(parts: Pick<EtParts, "year" | "month" | "day">): boolean {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return day.getUTCDay() === 0 || day.getUTCDay() === 6;
}

function nextWeekday(parts: EtParts): EtParts {
  let next = { ...parts };
  while (isWeekend(next)) next = addEasternDays(next, 1);
  return next;
}

function addEasternDays(parts: EtParts, days: number): EtParts {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );
  return {
    ...parts,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

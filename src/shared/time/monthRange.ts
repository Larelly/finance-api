const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  if (!MONTH_REGEX.test(month)) return false;
  return true;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Offset (in minutes) such that `localTime = utcInstant + offset`, computed for
 * the given timezone at the given UTC instant. Used to convert a local wall-clock
 * time (year/month/day/hour/...) into the correct UTC instant regardless of the
 * server's own timezone (which must always be UTC, but this makes it explicit).
 */
function getTimeZoneOffsetMinutes(timeZone: string, utcInstant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(utcInstant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return (asUtc - utcInstant.getTime()) / 60_000;
}

function zonedStartOfDayToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, guess);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

export interface MonthRange {
  start: Date;
  end: Date;
}

/**
 * Computes the [start, end) UTC instants for the given "YYYY-MM" month, anchored
 * to the user's timezone — not the server's. The server always runs in UTC.
 */
export function monthRange(month: string, timeZone: string): MonthRange {
  if (!isValidMonth(month)) {
    throw new Error(`Invalid month: ${month}`);
  }

  const yearPart = month.slice(0, 4);
  const monthPart = month.slice(5, 7);
  const year = Number(yearPart);
  const monthNum = Number(monthPart);

  const start = zonedStartOfDayToUtc(year, monthNum, 1, timeZone);

  const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  const end = zonedStartOfDayToUtc(nextYear, nextMonthNum, 1, timeZone);

  return { start, end };
}

export function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));

  const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
  const prevYear = monthNum === 1 ? year - 1 : year;

  return `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;
}

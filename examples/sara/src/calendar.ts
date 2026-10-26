/**
 * Dates are UTC midnights. SARA compares days as whole dates, so a day is its ISO form at
 * midnight UTC and a year is bounded by its first and last such days.
 */

/** Stand-in for a relationship whose start the facts leave open. */
export const NEG_INF = new Date(-8_640_000_000_000_000);

export function day(text: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new Error(`Not a YYYY-MM-DD day: ${text}`);
  }
  const value = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== text) {
    throw new Error(`Invalid day: ${text}`);
  }
  return value;
}

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function firstDay(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

export function lastDay(year: number): Date {
  return new Date(Date.UTC(year, 11, 31));
}

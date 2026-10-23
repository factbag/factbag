/**
 * Calendar differences between dates, in UTC. A date in a knowledge base is an instant,
 * but the statutes and schedules that rules are written for speak in days and years, so the
 * differences count calendar units and ignore the time of day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day of the instant, as days since the epoch. */
function utcDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
}

/** Whole calendar days from `earlier` to `later`; negative when `later` comes first. */
export function daysBetween(later: Date, earlier: Date): number {
  return utcDay(later) - utcDay(earlier);
}

/**
 * Whole calendar years from `earlier` to `later` by anniversaries: the difference of the
 * years, less one when `later` falls before the anniversary of `earlier` in its own
 * year. The anniversary of the 29th of February is the 1st of March in a common year.
 * Negative when `later` comes first.
 */
export function yearsBetween(later: Date, earlier: Date): number {
  if (later.getTime() < earlier.getTime()) {
    return -yearsBetween(earlier, later);
  }
  const years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const laterDay = later.getUTCMonth() * 100 + later.getUTCDate();
  const earlierDay = earlier.getUTCMonth() * 100 + earlier.getUTCDate();
  return laterDay < earlierDay ? years - 1 : years;
}

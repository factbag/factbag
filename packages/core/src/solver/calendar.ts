const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar day since the epoch, including dates before the epoch. */
function utcDay(date: Date): number {
  // Avoid Date.UTC's special interpretation of years 0–99 as 1900–1999.
  return Math.floor(date.getTime() / DAY_MS);
}

/** Signed UTC calendar days from `earlier` to `later`, ignoring time of day. */
export function daysBetween(later: Date, earlier: Date): number {
  return utcDay(later) - utcDay(earlier);
}

/** Whole UTC anniversary years, with February 29 anniversaries on March 1 in common years. */
export function yearsBetween(later: Date, earlier: Date): number {
  if (later.getTime() < earlier.getTime()) {
    // A reversed date within the first year is zero, not negative zero.
    return -yearsBetween(earlier, later) || 0;
  }
  const years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const laterDay = later.getUTCMonth() * 100 + later.getUTCDate();
  const earlierDay = earlier.getUTCMonth() * 100 + earlier.getUTCDate();
  return laterDay < earlierDay ? years - 1 : years;
}

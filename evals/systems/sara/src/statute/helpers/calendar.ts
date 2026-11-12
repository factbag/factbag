/**
 * Rule-body conditions for a calendar year. Days are UTC midnights, so a year is bounded by
 * its first and last such days, which rules derive by arithmetic for any year a date holds.
 */
import { add, daysBetween, div, firstOfMonth, floorTo, gte, letIn, sub, yearOf } from "factbag/dsl";
import type { DateTerm, Formula, NumericTerm, Var } from "factbag/dsl";

const DAY_MS = 86_400_000;

/** A rule-body condition. */
type Condition = Formula<boolean, readonly unknown[]>;

/** The last day of a year: the day before the next year's first. */
function lastDayOf(year: NumericTerm): Formula<Date, readonly [DateTerm, NumericTerm]> {
  return sub(firstOfMonth(add(year, 1), 1), DAY_MS);
}

/** Binds `first` and `last` to the first and last days of `year`, which must be bound. */
export function yearBounds(year: NumericTerm, first: Var, last: Var): Condition {
  return letIn(first, firstOfMonth(year, 1), letIn(last, lastDayOf(year), gte(last, first)));
}

/**
 * Binds `first` and `last` to the first and last days of the year `date` falls in, and
 * `year` to that year.
 */
export function yearBoundsOf(date: DateTerm, year: Var, first: Var, last: Var): Condition {
  return letIn(year, yearOf(date), yearBounds(year, first, last));
}

/**
 * For the "more than one-half of the year" and "last 6 months" tests, binds `julyFirst`
 * to the first of July of `year`, which must be bound, and `halfDays` to half the year's
 * length in whole days, rounded down, so that a state covering more days than that covers
 * more than half the year.
 */
export function yearMarks(year: NumericTerm, julyFirst: Var, halfDays: Var): Condition {
  const days = add(daysBetween(lastDayOf(year), firstOfMonth(year, 1)), 1);
  return letIn(
    julyFirst,
    firstOfMonth(year, 7),
    letIn(halfDays, floorTo(div(days, 2), 0), gte(halfDays, 0)),
  );
}

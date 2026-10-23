import type { DateTerm, Formula, NumericTerm } from "../types";

// Arithmetic operators for rule-body expressions (including date subtraction).

/** Add two numeric terms, producing a numeric rule-body expression. */
export function add(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "add", args: [left, right] };
}

/** Subtract one numeric term from another. */
export function sub(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]>;
/**
 * Subtract a numeric duration in milliseconds from a date term, producing a
 * date expression.
 *
 * @example
 * ```ts
 * // The visit must fall within the 14 days before consent.
 * kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(
 *   and(
 *     consentDate({ patient: P, trial: T, date: ConsentDate }),
 *     visitDate({ patient: P, date: VisitDate }),
 *     gte(VisitDate, sub(ConsentDate, 14 * dayMs)),
 *     lte(VisitDate, ConsentDate),
 *   ),
 * );
 * ```
 */
export function sub(
  left: DateTerm,
  right: NumericTerm,
): Formula<Date, readonly [DateTerm, NumericTerm]>;
export function sub(
  left: DateTerm | NumericTerm,
  right: NumericTerm,
): Formula<Date | number | bigint, readonly [DateTerm | NumericTerm, NumericTerm]> {
  return { kind: "sub", args: [left, right] };
}

/** Multiply two numeric terms, producing a numeric rule-body expression. */
export function mul(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "mul", args: [left, right] };
}

/** Divide one numeric term by another, producing a numeric rule-body expression. */
export function div(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "div", args: [left, right] };
}

/**
 * The number of whole calendar days from `earlier` to `later`: the difference of the
 * two dates' UTC calendar days, so times of day do not count and the result is a
 * signed integer, negative when `later` is the earlier date.
 *
 * @example
 * ```ts
 * // Lived in the home for more than half of a 365-day year: 183 days or more,
 * // counting both the first and the last day.
 * kb.rule(principalAbode({ person: P, year: Y })).if(
 *   and(
 *     stay({ person: P, from: From, to: To }),
 *     gte(add(daysBetween(To, From), 1), 183),
 *   ),
 * );
 * ```
 */
export function daysBetween(
  later: DateTerm,
  earlier: DateTerm,
): Formula<number | bigint, readonly [DateTerm, DateTerm]> {
  return { kind: "daysBetween", args: [later, earlier] };
}

/**
 * The number of whole calendar years from `earlier` to `later`, by anniversaries in
 * UTC: the difference of the years, less one when `later` falls before the
 * anniversary of `earlier` in its year. An anniversary of the 29th of February falls
 * on the 1st of March in a common year. The result is a signed integer, negative when
 * `later` is the earlier date, so a person's age on a day is
 * `yearsBetween(day, birthday)`.
 *
 * @example
 * ```ts
 * // Has attained age 65 by the close of the year.
 * kb.rule(aged({ person: P, year: Y })).if(
 *   and(
 *     born({ person: P, day: Birthday }),
 *     yearEnd({ year: Y, day: Close }),
 *     gte(yearsBetween(Close, Birthday), 65),
 *   ),
 * );
 * ```
 */
export function yearsBetween(
  later: DateTerm,
  earlier: DateTerm,
): Formula<number | bigint, readonly [DateTerm, DateTerm]> {
  return { kind: "yearsBetween", args: [later, earlier] };
}

/** The lesser of two numeric terms. */
export function min(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "min", args: [left, right] };
}

/** The greater of two numeric terms. */
export function max(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "max", args: [left, right] };
}

/**
 * The value rounded to a number of decimal places, halves away from zero: `roundTo(x, 0)`
 * is the nearest whole number, `roundTo(x, 2)` the nearest cent, and `roundTo(x, -3)` the
 * nearest thousand. A bigint is already whole and is unchanged for places of zero or more.
 *
 * @example
 * ```ts
 * // Tax is 15% of taxable income, in whole dollars.
 * kb.rule(tax({ person: P, amount: T })).if(
 *   and(taxableIncome({ person: P, amount: I }), letIn(T, roundTo(mul(I, 0.15), 0), gte(T, 0))),
 * );
 * ```
 */
export function roundTo(
  value: NumericTerm,
  places: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "roundTo", args: [value, places] };
}

/** The value rounded down (toward negative infinity) to a number of decimal places. */
export function floorTo(
  value: NumericTerm,
  places: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "floorTo", args: [value, places] };
}

/**
 * The value rounded up (toward positive infinity) to a number of decimal places.
 *
 * @example
 * ```ts
 * // Two percentage points for each $2,500, or fraction thereof, of the excess.
 * letIn(Points, mul(2, ceilTo(div(Excess, 2500), 0)), lte(Points, 100))
 * ```
 */
export function ceilTo(
  value: NumericTerm,
  places: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "ceilTo", args: [value, places] };
}

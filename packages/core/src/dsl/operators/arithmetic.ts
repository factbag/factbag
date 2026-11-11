import { assertSupportedValue } from "../assert-supported-value";
import type { DateTerm, Formula, NumericTerm } from "../types";

// Arithmetic operators for rule-body expressions (including date subtraction).

/** Add two numeric terms, producing a numeric rule-body expression. */
export function add(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "add", args: [left, right] };
}

/** Subtract one numeric term from another. */
export function sub(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]>;
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
): Formula<Date | number, readonly [DateTerm | NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "sub", args: [left, right] };
}

/** Multiply two numeric terms, producing a numeric rule-body expression. */
export function mul(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "mul", args: [left, right] };
}

/** Divide one numeric term by another, producing a numeric rule-body expression. */
export function div(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "div", args: [left, right] };
}

/**
 * Count signed UTC calendar days from `earlier` to `later`, ignoring time of day.
 * Add one to count both the first and last day of a stay.
 */
export function daysBetween(
  later: DateTerm,
  earlier: DateTerm,
): Formula<number, readonly [DateTerm, DateTerm]> {
  assertSupportedValue(later);
  assertSupportedValue(earlier);
  return { kind: "daysBetween", args: [later, earlier] };
}

/**
 * Count signed whole years from `earlier` to `later` by UTC calendar anniversaries,
 * ignoring time of day. February 29 anniversaries fall on March 1 in common years.
 * A person's age on a day is `yearsBetween(day, birthday)`.
 */
export function yearsBetween(
  later: DateTerm,
  earlier: DateTerm,
): Formula<number, readonly [DateTerm, DateTerm]> {
  assertSupportedValue(later);
  assertSupportedValue(earlier);
  return { kind: "yearsBetween", args: [later, earlier] };
}

/**
 * The first day of a month at UTC midnight, from a whole year and a whole month from 1
 * (January) to 12. Other days of the year follow by date arithmetic.
 *
 * @example
 * ```ts
 * // The tax year Y runs from its first day to the day before the next year's.
 * letIn(First, firstOfMonth(Y, 1), letIn(Last, sub(firstOfMonth(add(Y, 1), 1), dayMs), ...))
 * ```
 */
export function firstOfMonth(
  year: NumericTerm,
  month: NumericTerm,
): Formula<Date, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(year);
  assertSupportedValue(month);
  return { kind: "firstOfMonth", args: [year, month] };
}

/**
 * The UTC calendar year of a date, for dates from the year 0 on: the whole years from
 * January 1 of the year 0, so it explains as that `yearsBetween`.
 *
 * @example
 * ```ts
 * // A death in an earlier year than Y.
 * and(died({ person: P, day: D }), gt(Y, yearOf(D)))
 * ```
 */
export function yearOf(date: DateTerm): Formula<number, readonly [DateTerm, DateTerm]> {
  return yearsBetween(date, firstOfMonth(0, 1));
}

/**
 * The lesser of two numeric terms.
 *
 * @example
 * ```ts
 * // Deduction reduction cannot exceed 80% of the deductions.
 * letIn(R, min(mul(0.03, Excess), mul(0.8, Deductions)), gte(R, 0))
 * ```
 */
export function min(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "min", args: [left, right] };
}

/**
 * The greater of two numeric terms.
 *
 * @example
 * ```ts
 * // The remaining allowance cannot be negative.
 * letIn(A, max(sub(2000, Reduction), 0), gte(A, 0))
 * ```
 */
export function max(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "max", args: [left, right] };
}

/**
 * Round to a whole number of decimal places, with halves away from zero.
 * Negative places round to tens, hundreds, and so on. Decimal exponent shifting
 * avoids multiplication artifacts such as `1.005 * 100`, so `roundTo(1.005, 2)`
 * yields `1.01`. Inputs and results still have JavaScript number precision;
 * this does not recover precision already lost in an earlier expression.
 *
 * @example
 * ```ts
 * // Tax is 15% of taxable income, in whole dollars.
 * letIn(Tax, roundTo(mul(Income, 0.15), 0), gte(Tax, 0))
 * ```
 */
export function roundTo(
  value: NumericTerm,
  places: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(value);
  assertSupportedValue(places);
  return { kind: "roundTo", args: [value, places] };
}

/**
 * Round toward negative infinity at a whole number of decimal places.
 * Negative places and decimal exponent shifting work as in {@link roundTo}.
 *
 * @example
 * ```ts
 * // Only complete thousands of eligible expenses count.
 * letIn(Eligible, floorTo(Expenses, -3), gte(Eligible, 0))
 * ```
 */
export function floorTo(
  value: NumericTerm,
  places: NumericTerm,
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(value);
  assertSupportedValue(places);
  return { kind: "floorTo", args: [value, places] };
}

/**
 * Round toward positive infinity at a whole number of decimal places.
 * Negative places and decimal exponent shifting work as in {@link roundTo}.
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
): Formula<number, readonly [NumericTerm, NumericTerm]> {
  assertSupportedValue(value);
  assertSupportedValue(places);
  return { kind: "ceilTo", args: [value, places] };
}

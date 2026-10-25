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

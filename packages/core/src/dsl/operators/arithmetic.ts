import type { DateTerm, Formula, NumericTerm } from "../types";

// Arithmetic operators for rule-body expressions (including date subtraction).

/** Add two numeric terms, producing a numeric rule-body expression. */
export function add(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]> {
  return { kind: "add", args: [left, right] };
}

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
/** Subtract one numeric term from another. */
export function sub(
  left: NumericTerm,
  right: NumericTerm,
): Formula<number | bigint, readonly [NumericTerm, NumericTerm]>;
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

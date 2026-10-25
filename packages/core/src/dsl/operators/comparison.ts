import { assertSupportedValue } from "../assert-supported-value";
import type { ComparableTerm, EqualityTerm, Formula } from "../types";

// Comparison operators for rule-body side constraints.

/**
 * Require equal values: numbers, strings, and booleans by value, dates by instant,
 * and entities by type and id rather than instance.
 *
 * @remarks
 * Comparisons gate whether a rule fires but contribute no proof children.
 */
export function eq(
  left: EqualityTerm,
  right: EqualityTerm,
): Formula<boolean, readonly [EqualityTerm, EqualityTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "eq", args: [left, right] };
}

/** Require the two terms to differ, in the sense of {@link eq}. */
export function neq(
  left: EqualityTerm,
  right: EqualityTerm,
): Formula<boolean, readonly [EqualityTerm, EqualityTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "neq", args: [left, right] };
}

/**
 * Require the left term to be strictly greater than the right.
 *
 * @remarks
 * Comparisons are side constraints: they gate whether a rule fires but
 * contribute no proof children of their own.
 */
export function gt(
  left: ComparableTerm,
  right: ComparableTerm,
): Formula<boolean, readonly [ComparableTerm, ComparableTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "gt", args: [left, right] };
}

/** Require the left term to be greater than or equal to the right. */
export function gte(
  left: ComparableTerm,
  right: ComparableTerm,
): Formula<boolean, readonly [ComparableTerm, ComparableTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "gte", args: [left, right] };
}

/** Require the left term to be less than or equal to the right. */
export function lte(
  left: ComparableTerm,
  right: ComparableTerm,
): Formula<boolean, readonly [ComparableTerm, ComparableTerm]> {
  assertSupportedValue(left);
  assertSupportedValue(right);
  return { kind: "lte", args: [left, right] };
}

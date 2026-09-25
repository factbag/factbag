import type { ComparableTerm, Formula } from "../types";

// Comparison operators for rule-body side constraints.

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
  return { kind: "gt", args: [left, right] };
}

/** Require the left term to be greater than or equal to the right. */
export function gte(
  left: ComparableTerm,
  right: ComparableTerm,
): Formula<boolean, readonly [ComparableTerm, ComparableTerm]> {
  return { kind: "gte", args: [left, right] };
}

/** Require the left term to be less than or equal to the right. */
export function lte(
  left: ComparableTerm,
  right: ComparableTerm,
): Formula<boolean, readonly [ComparableTerm, ComparableTerm]> {
  return { kind: "lte", args: [left, right] };
}

import { assert } from "../assert";
import { assertIsAtom, isAtom } from "./atom";
import type { Atom } from "./atom";
import { assertIsExpression, isExpression } from "./expression";
import type { Expression } from "./expression";
import { assertIsArrayOf, assertIsShape, isArrayOf, isShape } from "../shape";
import type { Shape } from "../shape";
import { assertIsVariable, isVariable } from "./variable";
import type { Variable } from "./variable";

/**
 * A rule-body condition: an atom, a negated atom, or a formula whose kind is
 * its operator. Arguments are positional, as the DSL builds them.
 */
export type Condition = Atom | Not | Connective | Exists | LetIn | Comparison;

/** Requires explicit evidence against an atom. */
export type Not = Shape<"not"> & Readonly<{ atom: Atom }>;

/** Holds when every (`and`) or any (`or`) argument holds. */
export type Connective = Shape<"and" | "or"> & Readonly<{ args: readonly Condition[] }>;

/** Holds when the last argument holds for some values of the variables before it. */
export type Exists = Shape<"exists"> &
  Readonly<{ args: readonly [...(readonly Variable[]), Condition] }>;

/** Binds a variable to an expression's value for the condition that follows. */
export type LetIn = Shape<"letIn"> & Readonly<{ args: readonly [Variable, Expression, Condition] }>;

/** Compares two expressions. */
export type Comparison = Shape<ComparisonKind> &
  Readonly<{ args: readonly [Expression, Expression] }>;

/** The comparison operations. The solver evaluates `lt`, though the DSL does not emit it. */
export type ComparisonKind = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";

/** Every comparison operation. */
export const COMPARISON_KINDS: readonly ComparisonKind[] = ["eq", "neq", "lt", "lte", "gt", "gte"];

/** Return whether a value is a rule-body condition. */
export function isCondition(value: unknown): value is Condition {
  if (isAtom(value)) {
    return true;
  }
  if (isShape(value, "not")) {
    return isAtom(value["atom"]);
  }
  const args: unknown = isShape(value, "and", "or", "exists", "letIn", ...COMPARISON_KINDS)
    ? value["args"]
    : undefined;
  if (!Array.isArray(args)) {
    return false;
  }
  if (isShape(value, "and", "or")) {
    return isArrayOf(args, isCondition);
  }
  if (isShape(value, "exists")) {
    return args.length > 0 && isArrayOf(args.slice(0, -1), isVariable) && isCondition(args.at(-1));
  }
  if (isShape(value, "letIn")) {
    return (
      args.length === 3 && isVariable(args[0]) && isExpression(args[1]) && isCondition(args[2])
    );
  }
  return args.length === 2 && isArrayOf(args, isExpression);
}

/** Assert that a value is a rule-body condition. */
export function assertIsCondition(value: unknown): asserts value is Condition {
  if (isShape(value, "atom")) {
    assertIsAtom(value);
    return;
  }
  if (isShape(value, "not")) {
    assertIsAtom(value["atom"]);
    return;
  }
  assertIsShape(value, "and", "or", "exists", "letIn", ...COMPARISON_KINDS);
  const args: unknown = value["args"];
  assert(Array.isArray(args));
  if (isShape(value, "and", "or")) {
    assertIsArrayOf(args, assertIsCondition);
    return;
  }
  if (isShape(value, "exists")) {
    assert(args.length > 0);
    assertIsArrayOf(args.slice(0, -1), assertIsVariable);
    assertIsCondition(args.at(-1));
    return;
  }
  if (isShape(value, "letIn")) {
    assert(args.length === 3);
    assertIsVariable(args[0]);
    assertIsExpression(args[1]);
    assertIsCondition(args[2]);
    return;
  }
  assert(args.length === 2);
  assertIsArrayOf(args, assertIsExpression);
}

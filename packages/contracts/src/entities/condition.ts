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
 * its operator.
 */
export type Condition = Atom | Not | Connective | Exists | LetIn | Comparison;

/** Requires explicit evidence against an atom. */
export type Not = Shape<"not"> & Readonly<{ atom: Atom }>;

/** Holds when every (`and`) or any (`or`) of its conditions holds. */
export type Connective = Shape<"and" | "or"> & Readonly<{ conditions: readonly Condition[] }>;

/** Holds when the condition holds for some values of the variables. */
export type Exists = Shape<"exists"> &
  Readonly<{ variables: readonly Variable[]; condition: Condition }>;

/** Binds a variable to an expression's value for the condition that follows. */
export type LetIn = Shape<"letIn"> &
  Readonly<{ variable: Variable; value: Expression; condition: Condition }>;

/** Compares two expressions. */
export type Comparison = Shape<ComparisonKind> & Readonly<{ left: Expression; right: Expression }>;

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
  if (isShape(value, "and", "or")) {
    return isArrayOf(value["conditions"], isCondition);
  }
  if (isShape(value, "exists")) {
    return isArrayOf(value["variables"], isVariable) && isCondition(value["condition"]);
  }
  if (isShape(value, "letIn")) {
    return (
      isVariable(value["variable"]) &&
      isExpression(value["value"]) &&
      isCondition(value["condition"])
    );
  }
  return (
    isShape(value, ...COMPARISON_KINDS) &&
    isExpression(value["left"]) &&
    isExpression(value["right"])
  );
}

/** Assert that a value is a rule-body condition. */
export function assertIsCondition(value: unknown): asserts value is Condition {
  if (isShape(value, "atom")) {
    assertIsAtom(value);
  } else if (isShape(value, "not")) {
    assertIsAtom(value["atom"]);
  } else if (isShape(value, "and", "or")) {
    assertIsArrayOf(value["conditions"], assertIsCondition);
  } else if (isShape(value, "exists")) {
    assertIsArrayOf(value["variables"], assertIsVariable);
    assertIsCondition(value["condition"]);
  } else if (isShape(value, "letIn")) {
    assertIsVariable(value["variable"]);
    assertIsExpression(value["value"]);
    assertIsCondition(value["condition"]);
  } else {
    assertIsShape(value, ...COMPARISON_KINDS);
    assertIsExpression(value["left"]);
    assertIsExpression(value["right"]);
  }
}

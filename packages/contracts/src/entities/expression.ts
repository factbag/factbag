import { assert } from "../assert";
import { isPlainObject } from "../is-plain-object";
import { assertIsCondition, isCondition } from "./condition";
import type { Condition } from "./condition";
import { assertIsArrayOf, assertIsOptional, isArrayOf, isShape } from "../shape";
import type { Shape } from "../shape";
import { assertIsTerm, isTerm } from "./term";
import type { Term } from "./term";

/**
 * A value-producing expression in a rule body: a term, or a formula whose
 * kind is its operator.
 */
export type Expression = Term | Arithmetic | Aggregate;

/** Applies a primitive operation to two expressions. */
export type Arithmetic = Shape<ArithmeticKind> &
  Readonly<{ args: readonly [Expression, Expression] }>;

/**
 * Totals (`sum`) or counts (`count`) the first argument over every way the
 * condition holds, optionally stating when the matches are known to be complete.
 */
export type Aggregate = Shape<"sum" | "count"> &
  Readonly<{
    args: readonly [Expression, Condition] | readonly [Expression, Condition, CompleteWhen];
  }>;

/** An aggregate's options: the condition under which its matches are complete. */
export type CompleteWhen = Readonly<{ completeWhen: Condition }>;

/** The primitive arithmetic operations. */
export type ArithmeticKind =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "daysBetween"
  | "yearsBetween"
  | "min"
  | "max"
  | "roundTo"
  | "floorTo"
  | "ceilTo";

/** Every primitive arithmetic operation. */
export const ARITHMETIC_KINDS: readonly ArithmeticKind[] = [
  "add",
  "sub",
  "mul",
  "div",
  "daysBetween",
  "yearsBetween",
  "min",
  "max",
  "roundTo",
  "floorTo",
  "ceilTo",
];

/** Return whether a value is an expression. */
export function isExpression(value: unknown): value is Expression {
  if (isTerm(value)) {
    return true;
  }
  const args: unknown = isShape(value, "sum", "count", ...ARITHMETIC_KINDS)
    ? value["args"]
    : undefined;
  if (!Array.isArray(args)) {
    return false;
  }
  if (isShape(value, "sum", "count")) {
    return (
      (args.length === 2 || (args.length === 3 && isCompleteWhen(args[2]))) &&
      isExpression(args[0]) &&
      isCondition(args[1])
    );
  }
  return args.length === 2 && isArrayOf(args, isExpression);
}

/** Assert that a value is an expression. */
export function assertIsExpression(value: unknown): asserts value is Expression {
  if (!isShape(value, "sum", "count", ...ARITHMETIC_KINDS)) {
    assertIsTerm(value);
    return;
  }
  const args: unknown = value["args"];
  assert(Array.isArray(args));
  if (isShape(value, "sum", "count")) {
    assert(args.length === 2 || args.length === 3);
    assertIsExpression(args[0]);
    assertIsCondition(args[1]);
    assertIsOptional(args[2], assertIsCompleteWhen);
    return;
  }
  assert(args.length === 2);
  assertIsArrayOf(args, assertIsExpression);
}

function isCompleteWhen(value: unknown): value is CompleteWhen {
  return isPlainObject(value) && isCondition(value["completeWhen"]);
}

function assertIsCompleteWhen(value: unknown): asserts value is CompleteWhen {
  assert(isPlainObject(value));
  assertIsCondition(value["completeWhen"]);
}

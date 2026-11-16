import { assertIsCondition, isCondition } from "./condition";
import type { Condition } from "./condition";
import { assertIsOptional, isShape } from "../shape";
import type { Shape } from "../shape";
import { assertIsTerm, isTerm } from "./term";
import type { Term } from "./term";

/**
 * A value-producing expression in a rule body: a term, or a formula whose
 * kind is its operator.
 */
export type Expression = Term | Arithmetic | Aggregate;

/** Applies a primitive operation to two expressions. */
export type Arithmetic = Shape<ArithmeticKind> & Readonly<{ left: Expression; right: Expression }>;

/**
 * Totals (`sum`) or counts (`count`) `value` over every way the `where`
 * condition holds. `completeWhen` states when those matches are known to be
 * complete.
 */
export type Aggregate = Shape<"sum" | "count"> &
  Readonly<{ value: Expression; where: Condition; completeWhen?: Condition }>;

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
  if (isShape(value, "sum", "count")) {
    return (
      isExpression(value["value"]) &&
      isCondition(value["where"]) &&
      (value["completeWhen"] === undefined || isCondition(value["completeWhen"]))
    );
  }
  return (
    isShape(value, ...ARITHMETIC_KINDS) &&
    isExpression(value["left"]) &&
    isExpression(value["right"])
  );
}

/** Assert that a value is an expression. */
export function assertIsExpression(value: unknown): asserts value is Expression {
  if (isShape(value, "sum", "count")) {
    assertIsExpression(value["value"]);
    assertIsCondition(value["where"]);
    assertIsOptional(value["completeWhen"], assertIsCondition);
  } else if (isShape(value, ...ARITHMETIC_KINDS)) {
    assertIsExpression(value["left"]);
    assertIsExpression(value["right"]);
  } else {
    assertIsTerm(value);
  }
}

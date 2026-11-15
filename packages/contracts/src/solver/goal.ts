import { assert } from "../assert";
import { assertIsAtom, isAtom } from "../entities/atom";
import type { Atom } from "../entities/atom";
import { COMPARISON_KINDS } from "../entities/condition";
import type { ComparisonKind } from "../entities/condition";
import { ARITHMETIC_KINDS } from "../entities/expression";
import type { ArithmeticKind } from "../entities/expression";
import { assertIsArrayOf, assertIsOptional, assertIsShape, isArrayOf, isShape } from "../shape";
import type { Shape } from "../shape";
import { assertIsTerm, isTerm } from "../entities/term";
import type { Term } from "../entities/term";
import { assertIsVariable, isVariable } from "../entities/variable";
import type { Variable } from "../entities/variable";

/**
 * What a solver evaluated to reach a judgment: a rule-body condition in the
 * solver's normal form, where every computed value is bound to a variable.
 * `op` says which.
 */
export type Goal =
  | AtomGoal
  | NotGoal
  | ConnectiveGoal
  | ExistsGoal
  | LetGoal
  | ArithmeticGoal
  | ComparisonGoal
  | SumGoal
  | CountGoal;

type GoalShape<Op extends string> = Shape<"goal"> & Readonly<{ op: Op }>;

/** Evaluate an atom. */
export type AtomGoal = GoalShape<"atom"> & Readonly<{ atom: Atom }>;

/** Require evidence against a goal. */
export type NotGoal = GoalShape<"not"> & Readonly<{ goal: Goal }>;

/** Prove every (`and`) or any (`or`) child goal. */
export type ConnectiveGoal = GoalShape<"and" | "or"> & Readonly<{ goals: readonly Goal[] }>;

/** Prove a goal for some values of the variables. */
export type ExistsGoal = GoalShape<"exists"> &
  Readonly<{ variables: readonly Variable[]; goal: Goal }>;

/** Bind a variable to a value, then prove a goal. */
export type LetGoal = GoalShape<"let"> & Readonly<{ variable: Variable; value: Term; goal: Goal }>;

/** Bind a variable to the result of a primitive operation on two terms. */
export type ArithmeticGoal = GoalShape<ArithmeticKind> &
  Readonly<{ bind: Variable; left: Term; right: Term }>;

/** Compare two terms. */
export type ComparisonGoal = GoalShape<ComparisonKind> & Readonly<{ left: Term; right: Term }>;

/** Bind a variable to the total of a term over every way a goal holds. */
export type SumGoal = GoalShape<"sum"> &
  Readonly<{ bind: Variable; value: Term; where: Goal; completeWhen?: Goal }>;

/** Bind a variable to the number of ways a goal holds. */
export type CountGoal = GoalShape<"count"> &
  Readonly<{ bind: Variable; where: Goal; completeWhen?: Goal }>;

/** Return whether a value is a goal. */
export function isGoal(value: unknown): value is Goal {
  if (!isShape(value, "goal")) {
    return false;
  }
  const op = value["op"];
  switch (op) {
    case "atom":
      return isAtom(value["atom"]);
    case "not":
      return isGoal(value["goal"]);
    case "and":
    case "or":
      return isArrayOf(value["goals"], isGoal);
    case "exists":
      return isArrayOf(value["variables"], isVariable) && isGoal(value["goal"]);
    case "let":
      return isVariable(value["variable"]) && isTerm(value["value"]) && isGoal(value["goal"]);
    case "sum":
      return isAggregateGoal(value) && isTerm(value["value"]);
    case "count":
      return isAggregateGoal(value);
    default:
      if (!isTerm(value["left"]) || !isTerm(value["right"])) {
        return false;
      }
      return ARITHMETIC_KINDS.some((kind) => kind === op)
        ? isVariable(value["bind"])
        : COMPARISON_KINDS.some((kind) => kind === op);
  }
}

/** Assert that a value is a goal. */
export function assertIsGoal(value: unknown): asserts value is Goal {
  assertIsShape(value, "goal");
  const op = value["op"];
  switch (op) {
    case "atom":
      assertIsAtom(value["atom"]);
      return;
    case "not":
      assertIsGoal(value["goal"]);
      return;
    case "and":
    case "or":
      assertIsArrayOf(value["goals"], assertIsGoal);
      return;
    case "exists":
      assertIsArrayOf(value["variables"], assertIsVariable);
      assertIsGoal(value["goal"]);
      return;
    case "let":
      assertIsVariable(value["variable"]);
      assertIsTerm(value["value"]);
      assertIsGoal(value["goal"]);
      return;
    case "sum":
      assertIsAggregateGoal(value);
      assertIsTerm(value["value"]);
      return;
    case "count":
      assertIsAggregateGoal(value);
      return;
    default:
      assertIsTerm(value["left"]);
      assertIsTerm(value["right"]);
      if (ARITHMETIC_KINDS.some((kind) => kind === op)) {
        assertIsVariable(value["bind"]);
      } else {
        assert(COMPARISON_KINDS.some((kind) => kind === op));
      }
  }
}

function isAggregateGoal(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isVariable(value["bind"]) &&
    isGoal(value["where"]) &&
    (value["completeWhen"] === undefined || isGoal(value["completeWhen"]))
  );
}

function assertIsAggregateGoal(value: Readonly<Record<string, unknown>>): void {
  assertIsVariable(value["bind"]);
  assertIsGoal(value["where"]);
  assertIsOptional(value["completeWhen"], assertIsGoal);
}

import { assert } from "../assert";
import { isPlainObject } from "../is-plain-object";
import { assertIsGoal, isGoal } from "./goal";
import type { AtomGoal, Goal } from "./goal";
import { assertIsLiteral, isLiteral } from "../entities/literal";
import type { Literal } from "../entities/literal";
import { assertIsRule, isRule } from "../entities/rule";
import type { Rule } from "../entities/rule";
import {
  assertIsArrayOf,
  assertIsOptional,
  assertIsShape,
  assertIsString,
  isArrayOf,
  isShape,
} from "../shape";
import type { Shape } from "../shape";
import { assertIsValue, isValue } from "../entities/value";
import type { InfiniteNumber, Value } from "../entities/value";
import { assertIsVariable, isVariable } from "../entities/variable";
import type { Variable } from "../entities/variable";

/** The four values a goal can have. */
export type TruthValue = "true" | "false" | "unknown" | "conflicted";

/**
 * A solver's verdict on one goal, with the proof behind it. `positive` holds
 * what supports the goal, `negative` what refutes it, and `inconclusive` the
 * derivations that could not settle it.
 */
export type Judgment = Readonly<{
  goal: Goal;
  value: TruthValue;
  /** The variable assignments in scope for this goal. */
  bindings: readonly Binding[];
  positive?: readonly Support[];
  negative?: readonly Support[];
  inconclusive?: readonly Support[];
}>;

/** The judgment a query returns: its goal is the ground atom that was asked about or matched. */
export type QueryJudgment = Judgment & Readonly<{ goal: AtomGoal }>;

/** One variable assignment. */
export type Binding = readonly [variable: Variable, value: BoundValue];

/** What a variable can be bound to: a value, or a count that is not exactly known. */
export type BoundValue = Value | NumericRangeValue;

/** A count known only within bounds, with why it is not exact. */
export type NumericRangeValue = Shape<"numeric-range"> &
  NumericRange &
  Readonly<{ uncertainty: readonly Uncertainty[] }>;

/** Lower and upper bounds on a number; an unbounded side is infinite. */
export type NumericRange = Readonly<{
  lower: number | InfiniteNumber;
  upper: number | InfiniteNumber;
}>;

/** Why a result is not exact. */
export type Uncertainty =
  | (Shape<"conflict" | "unknown"> & Readonly<{ count?: number }>)
  | Shape<"open-world">
  | MissingBinding;

/** A variable an operation needed had no binding. */
export type MissingBinding = Shape<"missing-binding"> & Readonly<{ variable: Variable }>;

/** One reason for a judgment's value. `source` says which. */
export type Support =
  | EvidenceSupport
  | ClosedWorldAbsenceSupport
  | RuleSupport
  | SubgoalsSupport
  | PrimitiveSupport;

type SupportShape<Source extends string> = Readonly<{ source: Source }>;

/** Stored evidence for or against the atom. */
export type EvidenceSupport = SupportShape<"evidence"> & Readonly<{ literals: readonly Literal[] }>;

/** A closed-world predicate has no evidence for the atom. */
export type ClosedWorldAbsenceSupport = SupportShape<"closed-world-absence">;

/** A rule whose head matches the atom, with the judgment of its body. */
export type RuleSupport = SupportShape<"rule"> & Readonly<{ rule: Rule; body: Judgment }>;

/** The judgments of a compound goal's children. */
export type SubgoalsSupport = SupportShape<"subgoals"> &
  Readonly<{ judgments: readonly Judgment[] }>;

/** The evaluation of an arithmetic, comparison, or aggregate goal. */
export type PrimitiveSupport = SupportShape<"primitive"> &
  Readonly<{ evaluation: PrimitiveEvaluation }>;

/** What a primitive operation was given and what it produced. */
export type PrimitiveEvaluation = Readonly<{
  operation: string;
  operands: readonly (BoundValue | MissingBinding)[];
  value: TruthValue;
  result?: BoundValue;
  results?: readonly Binding[];
  range?: NumericRange;
  uncertainty?: readonly Uncertainty[];
}>;

/** Return whether a value is a judgment. */
export function isJudgment(value: unknown): value is Judgment {
  return (
    isPlainObject(value) &&
    isGoal(value["goal"]) &&
    isTruthValue(value["value"]) &&
    isArrayOf(value["bindings"], isBinding) &&
    isOptional(value["positive"], isSupports) &&
    isOptional(value["negative"], isSupports) &&
    isOptional(value["inconclusive"], isSupports)
  );
}

/** Assert that a value is a judgment. */
export function assertIsJudgment(value: unknown): asserts value is Judgment {
  assert(isPlainObject(value));
  assertIsGoal(value["goal"]);
  assertIsTruthValue(value["value"]);
  assertIsArrayOf(value["bindings"], assertIsBinding);
  assertIsOptional(value["positive"], assertIsSupports);
  assertIsOptional(value["negative"], assertIsSupports);
  assertIsOptional(value["inconclusive"], assertIsSupports);
}

function isTruthValue(value: unknown): value is TruthValue {
  return value === "true" || value === "false" || value === "unknown" || value === "conflicted";
}

function isOptional<Type>(
  value: unknown,
  isType: (present: unknown) => present is Type,
): value is Type | undefined {
  return value === undefined || isType(value);
}

function isSupports(value: unknown): value is readonly Support[] {
  return isArrayOf(value, isSupport);
}

function isSupport(value: unknown): value is Support {
  if (!isPlainObject(value)) {
    return false;
  }
  switch (value["source"]) {
    case "evidence":
      return isArrayOf(value["literals"], isLiteral);
    case "closed-world-absence":
      return true;
    case "rule":
      return isRule(value["rule"]) && isJudgment(value["body"]);
    case "subgoals":
      return isArrayOf(value["judgments"], isJudgment);
    case "primitive":
      return isPrimitiveEvaluation(value["evaluation"]);
    default:
      return false;
  }
}

function isPrimitiveEvaluation(value: unknown): value is PrimitiveEvaluation {
  return (
    isPlainObject(value) &&
    typeof value["operation"] === "string" &&
    isArrayOf(value["operands"], isOperand) &&
    isTruthValue(value["value"]) &&
    isOptional(value["result"], isBoundValue) &&
    isOptional(value["results"], isBindings) &&
    isOptional(value["range"], isNumericRange) &&
    isOptional(value["uncertainty"], isUncertainties)
  );
}

function isBindings(value: unknown): value is readonly Binding[] {
  return isArrayOf(value, isBinding);
}

function isBinding(value: unknown): value is Binding {
  return (
    Array.isArray(value) && value.length === 2 && isVariable(value[0]) && isBoundValue(value[1])
  );
}

function isBoundValue(value: unknown): value is BoundValue {
  return (
    isValue(value) ||
    (isShape(value, "numeric-range") &&
      isNumericRange(value) &&
      isUncertainties(value["uncertainty"]))
  );
}

function isOperand(value: unknown): value is BoundValue | MissingBinding {
  return isBoundValue(value) || isMissingBinding(value);
}

function isNumericRange(value: unknown): value is NumericRange {
  return isPlainObject(value) && isBound(value["lower"]) && isBound(value["upper"]);
}

function isBound(value: unknown): value is number | InfiniteNumber {
  return isValue(value) && (typeof value === "number" || isShape(value, "number"));
}

function isUncertainties(value: unknown): value is readonly Uncertainty[] {
  return isArrayOf(value, isUncertainty);
}

function isUncertainty(value: unknown): value is Uncertainty {
  if (isShape(value, "conflict", "unknown")) {
    return value["count"] === undefined || typeof value["count"] === "number";
  }
  return isShape(value, "open-world") || isMissingBinding(value);
}

function isMissingBinding(value: unknown): value is MissingBinding {
  return isShape(value, "missing-binding") && isVariable(value["variable"]);
}

function assertIsTruthValue(value: unknown): asserts value is TruthValue {
  assert(isTruthValue(value));
}

function assertIsSupports(value: unknown): asserts value is readonly Support[] {
  assertIsArrayOf(value, assertIsSupport);
}

function assertIsSupport(value: unknown): asserts value is Support {
  assert(isPlainObject(value));
  switch (value["source"]) {
    case "evidence":
      assertIsArrayOf(value["literals"], assertIsLiteral);
      return;
    case "rule":
      assertIsRule(value["rule"]);
      assertIsJudgment(value["body"]);
      return;
    case "subgoals":
      assertIsArrayOf(value["judgments"], assertIsJudgment);
      return;
    case "primitive":
      assertIsPrimitiveEvaluation(value["evaluation"]);
      return;
    default:
      assert(value["source"] === "closed-world-absence");
  }
}

function assertIsPrimitiveEvaluation(value: unknown): asserts value is PrimitiveEvaluation {
  assert(isPlainObject(value));
  assertIsString(value["operation"]);
  assertIsArrayOf(value["operands"], assertIsOperand);
  assertIsTruthValue(value["value"]);
  assertIsOptional(value["result"], assertIsBoundValue);
  assertIsOptional(value["results"], assertIsBindings);
  assertIsOptional(value["range"], assertIsNumericRange);
  assertIsOptional(value["uncertainty"], assertIsUncertainties);
}

function assertIsBindings(value: unknown): asserts value is readonly Binding[] {
  assertIsArrayOf(value, assertIsBinding);
}

function assertIsBinding(value: unknown): asserts value is Binding {
  assert(Array.isArray(value) && value.length === 2);
  assertIsVariable(value[0]);
  assertIsBoundValue(value[1]);
}

function assertIsBoundValue(value: unknown): asserts value is BoundValue {
  if (isShape(value, "numeric-range")) {
    assertIsNumericRange(value);
    assertIsUncertainties(value["uncertainty"]);
  } else {
    assertIsValue(value);
  }
}

function assertIsOperand(value: unknown): asserts value is BoundValue | MissingBinding {
  if (isShape(value, "missing-binding")) {
    assertIsMissingBinding(value);
  } else {
    assertIsBoundValue(value);
  }
}

function assertIsNumericRange(value: unknown): asserts value is NumericRange {
  assert(isPlainObject(value));
  assertIsBound(value["lower"]);
  assertIsBound(value["upper"]);
}

function assertIsBound(value: unknown): asserts value is number | InfiniteNumber {
  assert(typeof value === "number" || isShape(value, "number"));
  assertIsValue(value);
}

function assertIsUncertainties(value: unknown): asserts value is readonly Uncertainty[] {
  assertIsArrayOf(value, assertIsUncertainty);
}

function assertIsUncertainty(value: unknown): asserts value is Uncertainty {
  if (isShape(value, "conflict", "unknown")) {
    assertIsOptional(value["count"], assertIsNumber);
  } else if (isShape(value, "missing-binding")) {
    assertIsMissingBinding(value);
  } else {
    assertIsShape(value, "open-world");
  }
}

function assertIsMissingBinding(value: unknown): asserts value is MissingBinding {
  assertIsShape(value, "missing-binding");
  assertIsVariable(value["variable"]);
}

function assertIsNumber(value: unknown): asserts value is number {
  assert(typeof value === "number");
}

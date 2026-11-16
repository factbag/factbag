/**
 * JSON contracts for tool and persistence boundaries, with guards and asserts
 * for untrusted input. These shapes are separate from the current runtime DSL;
 * runtime conversion and serialization are not provided by this entrypoint.
 *
 * @packageDocumentation
 */
export { assertIsAtom, assertIsGroundAtom, isAtom, isGroundAtom } from "@factbag/contracts";
export type { Atom, GroundAtom } from "@factbag/contracts";
export type { Shape } from "@factbag/contracts";
export { assertIsCondition, isCondition } from "@factbag/contracts";
export type {
  ComparisonKind,
  Comparison,
  Condition,
  Connective,
  Exists,
  LetIn,
  Not,
} from "@factbag/contracts";
export { assertIsEntityRef, isEntityRef } from "@factbag/contracts";
export type { EntityRef } from "@factbag/contracts";
export { assertIsExpression, isExpression } from "@factbag/contracts";
export type { ArithmeticKind, Aggregate, Arithmetic, Expression } from "@factbag/contracts";
export { assertIsKnowledgeBaseDocument, isKnowledgeBaseDocument } from "@factbag/contracts";
export type { KnowledgeBaseDocument } from "@factbag/contracts";
export { assertIsLiteral, isLiteral } from "@factbag/contracts";
export type { Literal } from "@factbag/contracts";
export { assertIsPredicate, isPredicate } from "@factbag/contracts";
export type {
  EntityType,
  EnumType,
  EnumValue,
  FieldType,
  Predicate,
  ScalarType,
} from "@factbag/contracts";
export { assertIsRule, isRule } from "@factbag/contracts";
export type { Rule } from "@factbag/contracts";
export { assertIsTerm, isTerm } from "@factbag/contracts";
export type { Term } from "@factbag/contracts";
export { assertIsValue, isValue } from "@factbag/contracts";
export type { DateValue, InfiniteNumber, Value } from "@factbag/contracts";
export { assertIsVariable, isVariable } from "@factbag/contracts";
export type { Variable } from "@factbag/contracts";
export { assertIsGoal, isGoal } from "@factbag/contracts";
export type {
  ArithmeticGoal,
  AtomGoal,
  ComparisonGoal,
  ConnectiveGoal,
  CountGoal,
  ExistsGoal,
  Goal,
  LetGoal,
  NotGoal,
  SumGoal,
} from "@factbag/contracts";
export { assertIsJudgment, isJudgment } from "@factbag/contracts";
export type {
  Binding,
  BoundValue,
  ClosedWorldAbsenceSupport,
  EvidenceSupport,
  Judgment,
  MissingBinding,
  NumericRange,
  NumericRangeValue,
  PrimitiveEvaluation,
  PrimitiveSupport,
  QueryJudgment,
  RuleSupport,
  SubgoalsSupport,
  Support,
  TruthValue,
  Uncertainty,
} from "@factbag/contracts";
export { assertIsProgram, isProgram } from "@factbag/contracts";
export type { Program } from "@factbag/contracts";
export type { Solver } from "@factbag/contracts";

/**
 * Query evaluation: four-valued judgments over ground atoms, carrying full
 * proof-support trees that record how each value was reached.
 *
 * @packageDocumentation
 */
export { query, queryAll } from "./query";
export type { Binding, Bindings, GoalValue } from "../types/common";
export type {
  AddGoal,
  AndGoal,
  AnyAtomGoal,
  ArithmeticGoal,
  ArithmeticKind,
  AtomGoal,
  ComparisonGoal,
  CompoundGoal,
  CountGoal,
  DaysBetweenGoal,
  DivGoal,
  EqGoal,
  ExistsGoal,
  Goal,
  GoalExpression,
  GroundAtomGoal,
  GtGoal,
  GteGoal,
  LetGoal,
  LtGoal,
  LteGoal,
  MulGoal,
  NeqGoal,
  NotGoal,
  OrGoal,
  PrimitiveGoal,
  SubGoal,
  SumGoal,
  YearsBetweenGoal,
} from "../types/goal";
export type {
  ArithmeticPrimitiveSupport,
  ClosedWorldAbsenceSupport,
  ComparisonPrimitiveSupport,
  CountPrimitiveSupport,
  ErasedEvidenceSupport,
  ErasedRuleSupport,
  EvidenceSupport,
  Judgment,
  JudgmentBase,
  JudgmentSupportFor,
  MissingBinding,
  NumericRange,
  PrimitiveEvaluation,
  PrimitiveSupport,
  PrimitiveSupportFor,
  PrimitiveUncertainty,
  QueryAllJudgment,
  QueryJudgment,
  RuleSupport,
  SubgoalsSupport,
  SumPrimitiveSupport,
} from "../types/judgment";

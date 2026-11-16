/**
 * The plain data Factbag passes around and persists: predicates, atoms,
 * literals, rules, and the values inside them. Every shape is JSON data that
 * says what it is through its `kind`, and comes with a guard and an assert
 * for recognising it in untrusted input.
 *
 * @packageDocumentation
 */
export { assertIsAtom, assertIsGroundAtom, isAtom, isGroundAtom } from "./entities/atom";
export type { Atom, GroundAtom } from "./entities/atom";
export type { Shape } from "./shape";
export { assertIsCondition, isCondition } from "./entities/condition";
export type {
  ComparisonKind,
  Comparison,
  Condition,
  Connective,
  Exists,
  LetIn,
  Not,
} from "./entities/condition";
export { assertIsEntityRef, isEntityRef } from "./entities/entity";
export type { EntityRef } from "./entities/entity";
export { assertIsExpression, isExpression } from "./entities/expression";
export type {
  ArithmeticKind,
  Aggregate,
  Arithmetic,
  CompleteWhen,
  Expression,
} from "./entities/expression";
export { assertIsKnowledgeBaseDocument, isKnowledgeBaseDocument } from "./entities/knowledge-base";
export type { KnowledgeBaseDocument } from "./entities/knowledge-base";
export { assertIsLiteral, isLiteral } from "./entities/literal";
export type { Literal } from "./entities/literal";
export { assertIsPredicate, isPredicate } from "./entities/predicate";
export type {
  EntityType,
  EnumType,
  EnumValue,
  FieldType,
  Predicate,
  ScalarType,
} from "./entities/predicate";
export { assertIsRule, isRule } from "./entities/rule";
export type { Rule } from "./entities/rule";
export { assertIsTerm, isTerm } from "./entities/term";
export type { Term } from "./entities/term";
export { assertIsValue, isValue } from "./entities/value";
export type { DateValue, InfiniteNumber, Value } from "./entities/value";
export { assertIsVariable, isVariable } from "./entities/variable";
export type { Variable } from "./entities/variable";
export { assertIsGoal, isGoal } from "./solver/goal";
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
} from "./solver/goal";
export { assertIsJudgment, isJudgment } from "./solver/judgment";
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
} from "./solver/judgment";
export { assertIsProgram, isProgram } from "./entities/program";
export type { Program } from "./entities/program";
export type { Solver } from "./solver/solver";
export { COMPARISON_KINDS } from "./entities/condition";
export { ARITHMETIC_KINDS } from "./entities/expression";
export { assertIsEvidenceMetadata, isEvidenceMetadata } from "./entities/evidence-metadata";
export type { EvidenceMetadata } from "./entities/evidence-metadata";
export type { Annotations, AnnotationValue } from "./entities/annotations";
export { fieldAccepts, isEnumValue } from "./entities/predicate";
export type { PredicateMetadata, PredicateWorld } from "./entities/predicate";
export type { RuleKind } from "./entities/rule";
export { valueEquals } from "./entities/value";
export { isShape } from "./shape";
export {
  ExclusiveDefinitionProgrammerError,
  NameConflictProgrammerError,
  PrimitiveArithmeticProgrammerError,
  ProgrammerError,
  UnconstructiveRecursionProgrammerError,
  UnsafeUnboundVariableProgrammerError,
  UnsupportedPredicateError,
} from "./errors";
export type { NameKind } from "./errors";

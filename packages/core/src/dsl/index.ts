/**
 * The rule-building DSL: declare predicates and logic variables, construct
 * atoms, and compose rule bodies from formulas, operators, and aggregates.
 *
 * @packageDocumentation
 */
export { and, exists, letIn, not, or } from "./formula";
export { count, sum } from "./operators/aggregate";
export type { AggregateBuilder, ComparableTerm, DateTerm, NumericTerm } from "./types";
export {
  add,
  ceilTo,
  daysBetween,
  div,
  floorTo,
  max,
  min,
  mul,
  roundTo,
  sub,
  yearsBetween,
} from "./operators/arithmetic";
export { gt, gte, lte } from "./operators/comparison";
export { closedPredicate, predicate } from "./predicate";
export { enumeration } from "./enumeration";
export type {
  ClosedWorldPredicate,
  OpenWorldPredicate,
  Predicate,
  PredicateBase,
  PredicateDeclaration,
  PredicateMetadata,
  PredicateWorld,
} from "../types/predicate";
export type { Annotations, AnnotationValue } from "../types/annotations";
export { variable } from "./variable";
export type { Formula, Scalar, Term } from "./types";
export { assertAtomLike, assertGroundAtom } from "../types/atom";
export type {
  AnyAtom,
  Atom,
  GroundAtom,
  GroundFields,
  NonGroundAtom,
  PatternFields,
} from "../types/atom";
export type {
  Entity,
  EnumType,
  InferRuntime,
  PredicateSchema,
  RuntimeConstructor,
  RuntimeType,
} from "../types/schema";
export { Var } from "../types/variable";

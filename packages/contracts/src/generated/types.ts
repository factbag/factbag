// Generated from spec/main.tsp by scripts/generate.mjs. Do not edit.

/**
 * A string that names something: not empty and not only whitespace.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Name".
 */
export type Name = string;
/**
 * Which infinity.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "InfiniteNumberValue".
 */
export type InfiniteNumberValue = "Infinity" | "-Infinity";
/**
 * A field value in an atom: a ground value or a variable.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Term".
 */
export type Term = Value | Variable;
/**
 * A ground value. Strings, finite numbers, and booleans are written as
 * themselves; infinities, dates, and entities are tagged.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Value".
 */
export type Value = string | number | boolean | InfiniteNumber | DateValue | EntityRef;
/**
 * JSON data carried without interpretation.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "AnnotationValue".
 */
export type AnnotationValue =
  | null
  | boolean
  | number
  | string
  | AnnotationValue[]
  | RecordAnnotationValue;
/**
 * Whether evidence asserts or denies its atom.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Sign".
 */
export type Sign = "asserted" | "denied";
/**
 * A value an enum field may list.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EnumValue".
 */
export type EnumValue = string | number | InfiniteNumber | DateValue;
/**
 * The type of one predicate field.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "FieldType".
 */
export type FieldType = ScalarType | EnumType | EntityType;
/**
 * A field holding any string, number, boolean, or date.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ScalarType".
 */
export type ScalarType = "string" | "number" | "boolean" | "date";
/**
 * Whether absence of evidence counts as falsity (`closed`) or unknown (`open`).
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "PredicateWorld".
 */
export type PredicateWorld = "open" | "closed";
/**
 * The primitive arithmetic operations.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ArithmeticKind".
 */
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
/**
 * A value-producing expression in a rule body: a term, or a formula whose kind is its operator.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Expression".
 */
export type Expression = Term | Arithmetic | Aggregate;
/**
 * Whether an aggregate totals (`sum`) or counts (`count`) its matches.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "AggregateKind".
 */
export type AggregateKind = "sum" | "count";
/**
 * A rule-body condition: an atom, a negated atom, or a formula whose kind is its operator.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Condition".
 */
export type Condition = Atom | Not | Connective | Exists | LetIn | Comparison;
/**
 * Whether every argument must hold (`and`) or any (`or`).
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ConnectiveKind".
 */
export type ConnectiveKind = "and" | "or";
/**
 * The comparison operations.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ComparisonKind".
 */
export type ComparisonKind = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
/**
 * Rule semantics: `if` states a sufficient condition, `iff` a definition.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RuleKind".
 */
export type RuleKind = "if" | "iff";
/**
 * What a solver evaluates: a rule body in the solver's own normal form. `op` says which.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Goal".
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
/**
 * Whether the evidence disagrees (`conflict`) or is missing (`unknown`).
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "UnsettledKind".
 */
export type UnsettledKind = "conflict" | "unknown";
/**
 * Why a result is not exact.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Uncertainty".
 */
export type Uncertainty = UnsettledEvidence | OpenWorld | MissingBinding;
/**
 * The four values a goal can have.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "TruthValue".
 */
export type TruthValue = "true" | "false" | "unknown" | "conflicted";
/**
 * What a variable can be bound to: a value, or a count that is not exactly known.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "BoundValue".
 */
export type BoundValue = Value | NumericRangeValue;
/**
 * One reason for a judgment's value. `source` says which.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Support".
 */
export type Support =
  | EvidenceSupport
  | ClosedWorldAbsenceSupport
  | RuleSupport
  | SubgoalsSupport
  | PrimitiveSupport;

export interface FactbagContracts {
  [k: string]: unknown;
}
/**
 * A reference to an entity: its class name (`type`) and id.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EntityRef".
 */
export interface EntityRef {
  kind: "entity";
  type: Name;
  id: string;
}
/**
 * An infinite number. Finite numbers are written as JSON numbers.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "InfiniteNumber".
 */
export interface InfiniteNumber {
  kind: "number";
  value: InfiniteNumberValue;
}
/**
 * A date, as an ISO 8601 UTC string in the exact form JavaScript's `Date.prototype.toISOString` writes.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "DateValue".
 */
export interface DateValue {
  kind: "date";
  value: string;
}
/**
 * A logic variable. Names are scoped to one rule.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Variable".
 */
export interface Variable {
  kind: "var";
  name: Name;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordTerm".
 */
export interface RecordTerm {
  [k: string]: Term;
}
/**
 * An atom as rules and queries write it: a predicate name and, for each field, a value or a variable.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Atom".
 */
export interface Atom {
  kind: "atom";
  predicate: Name;
  fields: RecordTerm;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordValue".
 */
export interface RecordValue {
  [k: string]: Value;
}
/**
 * An atom with a value for every field and no variables, as evidence states it.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "GroundAtom".
 */
export interface GroundAtom {
  kind: "atom";
  predicate: Name;
  fields: RecordValue;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordFloat64".
 */
export interface RecordFloat64 {
  [k: string]: number;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordAnnotationValue".
 */
export interface RecordAnnotationValue {
  [k: string]: AnnotationValue;
}
/**
 * Where accepted evidence came from.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EvidenceMetadata".
 */
export interface EvidenceMetadata {
  /**
   * Name of the system or document the fact came from.
   */
  source?: string;
  /**
   * Quotation or reference into the supporting material.
   */
  citation?: string;
  /**
   * The asserter's stated reason for accepting the fact.
   */
  justification?: string;
  scores?: RecordFloat641;
  annotations?: RecordAnnotationValue1;
}
/**
 * Named numeric scores, stored without being combined or interpreted.
 */
export interface RecordFloat641 {
  [k: string]: number;
}
/**
 * Application-specific annotations, retained on supporting evidence in judgments.
 */
export interface RecordAnnotationValue1 {
  [k: string]: AnnotationValue;
}
/**
 * Accepted evidence: a ground atom asserted or denied, with where it came from.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Literal".
 */
export interface Literal {
  sign: Sign;
  atom: GroundAtom;
  metadata?: EvidenceMetadata;
}
/**
 * A field holding one of a fixed set of strings, numbers, or dates.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EnumType".
 */
export interface EnumType {
  kind: "enum";
  values: EnumValue[];
}
/**
 * A field holding entities of one class, named by `type`.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EntityType".
 */
export interface EntityType {
  kind: "entityType";
  type: Name;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordString".
 */
export interface RecordString {
  [k: string]: string;
}
/**
 * Domain guidance for interpreting a predicate, available to evidence producers.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "PredicateMetadata".
 */
export interface PredicateMetadata {
  description: string;
  instructions?: string;
  parameters?: RecordString;
  annotations?: RecordAnnotationValue;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RecordFieldType".
 */
export interface RecordFieldType {
  [k: string]: FieldType;
}
/**
 * A predicate declaration: its name, world, and the type of each field.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Predicate".
 */
export interface Predicate {
  name: Name;
  world: PredicateWorld;
  params: RecordFieldType;
  metadata?: PredicateMetadata;
}
/**
 * Applies a primitive operation to two expressions.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Arithmetic".
 */
export interface Arithmetic {
  kind: ArithmeticKind;
  left: Expression;
  right: Expression;
}
/**
 * Totals (`sum`) or counts (`count`) `value` over every way the `where`
 * condition holds.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Aggregate".
 */
export interface Aggregate {
  kind: AggregateKind;
  value: Expression;
  where: Condition;
  /**
   * When the matches are known to be complete.
   */
  completeWhen?: Atom | Not | Connective | Exists | LetIn | Comparison;
}
/**
 * Requires explicit evidence against an atom.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Not".
 */
export interface Not {
  kind: "not";
  atom: Atom;
}
/**
 * Holds when every (`and`) or any (`or`) of its conditions holds.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Connective".
 */
export interface Connective {
  kind: ConnectiveKind;
  conditions: Condition[];
}
/**
 * Holds when the condition holds for some values of the variables.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Exists".
 */
export interface Exists {
  kind: "exists";
  variables: Variable[];
  condition: Condition;
}
/**
 * Binds a variable to an expression's value for the condition that follows.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "LetIn".
 */
export interface LetIn {
  kind: "letIn";
  variable: Variable;
  value: Expression;
  condition: Condition;
}
/**
 * Compares two expressions.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Comparison".
 */
export interface Comparison {
  kind: ComparisonKind;
  left: Expression;
  right: Expression;
}
/**
 * A rule: the head holds `if` (or, for `iff`, exactly when) the body holds.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Rule".
 */
export interface Rule {
  kind: RuleKind;
  head: Atom;
  body: Condition;
}
/**
 * What a solver reasons over: the vocabulary, the accepted evidence, and the rules.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Program".
 */
export interface Program {
  /**
   * Every predicate the evidence and rules use, each name appearing once.
   */
  predicates: Predicate[];
  literals: Literal[];
  rules: Rule[];
}
/**
 * A whole knowledge base as a document: a versioned program plus its registered entities.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "KnowledgeBaseDocument".
 */
export interface KnowledgeBaseDocument {
  kind: "KnowledgeBase";
  /**
   * Format version.
   */
  apiVersion: "factbag/v1alpha1";
  /**
   * Entities registered with the knowledge base.
   */
  entities: EntityRef[];
  /**
   * Every predicate the evidence and rules use, each name appearing once.
   */
  predicates: Predicate[];
  literals: Literal[];
  rules: Rule[];
}
/**
 * A goal that is a single atom.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "AtomGoal".
 */
export interface AtomGoal {
  kind: "goal";
  op: "atom";
  atom: Atom;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "NotGoal".
 */
export interface NotGoal {
  kind: "goal";
  op: "not";
  goal: Goal;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ConnectiveGoal".
 */
export interface ConnectiveGoal {
  kind: "goal";
  op: ConnectiveKind;
  goals: Goal[];
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ExistsGoal".
 */
export interface ExistsGoal {
  kind: "goal";
  op: "exists";
  variables: Variable[];
  goal: Goal;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "LetGoal".
 */
export interface LetGoal {
  kind: "goal";
  op: "let";
  variable: Variable;
  value: Term;
  goal: Goal;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ArithmeticGoal".
 */
export interface ArithmeticGoal {
  kind: "goal";
  op: ArithmeticKind;
  bind: Variable;
  left: Term;
  right: Term;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ComparisonGoal".
 */
export interface ComparisonGoal {
  kind: "goal";
  op: ComparisonKind;
  left: Term;
  right: Term;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "SumGoal".
 */
export interface SumGoal {
  kind: "goal";
  op: "sum";
  bind: Variable;
  value: Term;
  where: Goal;
  completeWhen?: Goal;
}
/**
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "CountGoal".
 */
export interface CountGoal {
  kind: "goal";
  op: "count";
  bind: Variable;
  where: Goal;
  completeWhen?: Goal;
}
/**
 * A variable an operation needed had no binding.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "MissingBinding".
 */
export interface MissingBinding {
  kind: "missing-binding";
  variable: Variable;
}
/**
 * Evidence the result depends on is conflicted or unknown.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "UnsettledEvidence".
 */
export interface UnsettledEvidence {
  kind: UnsettledKind;
  count?: number;
}
/**
 * An open-world predicate may have matches that are not recorded.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "OpenWorld".
 */
export interface OpenWorld {
  kind: "open-world";
}
/**
 * Lower and upper bounds on a number; an unbounded side is infinite.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "NumericRange".
 */
export interface NumericRange {
  lower: number | InfiniteNumber;
  upper: number | InfiniteNumber;
}
/**
 * A count known only within bounds, with why it is not exact.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "NumericRangeValue".
 */
export interface NumericRangeValue {
  kind: "numeric-range";
  lower: number | InfiniteNumber;
  upper: number | InfiniteNumber;
  uncertainty: Uncertainty[];
}
/**
 * Stored evidence for or against the atom.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "EvidenceSupport".
 */
export interface EvidenceSupport {
  source: "evidence";
  literals: Literal[];
}
/**
 * A closed-world predicate has no evidence for the atom.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "ClosedWorldAbsenceSupport".
 */
export interface ClosedWorldAbsenceSupport {
  source: "closed-world-absence";
}
/**
 * A rule whose head matches the atom, with the judgment of its body.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "RuleSupport".
 */
export interface RuleSupport {
  source: "rule";
  rule: Rule;
  body: Judgment;
}
/**
 * A solver's verdict on one goal, with the proof behind it.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "Judgment".
 */
export interface Judgment {
  goal: Goal;
  value: TruthValue;
  /**
   * The variable assignments in scope for this goal.
   */
  bindings: [Variable, BoundValue][];
  /**
   * What supports the goal.
   */
  positive?: Support[];
  /**
   * What refutes the goal.
   */
  negative?: Support[];
  /**
   * The derivations that could not settle the goal.
   */
  inconclusive?: Support[];
}
/**
 * The judgments of a compound goal's children.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "SubgoalsSupport".
 */
export interface SubgoalsSupport {
  source: "subgoals";
  judgments: Judgment[];
}
/**
 * The evaluation of an arithmetic, comparison, or aggregate goal.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "PrimitiveSupport".
 */
export interface PrimitiveSupport {
  source: "primitive";
  evaluation: PrimitiveEvaluation;
}
/**
 * What a primitive operation was given and what it produced.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "PrimitiveEvaluation".
 */
export interface PrimitiveEvaluation {
  operation: string;
  operands: (BoundValue | MissingBinding)[];
  value: TruthValue;
  result?: BoundValue;
  results?: [Variable, BoundValue][];
  range?: NumericRange;
  uncertainty?: Uncertainty[];
}
/**
 * The judgment a query returns: its goal is the ground atom that was asked about or matched.
 *
 * This interface was referenced by `FactbagContracts`'s JSON-Schema
 * via the `definition` "QueryJudgment".
 */
export interface QueryJudgment {
  value: TruthValue;
  /**
   * The variable assignments in scope for this goal.
   */
  bindings: [Variable, BoundValue][];
  /**
   * What supports the goal.
   */
  positive?: Support[];
  /**
   * What refutes the goal.
   */
  negative?: Support[];
  /**
   * The derivations that could not settle the goal.
   */
  inconclusive?: Support[];
  goal: AtomGoal;
}

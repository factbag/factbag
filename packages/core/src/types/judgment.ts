import type {
  AnyAtomGoal,
  ArithmeticKind,
  AtomGoal,
  CompoundGoal,
  Goal,
  GroundAtomGoal,
  PrimitiveGoal,
} from "./goal";
import type { AnyLiteral, Literal } from "./literal";
import type { AnyRule, Rule } from "./rule";
import type { Bindings } from "./common";
import type { PredicateSchema } from "./schema";

/** Support from stored evidence for an atom goal. */
export type EvidenceSupport<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  readonly source: "evidence";
  readonly literals: readonly Literal<Schema>[];
}>;

/** Support from absence in a complete closed-world relation. */
export type ClosedWorldAbsenceSupport = Readonly<{
  readonly source: "closed-world-absence";
}>;

/** Support from firing a rule for an atom goal. */
export type RuleSupport<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  readonly source: "rule";
  readonly rule: Rule<Schema, unknown>;
  readonly body: Judgment;
}>;

/** Support from stored evidence after atom schema erasure. */
export type ErasedEvidenceSupport = Readonly<{
  readonly source: "evidence";
  readonly literals: readonly AnyLiteral[];
}>;

/** Support from firing a rule after atom schema erasure. */
export type ErasedRuleSupport = Readonly<{
  readonly source: "rule";
  readonly rule: AnyRule;
  readonly body: Judgment;
}>;

/** Support from recursively evaluating child goals of a compound goal. */
export type SubgoalsSupport = Readonly<{
  readonly source: "subgoals";
  readonly judgments: readonly Judgment[];
}>;

/** Support from directly evaluating a primitive goal. */
export type PrimitiveSupport = Readonly<{
  readonly source: "primitive";
  readonly evaluation: PrimitiveEvaluation;
}>;

/** A variable required by a primitive has no runtime binding on this branch. */
export type MissingBinding = Readonly<{
  readonly kind: "missing-binding";
  readonly variable: unknown;
}>;

/** Uniform summary for primitive operations, including aggregates and comparisons. */
export type PrimitiveEvaluation = Readonly<{
  readonly operation: string;
  readonly operands: readonly unknown[];
  readonly value: "true" | "false" | "unknown" | "conflicted";
  readonly result?: unknown;
  readonly results?: Bindings;
  readonly range?: NumericRange;
  readonly uncertainty?: readonly PrimitiveUncertainty[];
}>;

/** Numeric lower/upper bound produced or consumed by a primitive operation. */
export type NumericRange = Readonly<{
  readonly lower: number | bigint;
  readonly upper: number | bigint | "infinity";
}>;

/** Why a primitive evaluation is not exact. */
export type PrimitiveUncertainty =
  | Readonly<{ readonly kind: "conflict"; readonly count?: number }>
  | Readonly<{ readonly kind: "unknown"; readonly count?: number }>
  | MissingBinding
  | Readonly<{ readonly kind: "open-world" }>;

/** Support from directly evaluating an arithmetic binding goal. */
export type ArithmeticPrimitiveSupport = Readonly<{
  readonly source: "primitive";
  readonly operands: readonly [left: unknown, right: unknown];
  readonly results: Bindings;
}>;

/** Support from directly evaluating a comparison goal. */
export type ComparisonPrimitiveSupport = Readonly<{
  readonly source: "primitive";
  readonly operands: readonly [left: unknown, right: unknown];
}>;

/** Support from directly evaluating a sum aggregate goal. */
export type SumPrimitiveSupport = Readonly<{
  readonly source: "primitive";
  readonly values: readonly unknown[];
  readonly results: Bindings;
}>;

/** Support from directly evaluating a count aggregate goal. */
export type CountPrimitiveSupport = Readonly<{
  readonly source: "primitive";
  readonly matched: number;
  readonly results: Bindings;
}>;

/** Proof support for a primitive goal, narrowed to the support shape for the goal's kind. */
export type PrimitiveSupportFor<GoalType extends PrimitiveGoal> =
  | PrimitiveSupport
  | (GoalType["kind"] extends ArithmeticKind
      ? ArithmeticPrimitiveSupport
      : GoalType["kind"] extends "eq" | "neq" | "lt" | "lte" | "gt" | "gte"
        ? ComparisonPrimitiveSupport
        : GoalType["kind"] extends "sum"
          ? SumPrimitiveSupport
          : GoalType["kind"] extends "count"
            ? CountPrimitiveSupport
            : never);

/** Sources of support allowed for a specific goal shape. */
export type JudgmentSupportFor<GoalType extends Goal> =
  GoalType extends AtomGoal<infer Schema>
    ? EvidenceSupport<Schema> | ClosedWorldAbsenceSupport | RuleSupport<Schema>
    : GoalType extends AnyAtomGoal
      ? ErasedEvidenceSupport | ClosedWorldAbsenceSupport | ErasedRuleSupport
      : GoalType extends PrimitiveGoal
        ? PrimitiveSupportFor<GoalType>
        : GoalType extends CompoundGoal
          ? SubgoalsSupport
          : never;

/** The evaluated goal and in-scope variable bindings shared by every judgment. */
export type JudgmentBase<GoalType extends Goal> = Readonly<{
  readonly goal: GoalType;
  readonly bindings: Bindings;
}>;

/**
 * Positive and negative supports must match the judgment's goal value.
 *
 * `inconclusive` holds derivations that could not settle the value: at atom
 * goals, rule attempts whose bodies came back unknown; at compound and negated
 * goals whose value is unknown, the constituent subproofs. Unknown compounds
 * always carry their subgoals, so an unknown verdict remains traversable down
 * to the leaf atoms that are actually undetermined.
 */
export type Judgment<GoalType extends Goal = Goal> =
  | (JudgmentBase<GoalType> & {
      readonly value: "true";
      readonly positive: readonly JudgmentSupportFor<GoalType>[];
      readonly negative?: never;
      readonly inconclusive?: readonly JudgmentSupportFor<GoalType>[];
    })
  | (JudgmentBase<GoalType> & {
      readonly value: "false";
      readonly positive?: never;
      readonly negative: readonly JudgmentSupportFor<GoalType>[];
      readonly inconclusive?: readonly JudgmentSupportFor<GoalType>[];
    })
  | (JudgmentBase<GoalType> & {
      readonly value: "conflicted";
      readonly positive: readonly JudgmentSupportFor<GoalType>[];
      readonly negative: readonly JudgmentSupportFor<GoalType>[];
      readonly inconclusive?: readonly JudgmentSupportFor<GoalType>[];
    })
  | (JudgmentBase<GoalType> & {
      readonly value: "unknown";
      readonly positive?: never;
      readonly negative?: never;
      readonly inconclusive?: readonly JudgmentSupportFor<GoalType>[];
    });

/** Query result for one grounded atom goal. */
export type QueryJudgment<Schema extends PredicateSchema = PredicateSchema> = Judgment<
  GroundAtomGoal<Schema>
>;

/** Query-all result containing zero or more grounded atom judgments. */
export type QueryAllJudgment<Schema extends PredicateSchema = PredicateSchema> =
  readonly QueryJudgment<Schema>[];

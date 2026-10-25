import type { Atom } from "../types/atom";
import type { AnyLiteral, Literal } from "../types/literal";
import type { Entity, PredicateSchema } from "../types/schema";
import type { Rule } from "../types/rule";
import type { Var } from "../types/variable";

export type { Entity };

/** Predicate over stored literal handles. */
export type LiteralFilter = (literal: AnyLiteral) => boolean;

/** A scalar value accepted in example expressions. */
export type Scalar = string | number | boolean | Date;

/** A concrete value or logic variable used in formulas and examples. */
export type Term<Value = Scalar | Entity> = Value | Var;

/**
 * A rule-body expression descriptor built by the DSL operators (`and`, `or`,
 * `exists`, `letIn`, arithmetic, comparisons, aggregates) and evaluated by
 * the solver during query.
 */
export type Formula<Value, Args extends readonly unknown[]> = Readonly<{
  readonly kind: string;
  readonly args: Args;
  readonly __valueType?: Value;
}>;

/** Return whether an unknown value has the runtime shape of a formula. */
export function isFormula(
  value: unknown,
  kind?: string,
): value is Formula<unknown, readonly unknown[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "args" in value &&
    (kind === undefined || value.kind === kind) &&
    Array.isArray(value.args)
  );
}

export type FormulaArgumentInput<Value> = Value extends Scalar | Entity | Var
  ? Value
  : Value extends Atom<infer Schema extends PredicateSchema>
    ? Atom<Schema>
    : Value extends Literal<infer Schema extends PredicateSchema>
      ? Literal<Schema>
      : Value extends Formula<infer FormulaValue, infer Args>
        ? Formula<FormulaValue, Args>
        : never;

/** Preserve the concrete schema of a valid formula, atom, or literal rule body. */
export type RuleBodyInput<Body> =
  Body extends Formula<infer Value, infer Args>
    ? Formula<Value, Args>
    : Body extends Atom<infer Schema extends PredicateSchema>
      ? Atom<Schema>
      : Body extends Literal<infer Schema extends PredicateSchema>
        ? Literal<Schema>
        : never;

export type RuleBodyArgs<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: RuleBodyInput<Args[Index]>;
};

type ExistsArgumentInput<Value> = Value extends Var ? Value : RuleBodyInput<Value>;

export type ExistsArgs<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: ExistsArgumentInput<Args[Index]>;
};

/** Preserve a literal's schema while rejecting non-literal arguments. */
type LiteralInput<Value> =
  Value extends Literal<infer Schema extends PredicateSchema> ? Literal<Schema> : never;

/** Validate each literal in a variadic argument list without erasing its schema. */
export type LiteralArgs<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: LiteralInput<Args[Index]>;
};

/** Numeric term accepted by arithmetic, comparisons, and aggregate helpers. */
export type NumericTerm = number | Var | Formula<number, readonly unknown[]>;

/** Date term accepted by date comparisons and date-offset arithmetic. */
export type DateTerm = Date | Var | Formula<Date, readonly unknown[]>;

/** Term accepted by comparison helpers. */
export type ComparableTerm = NumericTerm | DateTerm;

/** Aggregate builder returned by sum(...) and count(...). */
export type AggregateBuilder<Value extends number = number> = Readonly<{
  where: (<const Body>(body: Body & RuleBodyInput<Body>) => Formula<Value, readonly [Body]>) &
    (<const Body, const CompleteWhen>(
      body: Body & RuleBodyInput<Body>,
      options: Readonly<{
        completeWhen: CompleteWhen & RuleBodyInput<CompleteWhen>;
      }>,
    ) => Formula<Value, readonly [Body, Readonly<{ completeWhen: CompleteWhen }>]>);
}>;

/** Rule builder returned by KnowledgeBase.rule(...). */
export type RuleBuilder<Schema extends PredicateSchema> = Readonly<{
  if: <const Body>(body: Body & RuleBodyInput<Body>) => Rule<Schema, Body>;
  iff: <const Body>(body: Body & RuleBodyInput<Body>) => Rule<Schema, Body>;
}>;

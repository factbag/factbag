import type { Entity, PredicateDeclaration, Scalar } from "factbag/dsl";
import type { Operation } from "factbag/kb";

/** A permitted effect on a validated predicate: any guarded operation that writes. */
export type Action = Exclude<Operation, "query">;

/**
 * A predicate the classifier may write evidence for: its declaration, the signs its guard
 * permits, and the finite values each role can take.
 */
export type ClassifiablePredicate = {
  readonly declaration: PredicateDeclaration;
  readonly actions: ReadonlySet<Action>;
  readonly roles: Readonly<Record<string, readonly (Scalar | Entity)[]>>;
};

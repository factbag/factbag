import type { Atom } from "../types/atom";
import type { NegativeLiteral } from "../types/literal";
import type { PredicateSchema } from "../types/schema";
import type {
  ExistsArgs,
  Formula,
  FormulaArgumentInput,
  RuleBodyArgs,
  RuleBodyInput,
} from "./types";
import type { Var } from "../types/variable";

/**
 * Negate an atom in a rule body. Open-world predicates require explicit
 * negative support; closed-world predicates use negation-as-failure.
 */
export function not<Schema extends PredicateSchema>(atom: Atom<Schema>): NegativeLiteral<Schema> {
  return { sign: "-", atom };
}

/**
 * Conjoin rule-body formulas or atoms: the rule fires only when every
 * conjunct holds.
 *
 * @example
 * ```ts
 * kb.rule(doctor({ person: P })).iff(
 *   and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
 * );
 * ```
 */
export function and<const Args extends readonly unknown[]>(
  ...args: Args & RuleBodyArgs<Args>
): Formula<boolean, Args> {
  return { kind: "and", args };
}

/**
 * Disjoin rule-body formulas or atoms: the rule fires when at least one
 * disjunct holds, and each disjunct's bindings propagate independently.
 */
export function or<const Args extends readonly unknown[]>(
  ...args: Args & RuleBodyArgs<Args>
): Formula<boolean, Args> {
  return { kind: "or", args };
}

/**
 * Existentially quantify variables over a rule-body formula. The quantified
 * variables stay out of the rule head; a successful proof carries the witness
 * bindings that satisfied the body.
 *
 * @example
 * ```ts
 * // X is a grandparent of Z if some Y is X's child and Z's parent.
 * kb.rule(grandparent({ grandparent: X, grandchild: Z })).iff(
 *   exists(Y, and(parent({ parent: X, child: Y }), parent({ parent: Y, child: Z }))),
 * );
 * ```
 */
export function exists<const Args extends readonly unknown[]>(
  ...args: Args & ExistsArgs<Args>
): Formula<boolean, Args> {
  return { kind: "exists", args };
}

/**
 * Bind a variable to an expression inside a rule body, then prove the body
 * with the binding in scope.
 *
 * @remarks
 * The bound expression must be an aggregate (`sum`/`count`) or an arithmetic
 * expression; any other form is an invalid program shape and fails loudly
 * with an assertion error when the rule is evaluated.
 *
 * @example
 * ```ts
 * kb.rule(annualIncomeOver200k({ person: P, year: Y })).iff(
 *   letIn(
 *     Total,
 *     sum(Amount).where(incomeFact({ person: P, year: Y, amountCents: Amount })),
 *     gt(Total, 20_000_000),
 *   ),
 * );
 * ```
 */
export function letIn<const Value, const Body>(
  variable: Var,
  value: Value & FormulaArgumentInput<Value>,
  body: Body & RuleBodyInput<Body>,
): Formula<boolean, readonly [Var, Value, Body]> {
  return { kind: "letIn", args: [variable, value, body] };
}

import type { Atom } from "../../types/atom";
import type { AnyLiteral } from "../../types/literal";
import type { AnyRule } from "../../types/rule";
import type { PredicateSchema } from "../../types/schema";
import { assertConstructiveRecursion } from "./constructive-recursion";
import { assertConstructiveVariableUse } from "./constructive-variable-use";
import type { QueryValidation, QueryValidationContext } from "./context";

const queryValidations: readonly QueryValidation[] = [
  assertConstructiveVariableUse,
  assertConstructiveRecursion,
];

/** Assert that a query is inside the solver's supported semantic fragment. */
export function validateQuery<Schema extends PredicateSchema>(
  literals: readonly AnyLiteral[],
  rules: readonly AnyRule[],
  atom: Atom<Schema>,
): void {
  const context: QueryValidationContext<Schema> = { literals, rules, atom };

  for (const validate of queryValidations) {
    validate(context);
  }
}

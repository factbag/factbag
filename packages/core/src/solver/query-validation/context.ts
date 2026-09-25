import type { Atom } from "../../types/atom";
import type { AnyLiteral } from "../../types/literal";
import type { AnyRule } from "../../types/rule";
import type { PredicateSchema } from "../../types/schema";

export type QueryValidationContext<Schema extends PredicateSchema = PredicateSchema> = Readonly<{
  literals: readonly AnyLiteral[];
  rules: readonly AnyRule[];
  atom: Atom<Schema>;
}>;

export type QueryValidation = <Schema extends PredicateSchema>(
  context: QueryValidationContext<Schema>,
) => void;

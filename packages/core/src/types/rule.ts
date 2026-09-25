import type { AnyLiteral, Literal } from "./literal";
import type { PredicateSchema } from "./schema";

/** Rule semantics: `if` states a sufficient condition, `iff` a definition. */
export type RuleKind = "if" | "iff";

/** A logical rule with either sufficient or definitional semantics. */
export type Rule<HeadSchema extends PredicateSchema, Body> = Readonly<{
  kind: RuleKind;
  head: Literal<HeadSchema>;
  body: Body;
}>;

/** A rule whose exact head schema and body shape are intentionally erased. */
export type AnyRule = Readonly<{
  readonly kind: RuleKind;
  readonly head: AnyLiteral;
  readonly body: unknown;
}>;

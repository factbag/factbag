import type { Literal } from "./literal";
import type { Predicate } from "./predicate";
import type { Rule } from "./rule";

/** What a solver reasons over: the vocabulary, the accepted evidence, and the rules. */
export type Program = Readonly<{
  /** Every predicate the evidence and rules use, each name appearing once. */
  predicates: readonly Predicate[];
  literals: readonly Literal[];
  rules: readonly Rule[];
}>;

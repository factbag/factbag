import { isPlainObject } from "../is-plain-object";
import { assert } from "../assert";
import { assertIsArrayOf, isArrayOf } from "../shape";
import { assertIsLiteral, isLiteral } from "./literal";
import type { Literal } from "./literal";
import { assertIsPredicate, isPredicate } from "./predicate";
import type { Predicate } from "./predicate";
import { assertIsRule, isRule } from "./rule";
import type { Rule } from "./rule";

/** What a solver reasons over: the vocabulary, the accepted evidence, and the rules. */
export type Program = Readonly<{
  /** Every predicate the evidence and rules use, each name appearing once. */
  predicates: readonly Predicate[];
  literals: readonly Literal[];
  rules: readonly Rule[];
}>;

/** Return whether a value is a program. */
export function isProgram(value: unknown): value is Program {
  return (
    isPlainObject(value) &&
    isArrayOf(value["predicates"], isPredicate) &&
    isArrayOf(value["literals"], isLiteral) &&
    isArrayOf(value["rules"], isRule)
  );
}

/** Assert that a value is a program. */
export function assertIsProgram(value: unknown): asserts value is Program {
  assert(isPlainObject(value));
  assertIsArrayOf(value["predicates"], assertIsPredicate);
  assertIsArrayOf(value["literals"], assertIsLiteral);
  assertIsArrayOf(value["rules"], assertIsRule);
}

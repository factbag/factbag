import { assertIsAtom, isAtom } from "./atom";
import type { Atom } from "./atom";
import { assertIsCondition, isCondition } from "./condition";
import type { Condition } from "./condition";
import { assertIsShape, isShape } from "../shape";
import type { Shape } from "../shape";

/**
 * A rule: the head holds `if` (or, for `iff`, exactly when) the body holds.
 * Its kind is its semantics.
 */
export type Rule = Shape<RuleKind> &
  Readonly<{
    head: Atom;
    body: Condition;
  }>;

/** Rule semantics: `if` states a sufficient condition, `iff` a definition. */
export type RuleKind = "if" | "iff";

/** Return whether a value is a rule. */
export function isRule(value: unknown): value is Rule {
  return isShape(value, "if", "iff") && isAtom(value["head"]) && isCondition(value["body"]);
}

/** Assert that a value is a rule. */
export function assertIsRule(value: unknown): asserts value is Rule {
  assertIsShape(value, "if", "iff");
  assertIsAtom(value["head"]);
  assertIsCondition(value["body"]);
}

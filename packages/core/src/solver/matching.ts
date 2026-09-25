import { assertGroundAtom, fieldEquals, isAtomForPredicate } from "../types/atom";
import type { AnyAtom, Atom, GroundAtom } from "../types/atom";
import type { AnyRule, Rule } from "../types/rule";
import type { PredicateSchema } from "../types/schema";
import { isVar } from "../types/variable";
import type { Var } from "../types/variable";
import { assert } from "../utils/assert";

export function matchRuleForAtom<Schema extends PredicateSchema>(
  rule: AnyRule,
  atom: GroundAtom<Schema>,
):
  | Readonly<{
      rule: Rule<Schema, unknown>;
      bindings: ReadonlyMap<Var, unknown>;
    }>
  | undefined {
  if (rule.head.atom.predicate !== atom.predicate) {
    return undefined;
  }

  assertRuleMatchesAtom(rule, atom);
  const bindings = matchPattern(rule.head.atom, atom);
  if (bindings === undefined) {
    return undefined;
  }

  return { rule, bindings };
}

function assertRuleMatchesAtom<Schema extends PredicateSchema>(
  rule: AnyRule,
  atom: GroundAtom<Schema>,
): asserts rule is Rule<Schema, unknown> {
  assert(
    rule.head.atom.predicate === atom.predicate,
    "Rule head predicate does not match queried atom",
  );
}

export function matchPattern<Schema extends PredicateSchema>(
  pattern: Atom<Schema>,
  atom: GroundAtom<Schema>,
): ReadonlyMap<Var, unknown> | undefined {
  if (pattern.predicate !== atom.predicate) {
    return undefined;
  }

  const bindings = new Map<Var, unknown>();
  for (const [name, patternValue] of Object.entries(pattern.fields)) {
    const atomValue = atom.fields[name];
    if (isVar(patternValue)) {
      const boundValue = bindings.get(patternValue);
      if (bindings.has(patternValue) && !fieldEquals(boundValue, atomValue)) {
        return undefined;
      }
      bindings.set(patternValue, atomValue);
      continue;
    }

    if (!fieldEquals(patternValue, atomValue)) {
      return undefined;
    }
  }

  return bindings;
}

export function groundAtom<Schema extends PredicateSchema>(
  atom: Atom<Schema>,
  bindings: ReadonlyMap<Var, unknown>,
): GroundAtom<Schema> {
  const fields: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(atom.fields)) {
    if (isVar(value)) {
      assert(bindings.has(value), `No binding for variable ${value.name}`);
      fields[name] = bindings.get(value);
      continue;
    }

    fields[name] = value;
  }

  const grounded: AnyAtom = { predicate: atom.predicate, fields };
  assert(isAtomForPredicate(grounded, atom.predicate), "Grounded atom must retain its schema");
  assertGroundAtom(grounded);

  return grounded;
}

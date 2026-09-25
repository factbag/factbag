import { ExclusiveDefinitionProgrammerError } from "../../exceptions/programmer-errors";
import type { PredicateDeclaration } from "../../types/predicate";
import type { AnyRule } from "../../types/rule";

/** Assert that each predicate has either iff definition semantics or if rule-disjunction semantics, not both. */
export function assertExclusiveDefinitions(rules: readonly AnyRule[]): void {
  const rulesByPredicate = new Map<PredicateDeclaration, AnyRule[]>();

  for (const rule of rules) {
    const predicate = rule.head.atom.predicate;
    const predicateRules = rulesByPredicate.get(predicate) ?? [];
    predicateRules.push(rule);
    rulesByPredicate.set(predicate, predicateRules);
  }

  for (const [predicate, predicateRules] of rulesByPredicate) {
    if (predicateRules.some((rule) => rule.kind === "iff") && predicateRules.length > 1) {
      throw new ExclusiveDefinitionProgrammerError(predicate, predicateRules);
    }
  }
}

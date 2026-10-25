import type { AnyLiteral } from "../types/literal";
import type { PredicateDeclaration } from "../types/predicate";
import type { AnyRule } from "../types/rule";
import { reachablePredicates, ruleEdges, type Edge } from "./query-validation/utils";

/** Query-local lookups; predicate identity, not its name, determines dependencies. */
export class ProgramIndex {
  private readonly literals = new Map<PredicateDeclaration, AnyLiteral[]>();
  private readonly rules = new Map<PredicateDeclaration, AnyRule[]>();
  private readonly edges: readonly Edge[];
  private readonly reachable = new Map<PredicateDeclaration, ReadonlySet<PredicateDeclaration>>();
  private readonly predicateIds = new Map<PredicateDeclaration, number>();

  constructor(literals: readonly AnyLiteral[], rules: readonly AnyRule[]) {
    for (const literal of literals) {
      const predicate = literal.atom.predicate;
      const group = this.literals.get(predicate);
      if (group === undefined) {
        this.literals.set(predicate, [literal]);
      } else {
        group.push(literal);
      }
    }
    for (const rule of rules) {
      const predicate = rule.head.atom.predicate;
      const group = this.rules.get(predicate);
      if (group === undefined) {
        this.rules.set(predicate, [rule]);
      } else {
        group.push(rule);
      }
    }
    this.edges = rules.flatMap(ruleEdges);
  }

  literalsFor(predicate: PredicateDeclaration): readonly AnyLiteral[] {
    return this.literals.get(predicate) ?? [];
  }

  rulesFor(predicate: PredicateDeclaration): readonly AnyRule[] {
    return this.rules.get(predicate) ?? [];
  }

  /** Atom keys must distinguish declarations even when they share a display name. */
  predicateId(predicate: PredicateDeclaration): number {
    let id = this.predicateIds.get(predicate);
    if (id === undefined) {
      id = this.predicateIds.size;
      this.predicateIds.set(predicate, id);
    }
    return id;
  }

  reaches(predicate: PredicateDeclaration): ReadonlySet<PredicateDeclaration> {
    let reachable = this.reachable.get(predicate);
    if (reachable === undefined) {
      reachable = reachablePredicates(predicate, this.edges);
      this.reachable.set(predicate, reachable);
    }
    return reachable;
  }
}

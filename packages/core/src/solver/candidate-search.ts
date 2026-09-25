import { fieldIdentityToken } from "../types/atom";
import type { Atom, GroundAtom } from "../types/atom";
import type { PredicateDeclaration } from "../types/predicate";
import type { AnyRule } from "../types/rule";
import { isVar, type Var } from "../types/variable";
import { reachablePredicates, ruleEdges } from "./query-validation/utils";

type CandidateTable = {
  atoms: Map<string, GroundAtom>;
  derive: () => readonly GroundAtom[];
};

type CandidateGroup = {
  tables: Set<CandidateTable>;
  evaluating: boolean;
  changed: boolean;
};

/** Query-local candidate tables. Recursive predicates reach a fixed point together. */
export class CandidateSearch {
  private readonly groups = new Map<PredicateDeclaration, CandidateGroup>();
  private readonly tables = new Map<PredicateDeclaration, Map<string, CandidateTable>>();

  constructor(rules: readonly AnyRule[]) {
    const edges = rules.flatMap(ruleEdges);
    for (const rule of rules) {
      const predicate = rule.head.atom.predicate;
      if (this.groups.has(predicate)) {
        continue;
      }
      const group: CandidateGroup = { tables: new Set(), evaluating: false, changed: false };
      for (const dependency of reachablePredicates(predicate, edges)) {
        if (reachablePredicates(dependency, edges).has(predicate)) {
          this.groups.set(dependency, group);
        }
      }
    }
  }

  candidates(
    atom: Atom,
    seeds: readonly GroundAtom[],
    derive: () => readonly GroundAtom[],
  ): GroundAtom[] {
    let tables = this.tables.get(atom.predicate);
    if (tables === undefined) {
      tables = new Map();
      this.tables.set(atom.predicate, tables);
    }
    const key = patternKey(atom);
    const existing = tables.get(key);
    if (existing !== undefined) {
      return [...existing.atoms.values()];
    }

    let group = this.groups.get(atom.predicate);
    if (group === undefined) {
      group = { tables: new Set(), evaluating: false, changed: false };
      this.groups.set(atom.predicate, group);
    }
    const table: CandidateTable = {
      atoms: new Map(seeds.map((seed) => [patternKey(seed), seed])),
      derive,
    };
    tables.set(key, table);
    group.tables.add(table);
    group.changed = true;

    if (!group.evaluating) {
      group.evaluating = true;
      try {
        do {
          group.changed = false;
          for (const member of [...group.tables]) {
            group.changed = expandTable(member) || group.changed;
          }
        } while (group.changed);
      } finally {
        group.evaluating = false;
      }
    }

    // Snapshot answers: nested evaluation can grow the underlying tables.
    return [...table.atoms.values()];
  }

  sameComponent(left: PredicateDeclaration, right: PredicateDeclaration): boolean {
    return (
      left === right || (this.groups.has(left) && this.groups.get(left) === this.groups.get(right))
    );
  }

  get isEvaluating(): boolean {
    return [...this.groups.values()].some((group) => group.evaluating);
  }
}

function expandTable(table: CandidateTable): boolean {
  let changed = false;
  for (const candidate of table.derive()) {
    const key = patternKey(candidate);
    if (!table.atoms.has(key)) {
      table.atoms.set(key, candidate);
      changed = true;
    }
  }
  return changed;
}

/** Variant queries share a table, but repeated-variable constraints stay distinct. */
function patternKey(atom: Atom): string {
  const variables = new Map<Var, number>();
  return JSON.stringify(
    atom.predicate.paramNames.map((name) => {
      const value = atom.fields[name];
      if (!isVar(value)) {
        return ["value", fieldIdentityToken(value)];
      }
      let index = variables.get(value);
      if (index === undefined) {
        index = variables.size;
        variables.set(value, index);
      }
      return ["variable", index];
    }),
  );
}

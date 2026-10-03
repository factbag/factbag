/**
 * Runs a widget's rule scaffold through the real @factbag/core solver, so the
 * diagram keeps its hand-placed layout but every displayed value is computed.
 * Leaves become open-world predicates whose value is set the only way core
 * knows: assert for true, deny for false, both for conflicted, silence for
 * unknown. Gates become iff-rules, and every node's value — leaves included —
 * is read back out of query(kb, …), not combined by lattice math re-implemented
 * docs-side.
 */
import { and, assertGroundAtom, or, predicate, variable } from "@factbag/core/dsl";
import type { Predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, type GoalValue, type Judgment } from "@factbag/core/query";

class Case {
  constructor(readonly id: string) {}
}

const SCHEMA = { subject: Case } as const;

type Schema = typeof SCHEMA;

export type ScaffoldGate<Id extends string> = {
  readonly id: Id;
  readonly inputs: readonly Id[];
  readonly operator: "and" | "or";
};

type Scaffold = {
  readonly queryOf: (id: string) => Judgment;
};

/**
 * Gates may reference leaves or earlier gates by id; leaf ids are the keys of
 * `leafValues`. Returns the solver's value for every node in the scaffold.
 */
export function solveScaffold<Id extends string>(
  gates: readonly ScaffoldGate<Id>[],
  leafValues: Readonly<Partial<Record<Id, GoalValue>>>,
): Record<Id, GoalValue> {
  const scaffold = buildScaffold(gates, leafValues);
  const ids = [...Object.keys(leafValues), ...gates.map((gate) => gate.id)];
  const entries = ids.map((id) => [id, scaffold.queryOf(id).value] as const);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Every leaf key and gate id is enumerated above; Object.fromEntries erases the key union.
  return Object.fromEntries(entries) as Record<Id, GoalValue>;
}

function buildScaffold(
  gates: readonly ScaffoldGate<string>[],
  leafValues: Readonly<Partial<Record<string, GoalValue>>>,
): Scaffold {
  const kb = new KnowledgeBase();
  const subject = new Case("this_case");
  const P = variable("P");

  const predicates = new Map<string, Predicate<Schema>>();
  const predicateOf = (id: string): Predicate<Schema> => {
    let declared = predicates.get(id);
    if (declared === undefined) {
      declared = predicate(id, SCHEMA);
      predicates.set(id, declared);
    }
    return declared;
  };

  for (const [id, value] of Object.entries(leafValues)) {
    if (value === undefined) {
      continue;
    }
    const atom = predicateOf(id)({ subject });
    if (value === "true" || value === "conflicted") {
      kb.asserts(atom);
    }
    if (value === "false" || value === "conflicted") {
      kb.denies(atom);
    }
  }

  for (const gate of gates) {
    const parts = gate.inputs.map((input) => predicateOf(input)({ subject: P }));
    kb.rule(predicateOf(gate.id)({ subject: P })).iff(
      gate.operator === "and" ? and(...parts) : or(...parts),
    );
  }

  const queryOf = (id: string): Judgment => {
    const goal = predicateOf(id)({ subject });
    assertGroundAtom(goal);
    return query(kb, goal);
  };

  return { queryOf };
}

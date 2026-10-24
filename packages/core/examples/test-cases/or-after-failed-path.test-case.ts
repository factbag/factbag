import { expect } from "vitest";
import type { QueryJudgment } from "../../src/query";
import type { GroundAtom } from "../../src/types/atom";
import type { DslTestSpec } from "../test-runner/test-runner";

/** Match the public proof root; internal arithmetic temporaries are not this contract. */
function proof(atom: GroundAtom, value: QueryJudgment["value"]): QueryJudgment {
  const support: unknown = expect.arrayContaining([expect.objectContaining({ source: "rule" })]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- Vitest's asymmetric matcher checks these proof fields in the existing harness.
  return expect.objectContaining({
    value,
    goal: { kind: "atom", atom },
    bindings: [],
    [value === "false" ? "negative" : "positive"]: support,
  });
}
import { add, and, closedPredicate, gte, letIn, not, or, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

class Thing {
  constructor(readonly id: string) {}
}
const alice = new Thing("alice");
const stated = closedPredicate("stated", { person: Thing, kind: String, amount: Number });
const has = closedPredicate("has", { person: Thing, kind: String });
const total = closedPredicate("total", { person: Thing, kind: String, amount: Number });
const base = closedPredicate("base", { person: Thing, amount: Number });
const deps = closedPredicate("deps", { person: Thing, amount: Number });
const main = closedPredicate("main", { person: Thing, amount: Number });
const joint = closedPredicate("joint", { person: Thing, spouse: Thing });
const hasJoint = closedPredicate("hasJoint", { person: Thing });
const ret = closedPredicate("ret", { person: Thing, amount: Number });
const P = variable("P");
const S = variable("S");
const K = variable("K");
const A = variable("A");
const E = variable("E");
const ND = variable("ND");
const X = variable("X");
const X2 = variable("X2");
const T = variable("T");

function build(kb: KnowledgeBase) {
  kb.entities.add(alice);
  kb.asserts(stated({ person: alice, kind: "e", amount: 2000 }));
  kb.asserts(stated({ person: alice, kind: "c", amount: 2000 }));
  const rule0 = kb.rule(has({ person: P, kind: K })).iff(stated({ person: P, kind: K, amount: A }));
  const rule1 = kb
    .rule(total({ person: P, kind: K, amount: T }))
    .iff(letIn(T, sum(A).where(stated({ person: P, kind: K, amount: A })), gte(T, 0)));
  const rule2 = kb.rule(base({ person: P, amount: E })).iff(letIn(E, 2000, gte(E, 0)));
  const rule3 = kb
    .rule(deps({ person: P, amount: ND }))
    .iff(
      or(
        and(has({ person: P, kind: "c" }), total({ person: P, kind: "c", amount: ND })),
        and(not(has({ person: P, kind: "c" })), letIn(ND, 0, gte(ND, 0))),
      ),
    );
  const rule4 = kb
    .rule(main({ person: P, amount: A }))
    .iff(
      or(
        and(has({ person: P, kind: "e" }), total({ person: P, kind: "e", amount: A })),
        and(
          not(has({ person: P, kind: "e" })),
          base({ person: P, amount: E }),
          deps({ person: P, amount: ND }),
          letIn(A, add(E, ND), gte(A, 0)),
        ),
      ),
    );
  const rule5 = kb.rule(hasJoint({ person: P })).iff(joint({ person: P, spouse: S }));
  const rule6 = kb
    .rule(ret({ person: P, amount: A }))
    .iff(
      or(
        and(
          joint({ person: P, spouse: S }),
          main({ person: P, amount: X }),
          main({ person: S, amount: X2 }),
          letIn(A, add(X, X2), gte(A, 0)),
        ),
        and(not(hasJoint({ person: P })), main({ person: P, amount: A })),
      ),
    );
  return {
    literals: [
      { sign: "+" as const, atom: stated({ person: alice, kind: "e", amount: 2000 }) },
      { sign: "+" as const, atom: stated({ person: alice, kind: "c", amount: 2000 }) },
    ],
    rules: [rule0, rule1, rule2, rule3, rule4, rule5, rule6],
  };
}

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: a later alternative can extend a failed-path environment",
    invariant:
      "Alice has a stated amount of 2,000 and no joint partner. Exploring the unavailable joint route must not prevent the individual route from returning 2,000.",
    narration:
      "Alice has a stated amount of 2,000 and no joint partner. Exploring the unavailable joint route must not prevent the individual route from returning 2,000.",
    build(kb) {
      return build(kb);
    },
    queryAtoms: ret({ person: alice, amount: 2000 }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(ret({ person: alice, amount: 2000 }), "true"),
      };
    },
  },
];

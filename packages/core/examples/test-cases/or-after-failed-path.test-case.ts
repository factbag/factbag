import { add, and, closedPredicate, gte, letIn, not, or, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

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

const hasRule = {
  kind: "iff",
  head: { sign: "+", atom: has({ person: P, kind: K }) },
  body: stated({ person: P, kind: K, amount: A }),
} as const;
const totalRule = {
  kind: "iff",
  head: { sign: "+", atom: total({ person: P, kind: K, amount: T }) },
  body: letIn(T, sum(A).where(stated({ person: P, kind: K, amount: A })), gte(T, 0)),
} as const;
const baseRule = {
  kind: "iff",
  head: { sign: "+", atom: base({ person: P, amount: E }) },
  body: letIn(E, 2000, gte(E, 0)),
} as const;
const depsRule = {
  kind: "iff",
  head: { sign: "+", atom: deps({ person: P, amount: ND }) },
  body: or(
    and(has({ person: P, kind: "c" }), total({ person: P, kind: "c", amount: ND })),
    and(not(has({ person: P, kind: "c" })), letIn(ND, 0, gte(ND, 0))),
  ),
} as const;
const mainRule = {
  kind: "iff",
  head: { sign: "+", atom: main({ person: P, amount: A }) },
  body: or(
    and(has({ person: P, kind: "e" }), total({ person: P, kind: "e", amount: A })),
    and(
      not(has({ person: P, kind: "e" })),
      base({ person: P, amount: E }),
      deps({ person: P, amount: ND }),
      letIn(A, add(E, ND), gte(A, 0)),
    ),
  ),
} as const;
const hasJointRule = {
  kind: "iff",
  head: { sign: "+", atom: hasJoint({ person: P }) },
  body: joint({ person: P, spouse: S }),
} as const;
const returnRule = {
  kind: "iff",
  head: { sign: "+", atom: ret({ person: P, amount: A }) },
  body: or(
    and(
      joint({ person: P, spouse: S }),
      main({ person: P, amount: X }),
      main({ person: S, amount: X2 }),
      letIn(A, add(X, X2), gte(A, 0)),
    ),
    and(not(hasJoint({ person: P })), main({ person: P, amount: A })),
  ),
} as const;

const scenario = {
  build(kb: KnowledgeBase) {
    kb.entities.add(alice);
    kb.asserts(stated({ person: alice, kind: "e", amount: 2000 }));
    kb.asserts(stated({ person: alice, kind: "c", amount: 2000 }));
    kb.rule(hasRule.head.atom).iff(hasRule.body);
    kb.rule(totalRule.head.atom).iff(totalRule.body);
    kb.rule(baseRule.head.atom).iff(baseRule.body);
    kb.rule(depsRule.head.atom).iff(depsRule.body);
    kb.rule(mainRule.head.atom).iff(mainRule.body);
    kb.rule(hasJointRule.head.atom).iff(hasJointRule.body);
    kb.rule(returnRule.head.atom).iff(returnRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: stated({ person: alice, kind: "e", amount: 2000 }) },
      { sign: "+", atom: stated({ person: alice, kind: "c", amount: 2000 }) },
    ],
    rules: [hasRule, totalRule, baseRule, depsRule, mainRule, hasJointRule, returnRule],
  },
} as const;

export const orAfterFailedPathTestCases: readonly DslTestSpec[] = [
  {
    ...scenario,
    name: "or failed paths: discovers the inner amount directly",
    invariant: "The stated-amount route must retain its output while alternatives are explored.",
    narration:
      "Alice's stated amount is 2,000. The inactive fallback computes base plus dependents (4,000), which must stay false rather than borrow the stated route's truth.",
    queryAtoms: main({ person: alice, amount: A }),
    expectedProofs: [
      ruleProof(main({ person: alice, amount: 2000 }), "true", mainRule, [
        [P, alice],
        [A, 2000],
      ]),
      ruleProof(main({ person: alice, amount: 4000 }), "false", mainRule, [
        [P, alice],
        [A, 4000],
      ]),
    ],
  },
  {
    ...scenario,
    name: "or failed paths: discovers the amount after the joint route fails",
    invariant:
      "A failed route with missing bindings must not prevent a later route from binding an output.",
    narration:
      "Alice has no joint partner. Joint sums of the inner candidates (2,000 and 4,000) remain false at 4,000, 6,000, and 8,000. The individual route still discovers a true 2,000.",
    queryAtoms: ret({ person: alice, amount: A }),
    expectedProofs: [
      ruleProof(ret({ person: alice, amount: 4000 }), "false", returnRule, [
        [P, alice],
        [A, 4000],
      ]),
      ruleProof(ret({ person: alice, amount: 6000 }), "false", returnRule, [
        [P, alice],
        [A, 6000],
      ]),
      ruleProof(ret({ person: alice, amount: 8000 }), "false", returnRule, [
        [P, alice],
        [A, 8000],
      ]),
      ruleProof(ret({ person: alice, amount: 2000 }), "true", returnRule, [
        [P, alice],
        [A, 2000],
      ]),
    ],
  },
  {
    ...scenario,
    name: "or failed paths: confirms the amount through a grounded query",
    invariant: "The individual route must also succeed when its output is supplied by the query.",
    narration: "With no joint partner, Alice's grounded return amount of 2,000 is true.",
    queryAtoms: ret({ person: alice, amount: 2000 }),
    expectedProofs: ruleProof(ret({ person: alice, amount: 2000 }), "true", returnRule, [
      [P, alice],
      [A, 2000],
    ]),
  },
];

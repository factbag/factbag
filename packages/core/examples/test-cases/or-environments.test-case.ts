import { and, closedPredicate, or, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Thing {
  constructor(readonly id: string) {}
}

const x1 = new Thing("x1");
const x3 = new Thing("x3");
const p = closedPredicate("p", { x: Thing });
const r = closedPredicate("r", {});
const s = closedPredicate("s", { x: Thing });
const t = closedPredicate("t", {});
const u = closedPredicate("u", { x: Thing });
const X = variable("X");

const body = and(or(p({ x: X }), r({})), s({ x: X }));
const propositionRule = { kind: "iff", head: { sign: "+", atom: t({}) }, body } as const;
const candidateRule = { kind: "iff", head: { sign: "+", atom: u({ x: X }) }, body } as const;

function scenario(sWitness: Thing) {
  return {
    build(kb: KnowledgeBase) {
      kb.entities.add(x1, x3);
      kb.asserts(p({ x: x1 }));
      kb.asserts(s({ x: sWitness }));
      kb.rule(propositionRule.head.atom).iff(body);
      kb.rule(candidateRule.head.atom).iff(body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+", atom: p({ x: x1 }) },
        { sign: "+", atom: s({ x: sWitness }) },
      ],
      rules: [propositionRule, candidateRule],
    },
  } as const;
}

export const orEnvironmentTestCases: readonly DslTestSpec[] = [
  {
    ...scenario(x3),
    name: "or environments: rejects truth borrowed from a different witness",
    invariant: "A conjunction needs one assignment satisfying both its disjunction and later atom.",
    narration:
      "Only x1 satisfies p and only x3 satisfies s. The unbound false r branch cannot borrow p's truth and then choose x3 for s.",
    queryAtoms: t({}),
    expectedProofs: ruleProof(t({}), "false", propositionRule, [[X, x3]]),
  },
  {
    ...scenario(x3),
    name: "or environments: enumerates both incompatible witnesses as false",
    invariant: "Each enumerated candidate must be judged under its own assignment.",
    narration:
      "x1 fails s and x3 fails both p and r. Enumeration returns those two false candidates, not a true result assembled from different witnesses.",
    queryAtoms: u({ x: X }),
    expectedProofs: [
      ruleProof(u({ x: x1 }), "false", candidateRule, [[X, x1]]),
      ruleProof(u({ x: x3 }), "false", candidateRule, [[X, x3]]),
    ],
  },
  {
    ...scenario(x1),
    name: "or environments: accepts a witness satisfying both conjuncts",
    invariant: "Keeping branch environments separate must not discard a valid shared witness.",
    narration: "x1 satisfies both p and s, so the same conjunction succeeds.",
    queryAtoms: t({}),
    expectedProofs: ruleProof(t({}), "true", propositionRule, [[X, x1]]),
  },
];

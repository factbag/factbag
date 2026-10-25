import { expect } from "vitest";
import { add, and, closedPredicate, gte, letIn, mul, or, sub, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const total = closedPredicate("total_income", { person: Person, amount: Number });
const tax = closedPredicate("bracketed_tax", { person: Person, amount: Number });
const P = variable("P");
const X = variable("X");
const T = variable("T");
const A = variable("A");
const E = variable("E");
const V = variable("V");

const totalRule = {
  kind: "iff",
  head: { sign: "+", atom: total({ person: P, amount: T }) },
  body: letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, 0)),
} as const;
const taxRule = {
  kind: "iff",
  head: { sign: "+", atom: tax({ person: P, amount: A }) },
  // 15% up to 36,900; 5,535 plus 28% of the excess above it.
  body: and(
    total({ person: P, amount: T }),
    or(
      and(gte(36_900, T), letIn(A, mul(T, 0.15), gte(A, 0))),
      and(gte(T, 36_901), letIn(E, sub(T, 36_900), letIn(A, add(5_535, mul(0.28, E)), gte(A, 0)))),
    ),
  ),
} as const;

function scenario(amounts: readonly number[]) {
  return {
    build(kb: KnowledgeBase) {
      kb.entities.add(alice);
      for (const amount of amounts) {
        kb.asserts(income({ person: alice, amount }));
      }
      kb.rule(totalRule.head.atom).iff(totalRule.body);
      kb.rule(taxRule.head.atom).iff(taxRule.body);
    },
    expectedKnowledgeBase: {
      literals: amounts.map((amount) => ({
        sign: "+" as const,
        atom: income({ person: alice, amount }),
      })),
      rules: [totalRule, taxRule],
    },
  } as const;
}

function proof(amount: number, value: "true" | "false", totalAmount: number) {
  return ruleProof(tax({ person: alice, amount }), value, taxRule, [
    [P, alice],
    [T, totalAmount],
    [A, amount],
  ]);
}

// Match decimal arithmetic to six places rather than fixing its binary rounding.
// oxlint-disable-next-line typescript/no-unsafe-assignment -- This matcher is only used in expected numeric fields and bindings.
const upperAmount: number = expect.closeTo(7_208.28, 6);

export const orArithmeticTestCases: readonly DslTestSpec[] = [
  {
    ...scenario([17_330, 100]),
    name: "or arithmetic: accepts the lower branch amount and rejects a different amount",
    invariant: "Arithmetic temporaries must not prevent judging a branch in its own environment.",
    narration: "Income totals 17,430. The lower rate yields 2,614.5, not 2,600.",
    queryAtoms: [tax({ person: alice, amount: 2_614.5 }), tax({ person: alice, amount: 2_600 })],
    expectedProofs: [proof(2_614.5, "true", 17_430), proof(2_600, "false", 17_430)],
  },
  {
    ...scenario([17_330, 100]),
    name: "or arithmetic: discovers the lower branch amount",
    invariant: "An unbound output must retain the amount computed by the successful lower branch.",
    narration:
      "For income of 17,430, the lower formula yields a true 2,614.5. The inactive upper formula yields 83.4 (5,535 minus 5,451.6), which is omitted from enumeration.",
    queryAtoms: tax({ person: alice, amount: V }),
    expectedProofs: [proof(2_614.5, "true", 17_430)],
  },
  {
    ...scenario([42_876]),
    name: "or arithmetic: discovers the upper branch amount",
    invariant: "Nested arithmetic in the upper branch must also preserve its output binding.",
    narration:
      "Income is 42,876. The inactive lower formula gives 6,431.4, which is omitted. The upper branch yields 5,535 plus 1,673.28, or a true 7,208.28.",
    queryAtoms: tax({ person: alice, amount: V }),
    expectedProofs: [proof(upperAmount, "true", 42_876)],
  },
  {
    ...scenario([42_876]),
    name: "or arithmetic: rejects the lower scenario's amount for upper bracket income",
    invariant: "The lower scenario's result must not become true when only the upper guard holds.",
    narration: "For income of 42,876, a grounded query for 2,614.5 is false.",
    queryAtoms: tax({ person: alice, amount: 2_614.5 }),
    expectedProofs: proof(2_614.5, "false", 42_876),
  },
  {
    ...scenario([17_330, 100]),
    name: "or arithmetic: rejects the inactive upper formula through a ground query",
    invariant: "Pruned branch outputs must still be false when explicitly queried.",
    narration: "At income 17,430, the upper formula's output is unsupported.",
    queryAtoms: tax({ person: alice, amount: 5_535 + 0.28 * (17_430 - 36_900) }),
    expectedProofs: proof(5_535 + 0.28 * (17_430 - 36_900), "false", 17_430),
  },
  {
    ...scenario([42_876]),
    name: "or arithmetic: rejects the inactive lower formula through a ground query",
    invariant: "Pruned branch outputs must still be false when explicitly queried.",
    narration: "At income 42,876, the lower formula's output is unsupported.",
    queryAtoms: tax({ person: alice, amount: 6_431.4 }),
    expectedProofs: proof(6_431.4, "false", 42_876),
  },
];

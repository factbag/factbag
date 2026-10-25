import { add, and, closedPredicate, gte, letIn, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const X = variable("X");
const T = variable("T");
const A = variable("A");

function scenario(amounts: readonly number[]) {
  const zero = 0;
  const allowance = 250;
  const income = closedPredicate("income", { person: Person, amount: Number });
  const total = closedPredicate("total_income", { person: Person, amount: Number });
  const padded = closedPredicate("padded_income", { person: Person, amount: Number });
  const totalRule = {
    kind: "iff",
    head: { sign: "+", atom: total({ person: P, amount: T }) },
    body: letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, zero)),
  } as const;
  const paddedRule = {
    kind: "iff",
    head: { sign: "+", atom: padded({ person: P, amount: A }) },
    body: and(total({ person: P, amount: T }), letIn(A, add(allowance, T), gte(A, zero))),
  } as const;
  return {
    fixture: {
      build(kb: KnowledgeBase) {
        kb.entities.add(alice);
        for (const amount of amounts) {
          kb.asserts(income({ person: alice, amount }));
        }
        kb.rule(totalRule.head.atom).iff(totalRule.body);
        kb.rule(paddedRule.head.atom).iff(paddedRule.body);
      },
      expectedKnowledgeBase: {
        literals: amounts.map((amount) => ({
          sign: "+" as const,
          atom: income({ person: alice, amount }),
        })),
        rules: [totalRule, paddedRule],
      },
    },
    atom: (amount: number) => padded({ person: alice, amount }),
    pattern: padded({ person: alice, amount: A }),
    proof(amount: number, value: "true" | "false", sumValue: number) {
      return ruleProof(padded({ person: alice, amount }), value, paddedRule, [
        [P, alice],
        [A, amount],
        [T, sumValue],
      ]);
    },
  } as const;
}

const emptyNumber = scenario([]);
const populatedNumber = scenario([100, 25]);
export const emptySumTestCases: readonly DslTestSpec[] = [
  {
    ...emptyNumber.fixture,
    name: "empty sum: number zero participates in number arithmetic",
    invariant:
      "An empty closed-world number relation must supply a zero compatible with number arithmetic.",
    narration:
      "There is no income. Adding a 250 allowance yields 250 and rejects 251 using number arithmetic.",
    queryAtoms: [emptyNumber.atom(250), emptyNumber.atom(251)],
    expectedProofs: [emptyNumber.proof(250, "true", 0), emptyNumber.proof(251, "false", 0)],
  },
  {
    ...emptyNumber.fixture,
    name: "empty sum: discovers the number allowance without income rows",
    invariant:
      "An unbound output must discover the allowance even when the summed relation is empty.",
    narration: "The empty number sum plus 250 produces exactly one true candidate, 250.",
    queryAtoms: emptyNumber.pattern,
    expectedProofs: [emptyNumber.proof(250, "true", 0)],
  },
  {
    ...populatedNumber.fixture,
    name: "empty sum control: populated number sums retain their amounts",
    invariant: "Handling empty sums must not change ordinary numeric addition or constraints.",
    narration: "Income of 100 and 25 plus the allowance yields 375, not 376.",
    queryAtoms: [populatedNumber.atom(375), populatedNumber.atom(376)],
    expectedProofs: [
      populatedNumber.proof(375, "true", 125),
      populatedNumber.proof(376, "false", 125),
    ],
  },
  {
    ...populatedNumber.fixture,
    name: "empty sum control: discovers a populated number total",
    invariant: "A populated number sum must still constructively bind its output.",
    narration: "The number total is 125, so enumeration returns the allowance-adjusted 375.",
    queryAtoms: populatedNumber.pattern,
    expectedProofs: [populatedNumber.proof(375, "true", 125)],
  },
];

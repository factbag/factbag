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
import { add, and, closedPredicate, gte, letIn, mul, or, sub, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

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

function build(kb: KnowledgeBase) {
  const amounts = [17_330, 100];
  kb.entities.add(alice);
  for (const amount of amounts) {
    kb.asserts(income({ person: alice, amount }));
  }
  const rule0 = kb
    .rule(total({ person: P, amount: T }))
    .iff(letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, 0)));
  // 15% up to 36,900; 5,535 plus 28% of the excess above it.
  const rule1 = kb
    .rule(tax({ person: P, amount: A }))
    .iff(
      and(
        total({ person: P, amount: T }),
        or(
          and(gte(36_900, T), letIn(A, mul(T, 0.15), gte(A, 0))),
          and(
            gte(T, 36_901),
            letIn(E, sub(T, 36_900), letIn(A, add(5_535, mul(0.28, E)), gte(A, 0))),
          ),
        ),
      ),
    );
  return {
    literals: amounts.map((amount) => ({
      sign: "+" as const,
      atom: income({ person: alice, amount }),
    })),
    rules: [rule0, rule1],
  };
}

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: arithmetic alternatives retain their branch bindings",
    invariant:
      "Income totals 17,430. The lower rate branch yields 2,614.5 despite temporary bindings introduced by multiplication.",
    narration:
      "Income totals 17,430. The lower rate branch yields 2,614.5 despite temporary bindings introduced by multiplication.",
    build(kb) {
      return build(kb);
    },
    queryAtoms: tax({ person: alice, amount: 2614.5 }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(tax({ person: alice, amount: 2614.5 }), "true"),
      };
    },
  },
];

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
import { add, and, closedPredicate, gte, letIn, sum, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const total = closedPredicate("total_income", { person: Person, amount: Number });
const padded = closedPredicate("padded_income", { person: Person, amount: Number });
const P = variable("P");
const X = variable("X");
const T = variable("T");
const A = variable("A");

function build(kb: KnowledgeBase) {
  kb.entities.add(alice);
  const rule0 = kb
    .rule(total({ person: P, amount: T }))
    .iff(letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, 0)));
  const rule1 = kb
    .rule(padded({ person: P, amount: A }))
    .iff(and(total({ person: P, amount: T }), letIn(A, add(250, T), gte(A, 0))));
  return { literals: [], rules: [rule0, rule1] };
}

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: an empty sum participates in number arithmetic",
    invariant:
      "No income rows exist. The closed-world sum is numeric zero; adding a 250 allowance yields 250 without mixing bigint and number.",
    narration:
      "No income rows exist. The closed-world sum is numeric zero; adding a 250 allowance yields 250 without mixing bigint and number.",
    fails: "364f62f: an empty sum participates in number arithmetic",
    build(kb) {
      return build(kb);
    },
    queryAtoms: padded({ person: alice, amount: 250 }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(padded({ person: alice, amount: 250 }), "true"),
      };
    },
  },
];

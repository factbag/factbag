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
import { and, closedPredicate, gte, letIn, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

class Thing {
  constructor(readonly id: string) {}
}

const x1 = new Thing("x1");
const measured = closedPredicate("measured", { thing: Thing, value: Number });
const reported = closedPredicate("reported", { thing: Thing });
const X = variable("X");
const M = variable("M");
const V = variable("V");

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: a missing measurement leaves a later let unbound",
    invariant:
      "No measurement exists. Copying its missing value on this failed path must yield a false report rather than throw.",
    narration:
      "No measurement exists. Copying its missing value on this failed path must yield a false report rather than throw.",
    fails: "1ad8923: a missing measurement leaves a later let unbound",
    build(kb) {
      kb.entities.add(x1);
      const rule0 = kb
        .rule(reported({ thing: X }))
        .iff(and(measured({ thing: X, value: M }), letIn(V, M, gte(V, 0))));
      return { literals: [], rules: [rule0] };
    },
    queryAtoms: reported({ thing: x1 }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return { expectedKnowledgeBase, expectedProofs: proof(reported({ thing: x1 }), "false") };
    },
  },
];

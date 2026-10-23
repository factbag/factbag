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
import { and, closedPredicate, or, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

class Thing {
  constructor(readonly id: string) {}
}
const x1 = new Thing("x1");
const x3 = new Thing("x3");
const p = closedPredicate("p", { x: Thing });
const r = closedPredicate("r", {});
const s = closedPredicate("s", { x: Thing });
const t = closedPredicate("t", {});
const X = variable("X");

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: disjunction cannot borrow truth from another binding",
    invariant:
      "One thing satisfies p and a different thing satisfies s. No single thing satisfies both, so the conjunction is false.",
    narration:
      "One thing satisfies p and a different thing satisfies s. No single thing satisfies both, so the conjunction is false.",
    build(kb) {
      kb.entities.add(x1, x3);
      kb.asserts(p({ x: x1 }));
      kb.asserts(s({ x: x3 }));
      const rule0 = kb.rule(t({})).iff(and(or(p({ x: X }), r({})), s({ x: X })));
      return {
        literals: [
          { sign: "+" as const, atom: p({ x: x1 }) },
          { sign: "+" as const, atom: s({ x: x3 }) },
        ],
        rules: [rule0],
      };
    },
    queryAtoms: t({}),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return { expectedKnowledgeBase, expectedProofs: proof(t({}), "false") };
    },
  },
];

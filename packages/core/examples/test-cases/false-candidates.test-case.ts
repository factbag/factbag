import type { DslTestSpec } from "../test-runner/test-runner";
import { and, closedPredicate, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
const applicant = closedPredicate("applicant", { name: String });
const approved = closedPredicate("approved", { name: String });
const eligible = closedPredicate("eligible", { name: String });
const Name = variable("Name");

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: enumeration omits definitively false derived candidates",
    invariant:
      "Alice is an applicant but is not approved under a closed-world predicate. Enumeration must omit her false derived eligibility candidate.",
    narration:
      "Alice is an applicant but is not approved under a closed-world predicate. Enumeration must omit her false derived eligibility candidate.",
    fails: "ee25f12: enumeration omits definitively false derived candidates",
    build(kb) {
      kb.asserts(applicant({ name: "Alice" }));
      const rule0 = kb
        .rule(eligible({ name: Name }))
        .iff(and(applicant({ name: Name }), approved({ name: Name })));
      return {
        literals: [{ sign: "+" as const, atom: applicant({ name: "Alice" }) }],
        rules: [rule0],
      };
    },
    queryAtoms: eligible({ name: Name }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return { expectedKnowledgeBase, expectedProofs: [] };
    },
  },
];

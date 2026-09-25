import { predicate, variable, type PredicateSchema } from "../../src/dsl";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const clearedByReview = predicate("cleared_by_review", { person: Person });
const approved = predicate("approved_with_head_conflict", { person: Person });

/** Definition-of-done example for conflicts between direct evidence and derived support. */
export const headConflictTestCase: DslTestSpec = {
  name: "DOD: negative evidence conflicts with positive rule support at the head",
  invariant:
    "When a queried atom has direct negative evidence and a rule derives positive support for the same atom, the final judgment should be conflicted and preserve both sources.",
  narration:
    "Alice is approved by a review-derived rule, but the approval registry also contains a direct denial for the same approval atom. The query should surface a conflict rather than dropping either support.",
  build(kb) {
    kb.asserts(clearedByReview({ person: alice }), { source: "review_board" });
    kb.denies(approved({ person: alice }), { source: "approval_registry" });
    const rule = kb.rule(approved({ person: P })).if(clearedByReview({ person: P }));

    return { rule };
  },
  queryAtoms: approved({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: {
        literals: [
          {
            sign: "+",
            atom: clearedByReview({ person: alice }),
            metadata: { source: "review_board" },
          },
          {
            sign: "-",
            atom: approved({ person: alice }),
            metadata: { source: "approval_registry" },
          },
        ],
        rules: [rule],
      },
      expectedProofs: {
        value: "conflicted",
        goal: { kind: "atom", atom: approved({ person: alice }) },
        bindings: [],
        positive: [
          {
            source: "rule",
            rule,
            body: {
              value: "true",
              goal: { kind: "atom", atom: clearedByReview({ person: alice }) },
              bindings: [[P, alice]],
              positive: [
                {
                  source: "evidence",
                  literals: [
                    {
                      sign: "+",
                      atom: clearedByReview({ person: alice }),
                      metadata: { source: "review_board" },
                    },
                  ],
                },
              ],
            },
          },
        ],
        negative: [
          {
            source: "evidence",
            literals: [
              {
                sign: "-",
                atom: approved({ person: alice }),
                metadata: { source: "approval_registry" },
              },
            ],
          },
        ],
      },
    };
  },
};

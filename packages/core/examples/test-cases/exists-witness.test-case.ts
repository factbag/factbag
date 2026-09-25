import {
  and,
  closedPredicate,
  exists,
  predicate,
  variable,
  type PredicateSchema,
} from "../../src/dsl";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const cara = new Person("cara");

const X = variable("X");
const Y = variable("Y");
const Z = variable("Z");
const Score = variable("Score");

const parent = predicate("parent", { parent: Person, child: Person });
const grandparent = predicate("grandparent", {
  grandparent: Person,
  grandchild: Person,
});
const hasReviewedScore = predicate("has_reviewed_score", { person: Person });
const hasFinalScore = predicate("has_final_score", { person: Person });
const reviewedScore = predicate("reviewed_score_for_exists", { person: Person, score: Number });
const finalScore = closedPredicate("final_score_for_exists", { person: Person, score: Number });

const grandparentBody = exists(
  Y,
  and(parent({ parent: X, child: Y }), parent({ parent: Y, child: Z })),
);

/**
 * Definition-of-done example for existential witness evaluation.
 *
 * This is expected to fail until `exists(...)` evaluates witness-producing body
 * goals and preserves the existential goal in the proof tree.
 */
export const existsWitnessTestCase: DslTestSpec = {
  name: "DOD: exists preserves witness bindings and proof goal",
  invariant:
    "An existential rule body should derive true when some witness satisfies the body, carry the witness binding, and preserve an `exists` goal in the proof tree.",
  narration:
    "Alice is Cara's grandparent if there exists a middle person Y such that Alice is parent of Y and Y is parent of Cara. Bob is that witness, so the proof should carry Y = bob under an exists goal rather than an unknown empty conjunction placeholder.",
  build(kb) {
    kb.asserts(parent({ parent: alice, child: bob }), { source: "family_tree" });
    kb.asserts(parent({ parent: bob, child: cara }), { source: "family_tree" });
    const rule = kb.rule(grandparent({ grandparent: X, grandchild: Z })).iff(grandparentBody);

    return { rule };
  },
  queryAtoms: grandparent({ grandparent: alice, grandchild: cara }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: {
        literals: [
          {
            sign: "+",
            atom: parent({ parent: alice, child: bob }),
            metadata: { source: "family_tree" },
          },
          {
            sign: "+",
            atom: parent({ parent: bob, child: cara }),
            metadata: { source: "family_tree" },
          },
        ],
        rules: [rule],
      },
      expectedProofs: {
        value: "true",
        goal: {
          kind: "atom",
          atom: grandparent({ grandparent: alice, grandchild: cara }),
        },
        bindings: [],
        positive: [
          {
            source: "rule",
            rule,
            body: {
              value: "true",
              goal: {
                kind: "exists",
                variables: [Y],
                goal: {
                  kind: "and",
                  goals: [
                    { kind: "atom", atom: parent({ parent: alice, child: bob }) },
                    { kind: "atom", atom: parent({ parent: bob, child: cara }) },
                  ],
                },
              },
              bindings: [
                [X, alice],
                [Z, cara],
                [Y, bob],
              ],
              positive: [
                {
                  source: "subgoals",
                  judgments: [
                    {
                      value: "true",
                      goal: {
                        kind: "and",
                        goals: [
                          { kind: "atom", atom: parent({ parent: alice, child: bob }) },
                          { kind: "atom", atom: parent({ parent: bob, child: cara }) },
                        ],
                      },
                      bindings: [
                        [X, alice],
                        [Z, cara],
                        [Y, bob],
                      ],
                      positive: [
                        {
                          source: "subgoals",
                          judgments: [
                            {
                              value: "true",
                              goal: {
                                kind: "atom",
                                atom: parent({ parent: alice, child: bob }),
                              },
                              bindings: [
                                [X, alice],
                                [Z, cara],
                                [Y, bob],
                              ],
                              positive: [
                                {
                                  source: "evidence",
                                  literals: [
                                    {
                                      sign: "+",
                                      atom: parent({ parent: alice, child: bob }),
                                      metadata: { source: "family_tree" },
                                    },
                                  ],
                                },
                              ],
                            },
                            {
                              value: "true",
                              goal: {
                                kind: "atom",
                                atom: parent({ parent: bob, child: cara }),
                              },
                              bindings: [
                                [X, alice],
                                [Z, cara],
                                [Y, bob],
                              ],
                              positive: [
                                {
                                  source: "evidence",
                                  literals: [
                                    {
                                      sign: "+",
                                      atom: parent({ parent: bob, child: cara }),
                                      metadata: { source: "family_tree" },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };
  },
};

/** Definition-of-done examples for existential quantification over missing relations. */
export const existsMissingRelationTestCases: readonly DslTestSpec[] = [
  {
    name: "DOD: exists over missing open-world relation stays unknown",
    invariant:
      "An existential lookup over an open-world predicate with no matching evidence should remain unknown, not false.",
    narration:
      "Alice has a reviewed score if there exists some score row for her. No reviewed score has been recorded, so the open-world existential remains unknown.",
    build(kb) {
      const rule = kb
        .rule(hasReviewedScore({ person: X }))
        .iff(exists(Score, reviewedScore({ person: X, score: Score })));

      return { rule };
    },
    queryAtoms: hasReviewedScore({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return {
        expectedKnowledgeBase: { literals: [], rules: [rule] },
        expectedProofs: {
          value: "unknown",
          goal: { kind: "atom", atom: hasReviewedScore({ person: alice }) },
          bindings: [],
          inconclusive: [
            {
              source: "rule",
              rule,
              body: {
                value: "unknown",
                goal: {
                  kind: "exists",
                  variables: [Score],
                  goal: {
                    kind: "atom",
                    atom: reviewedScore({ person: X, score: Score }),
                  },
                },
                bindings: [[X, alice]],
                inconclusive: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "unknown",
                        goal: {
                          kind: "atom",
                          atom: reviewedScore({ person: X, score: Score }),
                        },
                        bindings: [[X, alice]],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      };
    },
  },
  {
    name: "DOD: exists over missing closed-world relation is false",
    invariant:
      "An existential lookup over a complete closed-world predicate with no matching evidence should be false.",
    narration:
      "Alice has a final score if the complete score table contains some score row for her. The table has no row, so the existential is false with closed-world absence support.",
    build(kb) {
      const rule = kb
        .rule(hasFinalScore({ person: X }))
        .iff(exists(Score, finalScore({ person: X, score: Score })));

      return { rule };
    },
    queryAtoms: hasFinalScore({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return {
        expectedKnowledgeBase: { literals: [], rules: [rule] },
        expectedProofs: {
          value: "false",
          goal: { kind: "atom", atom: hasFinalScore({ person: alice }) },
          bindings: [],
          negative: [
            {
              source: "rule",
              rule,
              body: {
                value: "false",
                goal: {
                  kind: "exists",
                  variables: [Score],
                  goal: {
                    kind: "atom",
                    atom: finalScore({ person: X, score: Score }),
                  },
                },
                bindings: [[X, alice]],
                negative: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "false",
                        goal: {
                          kind: "atom",
                          atom: finalScore({ person: X, score: Score }),
                        },
                        bindings: [[X, alice]],
                        negative: [{ source: "closed-world-absence" }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      };
    },
  },
];

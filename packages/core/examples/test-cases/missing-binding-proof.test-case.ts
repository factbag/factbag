import { add, and, gt, letIn, predicate, variable, type PredicateSchema } from "../../src/dsl";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const Score = variable("Score");
const AdjustedScore = variable("AdjustedScore");

const reviewedScore = predicate("reviewed_score_for_missing_binding_proof", {
  person: Person,
  score: Number,
});
const scoreEligible = predicate("score_eligible_with_missing_binding_proof", {
  person: Person,
});
const adjustedScoreEligible = predicate("adjusted_score_eligible_with_missing_binding_proof", {
  person: Person,
});

/** Definition-of-done examples for public missing-binding proof vocabulary. */
export const missingBindingProofTestCases: readonly DslTestSpec[] = [
  {
    name: "DOD: missing binding proof explains dependent comparison unknown",
    invariant:
      "When a valid dependent comparison cannot run because a prior open-world lookup did not bind its variable, the proof should expose a public missing-binding reason rather than a bare unknown or internal sentinel.",
    narration:
      "Alice is eligible only if a reviewed score exists and is positive. No reviewed score is present. The query remains unknown, and the comparison proof should say Score is a missing binding.",
    build(kb) {
      const rule = kb
        .rule(scoreEligible({ person: P }))
        .iff(and(reviewedScore({ person: P, score: Score }), gt(Score, 0)));

      return { rule };
    },
    queryAtoms: scoreEligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return {
        expectedKnowledgeBase: { literals: [], rules: [rule] },
        expectedProofs: {
          value: "unknown",
          goal: { kind: "atom", atom: scoreEligible({ person: alice }) },
          bindings: [],
          inconclusive: [
            {
              source: "rule",
              rule,
              body: {
                value: "unknown",
                goal: {
                  kind: "and",
                  goals: [
                    {
                      kind: "atom",
                      atom: reviewedScore({ person: P, score: Score }),
                    },
                    { kind: "gt", left: Score, right: 0 },
                  ],
                },
                bindings: [[P, alice]],
                inconclusive: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "unknown",
                        goal: {
                          kind: "atom",
                          atom: reviewedScore({ person: P, score: Score }),
                        },
                        bindings: [[P, alice]],
                      },
                      {
                        value: "unknown",
                        goal: { kind: "gt", left: Score, right: 0 },
                        bindings: [[P, alice]],
                        inconclusive: [
                          {
                            source: "primitive",
                            evaluation: {
                              operation: "gt",
                              operands: [{ kind: "missing-binding", variable: Score }, 0],
                              value: "unknown",
                              uncertainty: [{ kind: "missing-binding", variable: Score }],
                            },
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
  },
  {
    name: "DOD: missing binding proof explains dependent arithmetic unknown",
    invariant:
      "When a valid dependent arithmetic expression cannot run because a prior open-world lookup did not bind its input, the proof should expose the missing input binding and avoid binding the arithmetic target.",
    narration:
      "Alice is eligible only if a reviewed score can be adjusted upward and remains positive. No reviewed score is present. The arithmetic proof should say Score is missing, and the comparison should say AdjustedScore is missing because the arithmetic did not bind it.",
    build(kb) {
      const rule = kb
        .rule(adjustedScoreEligible({ person: P }))
        .iff(
          and(
            reviewedScore({ person: P, score: Score }),
            letIn(AdjustedScore, add(Score, 1), gt(AdjustedScore, 0)),
          ),
        );

      return { rule };
    },
    queryAtoms: adjustedScoreEligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return {
        expectedKnowledgeBase: { literals: [], rules: [rule] },
        expectedProofs: {
          value: "unknown",
          goal: { kind: "atom", atom: adjustedScoreEligible({ person: alice }) },
          bindings: [],
          inconclusive: [
            {
              source: "rule",
              rule,
              body: {
                value: "unknown",
                goal: {
                  kind: "and",
                  goals: [
                    {
                      kind: "atom",
                      atom: reviewedScore({ person: P, score: Score }),
                    },
                    {
                      kind: "and",
                      goals: [
                        { kind: "add", bind: AdjustedScore, left: Score, right: 1 },
                        { kind: "gt", left: AdjustedScore, right: 0 },
                      ],
                    },
                  ],
                },
                bindings: [[P, alice]],
                inconclusive: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "unknown",
                        goal: {
                          kind: "atom",
                          atom: reviewedScore({ person: P, score: Score }),
                        },
                        bindings: [[P, alice]],
                      },
                      {
                        value: "unknown",
                        goal: {
                          kind: "and",
                          goals: [
                            { kind: "add", bind: AdjustedScore, left: Score, right: 1 },
                            { kind: "gt", left: AdjustedScore, right: 0 },
                          ],
                        },
                        bindings: [[P, alice]],
                        inconclusive: [
                          {
                            source: "subgoals",
                            judgments: [
                              {
                                value: "unknown",
                                goal: { kind: "add", bind: AdjustedScore, left: Score, right: 1 },
                                bindings: [[P, alice]],
                                inconclusive: [
                                  {
                                    source: "primitive",
                                    evaluation: {
                                      operation: "add",
                                      operands: [{ kind: "missing-binding", variable: Score }, 1],
                                      value: "unknown",
                                      uncertainty: [{ kind: "missing-binding", variable: Score }],
                                    },
                                  },
                                ],
                              },
                              {
                                value: "unknown",
                                goal: { kind: "gt", left: AdjustedScore, right: 0 },
                                bindings: [[P, alice]],
                                inconclusive: [
                                  {
                                    source: "primitive",
                                    evaluation: {
                                      operation: "gt",
                                      operands: [
                                        { kind: "missing-binding", variable: AdjustedScore },
                                        0,
                                      ],
                                      value: "unknown",
                                      uncertainty: [
                                        { kind: "missing-binding", variable: AdjustedScore },
                                      ],
                                    },
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
  },
];

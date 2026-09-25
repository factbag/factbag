import { add, and, gt, letIn, or, predicate, variable, type PredicateSchema } from "../../src/dsl";
import type { Rule } from "../../src/knowledge-base";
import type { Bindings } from "../../src/types/common";
import type { Judgment } from "../../src/types/judgment";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const Score = variable("Score");
const AdjustedScore = variable("AdjustedScore");
const TwiceAdjustedScore = variable("TwiceAdjustedScore");
const OverrideScore = variable("OverrideScore");
const eligible = predicate("eligible_with_open_world_score", { person: Person });
const adjustedEligible = predicate("adjusted_eligible_with_open_world_score", { person: Person });
const twiceAdjustedEligible = predicate("twice_adjusted_eligible_with_open_world_score", {
  person: Person,
});
const fallbackEligible = predicate("fallback_eligible_with_open_world_score", { person: Person });
const fallbackAdjustedEligible = predicate("fallback_adjusted_eligible_with_open_world_score", {
  person: Person,
});
const reviewedScore = predicate("reviewed_score_for_open_world_primitive", {
  person: Person,
  score: Number,
});
const overrideScore = predicate("override_score_for_open_world_primitive", {
  person: Person,
  score: Number,
});

/** Definition-of-done example for preserving unknown through dependent primitives. */
export const openWorldUnboundPrimitiveTestCase: DslTestSpec = {
  name: "DOD: missing open-world binder keeps dependent primitive unknown",
  invariant:
    "A primitive that depends on a syntactically valid open-world binder should remain unknown when that binder has no evidence, not collapse the rule body to false.",
  narration:
    "Alice is eligible only if a reviewed score exists for her and that score is positive. No review score has been recorded for Alice, so her eligibility is not established or ruled out.",
  build(kb) {
    const rule = kb
      .rule(eligible({ person: P }))
      .iff(and(reviewedScore({ person: P, score: Score }), gt(Score, 0)));

    return { rule };
  },
  queryAtoms: eligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedProofs: {
        value: "unknown",
        goal: { kind: "atom", atom: eligible({ person: alice }) },
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
                subgoals([reviewedScoreUnknown([[P, alice]]), gtUnknown(Score, [[P, alice]])]),
              ],
            },
          },
        ],
      },
    };
  },
};

/** Definition-of-done example for preserving unknown through nested dependent arithmetic. */
export const openWorldUnboundNestedArithmeticTestCase: DslTestSpec = {
  name: "DOD: missing open-world binder keeps nested arithmetic unknown",
  invariant:
    "Nested arithmetic that depends on a missing open-world binder should remain unknown without binding unavailable intermediate values into public proof output.",
  narration:
    "Alice is eligible only if a reviewed score can be adjusted twice and remains positive. No review score has been recorded, so neither arithmetic target is publicly bound and the route stays unknown.",
  build(kb) {
    const rule = kb
      .rule(twiceAdjustedEligible({ person: P }))
      .iff(
        and(
          reviewedScore({ person: P, score: Score }),
          letIn(
            AdjustedScore,
            add(Score, 1),
            letIn(TwiceAdjustedScore, add(AdjustedScore, 1), gt(TwiceAdjustedScore, 0)),
          ),
        ),
      );

    return { rule };
  },
  queryAtoms: twiceAdjustedEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedProofs: {
        value: "unknown",
        goal: { kind: "atom", atom: twiceAdjustedEligible({ person: alice }) },
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
                      {
                        kind: "add",
                        bind: AdjustedScore,
                        left: Score,
                        right: 1,
                      },
                      {
                        kind: "and",
                        goals: [
                          {
                            kind: "add",
                            bind: TwiceAdjustedScore,
                            left: AdjustedScore,
                            right: 1,
                          },
                          { kind: "gt", left: TwiceAdjustedScore, right: 0 },
                        ],
                      },
                    ],
                  },
                ],
              },
              bindings: [[P, alice]],
              inconclusive: [
                subgoals([
                  reviewedScoreUnknown([[P, alice]]),
                  nestedArithmeticUnknown([[P, alice]]),
                ]),
              ],
            },
          },
        ],
      },
    };
  },
};

/** Definition-of-done example for preserving unknown through dependent arithmetic. */
export const openWorldUnboundArithmeticTestCase: DslTestSpec = {
  name: "DOD: missing open-world binder keeps dependent arithmetic unknown",
  invariant:
    "Arithmetic that depends on a syntactically valid open-world binder should remain unknown when that binder has no evidence, not throw or bind an unavailable value into public proof output.",
  narration:
    "Alice is eligible only if a reviewed score exists for her and her adjusted score is positive. No review score has been recorded for Alice, so her adjusted eligibility is not established or ruled out.",
  build(kb) {
    const rule = kb
      .rule(adjustedEligible({ person: P }))
      .iff(
        and(
          reviewedScore({ person: P, score: Score }),
          letIn(AdjustedScore, add(Score, 1), gt(AdjustedScore, 0)),
        ),
      );

    return { rule };
  },
  queryAtoms: adjustedEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedProofs: {
        value: "unknown",
        goal: { kind: "atom", atom: adjustedEligible({ person: alice }) },
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
                      {
                        kind: "add",
                        bind: AdjustedScore,
                        left: Score,
                        right: 1,
                      },
                      { kind: "gt", left: AdjustedScore, right: 0 },
                    ],
                  },
                ],
              },
              bindings: [[P, alice]],
              inconclusive: [
                subgoals([reviewedScoreUnknown([[P, alice]]), adjustedScoreUnknown([[P, alice]])]),
              ],
            },
          },
        ],
      },
    };
  },
};

/** Definition-of-done example for preserving an inconclusive primitive branch through disjunction. */
export const openWorldUnboundPrimitiveOrTestCase: DslTestSpec = {
  name: "DOD: or preserves unknown primitive branch over false branch",
  invariant:
    "An `or` branch that is unknown because a valid open-world binder has no evidence should dominate a separate false primitive branch as unknown, not disappear as false.",
  narration:
    "Alice is eligible if she has a positive reviewed score or a positive override score. Alice has no reviewed score, and her recorded override score is not positive, so eligibility is not established or ruled out.",
  build(kb) {
    kb.asserts(overrideScore({ person: alice, score: 0 }), {
      source: "override_score_registry",
    });
    const rule = kb
      .rule(fallbackEligible({ person: P }))
      .iff(
        or(
          and(reviewedScore({ person: P, score: Score }), gt(Score, 0)),
          and(overrideScore({ person: P, score: OverrideScore }), gt(OverrideScore, 0)),
        ),
      );

    return { rule };
  },
  queryAtoms: fallbackEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: {
        literals: [
          {
            sign: "+",
            atom: overrideScore({ person: alice, score: 0 }),
            metadata: { source: "override_score_registry" },
          },
        ],
        rules: [rule],
      },
      expectedProofs: {
        value: "unknown",
        goal: { kind: "atom", atom: fallbackEligible({ person: alice }) },
        bindings: [],
        inconclusive: [
          {
            source: "rule",
            rule,
            body: {
              value: "unknown",
              goal: {
                kind: "or",
                goals: [
                  {
                    kind: "and",
                    goals: [
                      {
                        kind: "atom",
                        atom: reviewedScore({ person: P, score: Score }),
                      },
                      { kind: "gt", left: Score, right: 0 },
                    ],
                  },
                  {
                    kind: "and",
                    goals: [
                      {
                        kind: "atom",
                        atom: overrideScore({ person: alice, score: 0 }),
                      },
                      { kind: "gt", left: OverrideScore, right: 0 },
                    ],
                  },
                ],
              },
              bindings: [
                [P, alice],
                [OverrideScore, 0],
              ],
              inconclusive: [
                subgoals([
                  reviewedScorePositiveUnknown([
                    [P, alice],
                    [OverrideScore, 0],
                  ]),
                  overrideScorePositiveFalse([
                    [P, alice],
                    [OverrideScore, 0],
                  ]),
                ]),
              ],
            },
          },
        ],
      },
    };
  },
};

/** Definition-of-done example for preserving an inconclusive arithmetic branch through disjunction. */
export const openWorldUnboundArithmeticOrTestCase: DslTestSpec = {
  name: "DOD: or preserves unknown arithmetic branch over false branch",
  invariant:
    "An `or` branch that is unknown because dependent arithmetic has an unavailable open-world operand should dominate a separate false primitive branch as unknown.",
  narration:
    "Alice is eligible if either her adjusted reviewed score is positive or her override score is positive. The reviewed score is missing and the override score is zero, so the result stays unknown rather than false.",
  build(kb) {
    kb.asserts(overrideScore({ person: alice, score: 0 }), {
      source: "override_score_registry",
    });
    const rule = kb
      .rule(fallbackAdjustedEligible({ person: P }))
      .iff(
        or(
          and(
            reviewedScore({ person: P, score: Score }),
            letIn(AdjustedScore, add(Score, 1), gt(AdjustedScore, 0)),
          ),
          and(overrideScore({ person: P, score: OverrideScore }), gt(OverrideScore, 0)),
        ),
      );

    return { rule };
  },
  queryAtoms: fallbackAdjustedEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: {
        literals: [
          {
            sign: "+",
            atom: overrideScore({ person: alice, score: 0 }),
            metadata: { source: "override_score_registry" },
          },
        ],
        rules: [rule],
      },
      expectedProofs: {
        value: "unknown",
        goal: { kind: "atom", atom: fallbackAdjustedEligible({ person: alice }) },
        bindings: [],
        inconclusive: [
          {
            source: "rule",
            rule,
            body: {
              value: "unknown",
              goal: {
                kind: "or",
                goals: [
                  {
                    kind: "and",
                    goals: [
                      {
                        kind: "atom",
                        atom: reviewedScore({ person: P, score: Score }),
                      },
                      {
                        kind: "and",
                        goals: [
                          {
                            kind: "add",
                            bind: AdjustedScore,
                            left: Score,
                            right: 1,
                          },
                          { kind: "gt", left: AdjustedScore, right: 0 },
                        ],
                      },
                    ],
                  },
                  {
                    kind: "and",
                    goals: [
                      {
                        kind: "atom",
                        atom: overrideScore({ person: alice, score: 0 }),
                      },
                      { kind: "gt", left: OverrideScore, right: 0 },
                    ],
                  },
                ],
              },
              bindings: [
                [P, alice],
                [OverrideScore, 0],
              ],
              inconclusive: [
                subgoals([
                  reviewedAdjustedScorePositiveUnknown([
                    [P, alice],
                    [OverrideScore, 0],
                  ]),
                  overrideScorePositiveFalse([
                    [P, alice],
                    [OverrideScore, 0],
                  ]),
                ]),
              ],
            },
          },
        ],
      },
    };
  },
};

function subgoals(judgments: readonly Judgment[]) {
  return { source: "subgoals" as const, judgments };
}

function reviewedScoreUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "atom" as const,
      atom: reviewedScore({ person: P, score: Score }),
    },
    bindings,
  };
}

function reviewedScorePositiveUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "and" as const,
      goals: [
        {
          kind: "atom" as const,
          atom: reviewedScore({ person: P, score: Score }),
        },
        { kind: "gt" as const, left: Score, right: 0 },
      ],
    },
    bindings,
    inconclusive: [subgoals([reviewedScoreUnknown(bindings), gtUnknown(Score, bindings)])],
  };
}

function reviewedAdjustedScorePositiveUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "and" as const,
      goals: [
        {
          kind: "atom" as const,
          atom: reviewedScore({ person: P, score: Score }),
        },
        {
          kind: "and" as const,
          goals: [
            { kind: "add" as const, bind: AdjustedScore, left: Score, right: 1 },
            { kind: "gt" as const, left: AdjustedScore, right: 0 },
          ],
        },
      ],
    },
    bindings,
    inconclusive: [subgoals([reviewedScoreUnknown(bindings), adjustedScoreUnknown(bindings)])],
  };
}

function adjustedScoreUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "and" as const,
      goals: [
        { kind: "add" as const, bind: AdjustedScore, left: Score, right: 1 },
        { kind: "gt" as const, left: AdjustedScore, right: 0 },
      ],
    },
    bindings,
    inconclusive: [
      subgoals([addUnknown(AdjustedScore, Score, bindings), gtUnknown(AdjustedScore, bindings)]),
    ],
  };
}

function nestedArithmeticUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "and" as const,
      goals: [
        { kind: "add" as const, bind: AdjustedScore, left: Score, right: 1 },
        {
          kind: "and" as const,
          goals: [
            { kind: "add" as const, bind: TwiceAdjustedScore, left: AdjustedScore, right: 1 },
            { kind: "gt" as const, left: TwiceAdjustedScore, right: 0 },
          ],
        },
      ],
    },
    bindings,
    inconclusive: [
      subgoals([addUnknown(AdjustedScore, Score, bindings), twiceAdjustedScoreUnknown(bindings)]),
    ],
  };
}

function twiceAdjustedScoreUnknown(bindings: Bindings): Judgment {
  return {
    value: "unknown" as const,
    goal: {
      kind: "and" as const,
      goals: [
        { kind: "add" as const, bind: TwiceAdjustedScore, left: AdjustedScore, right: 1 },
        { kind: "gt" as const, left: TwiceAdjustedScore, right: 0 },
      ],
    },
    bindings,
    inconclusive: [
      subgoals([
        addUnknown(TwiceAdjustedScore, AdjustedScore, bindings),
        gtUnknown(TwiceAdjustedScore, bindings),
      ]),
    ],
  };
}

function addUnknown(
  bind: typeof AdjustedScore | typeof TwiceAdjustedScore,
  left: typeof Score | typeof AdjustedScore,
  bindings: Bindings,
): Judgment {
  return {
    value: "unknown" as const,
    goal: { kind: "add" as const, bind, left, right: 1 },
    bindings,
    inconclusive: [
      {
        source: "primitive" as const,
        evaluation: {
          operation: "add" as const,
          operands: [{ kind: "missing-binding" as const, variable: left }, 1],
          value: "unknown" as const,
          uncertainty: [{ kind: "missing-binding" as const, variable: left }],
        },
      },
    ],
  };
}

function gtUnknown(
  scoreVariable: typeof Score | typeof AdjustedScore | typeof TwiceAdjustedScore,
  bindings: Bindings,
): Judgment {
  return {
    value: "unknown" as const,
    goal: { kind: "gt" as const, left: scoreVariable, right: 0 },
    bindings,
    inconclusive: [
      {
        source: "primitive" as const,
        evaluation: {
          operation: "gt" as const,
          operands: [{ kind: "missing-binding" as const, variable: scoreVariable }, 0],
          value: "unknown" as const,
          uncertainty: [{ kind: "missing-binding" as const, variable: scoreVariable }],
        },
      },
    ],
  };
}

function overrideScorePositiveFalse(bindings: Bindings): Judgment {
  return {
    value: "false" as const,
    goal: {
      kind: "and" as const,
      goals: [
        { kind: "atom" as const, atom: overrideScore({ person: alice, score: 0 }) },
        { kind: "gt" as const, left: OverrideScore, right: 0 },
      ],
    },
    bindings,
    negative: [subgoals([overrideScoreTrue(bindings), gtFalse(OverrideScore, bindings)])],
  };
}

function overrideScoreTrue(bindings: Bindings): Judgment {
  return {
    value: "true" as const,
    goal: { kind: "atom" as const, atom: overrideScore({ person: alice, score: 0 }) },
    bindings,
    positive: [
      {
        source: "evidence" as const,
        literals: [
          {
            sign: "+" as const,
            atom: overrideScore({ person: alice, score: 0 }),
            metadata: { source: "override_score_registry" },
          },
        ],
      },
    ],
  };
}

function gtFalse(scoreVariable: typeof OverrideScore, bindings: Bindings): Judgment {
  return {
    value: "false" as const,
    goal: { kind: "gt" as const, left: scoreVariable, right: 0 },
    bindings,
    negative: [
      {
        source: "primitive" as const,
        evaluation: {
          operation: "gt" as const,
          operands: [0, 0],
          value: "false" as const,
        },
      },
    ],
  };
}

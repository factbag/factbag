import { count, gt, gte, letIn, sum } from "../../src/dsl";
import {
  alice,
  Amount,
  annualIncomeOver200k,
  Count,
  incomeFact,
  incomeReviewComplete,
  multipleIncomeSources,
  Total,
  y2023,
  y2024,
} from "../scenarios/accredited-investor";
import { P, Y } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: aggregate completeness.
 *
 * An aggregate often needs a second question: are we summing a complete reviewed
 * record, or only the facts known so far? `sum(value).where(body, { completeWhen })`
 * keeps the completeness condition attached to the aggregate. If the known total
 * is below threshold but the record is not yet complete, the route stays unknown
 * rather than collapsing to false.
 */
const incomeRule = {
  head: { sign: "+", atom: annualIncomeOver200k({ person: P, year: Y }) },
  kind: "iff",
  body: letIn(
    Total,
    sum(Amount).where(incomeFact({ person: P, year: Y, amountCents: Amount }), {
      completeWhen: incomeReviewComplete({ person: P, year: Y }),
    }),
    gt(Total, 20_000_000),
  ),
} as const;

/**
 * `count(...).where(body)` runs through the same aggregate machinery as `sum`, but
 * thresholds the number of matching rows (cardinality) rather than a value total.
 */
const incomeSourceCountRule = {
  head: { sign: "+", atom: multipleIncomeSources({ person: P }) },
  kind: "iff",
  body: letIn(
    Count,
    count(Amount).where(incomeFact({ person: P, year: Y, amountCents: Amount })),
    gte(Count, 2),
  ),
} as const;

export const aggregateCompletenessTestCases: readonly DslTestSpec[] = [
  {
    name: "aggregate completeness: complete record over threshold is true",
    invariant:
      "When the reviewed income record is complete and the summed amount exceeds the threshold, the rule derives true from the income rows and the completeness marker.",
    narration:
      "Alice's reviewed 2024 income of 246,800 (24,680,000 cents) is marked complete and exceeds the 200,000 threshold, so annual_income_over_200k derives true with axiom children for the income fact and the completeness marker.",
    build(kb) {
      kb.asserts(incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }), {
        source: "2024_w2",
        citation: "Wages, tips, other compensation: 246,800",
      });
      kb.asserts(incomeReviewComplete({ person: alice, year: y2024 }), {
        source: "expert_review",
      });
      kb.rule(annualIncomeOver200k({ person: P, year: Y })).iff(incomeRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: incomeFact({
            person: alice,
            year: y2024,
            amountCents: 24_680_000,
          }),
          metadata: {
            source: "2024_w2",
            citation: "Wages, tips, other compensation: 246,800",
          },
        },
        {
          sign: "+",
          atom: incomeReviewComplete({ person: alice, year: y2024 }),
          metadata: { source: "expert_review" },
        },
      ],
      rules: [incomeRule],
    },
    queryAtoms: annualIncomeOver200k({ person: alice, year: y2024 }),
    expectedProofs: {
      value: "true",
      goal: {
        kind: "atom",
        atom: annualIncomeOver200k({ person: alice, year: y2024 }),
      },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: incomeRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "sum",
                  bind: Total,
                  value: Amount,
                  where: {
                    kind: "atom",
                    atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
                  },
                },
                { kind: "gt", left: Total, right: 20_000_000 },
              ],
            },
            bindings: [
              [P, alice],
              [Y, y2024],
              [Total, 24_680_000],
            ],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "sum",
                      bind: Total,
                      value: Amount,
                      where: {
                        kind: "atom",
                        atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
                      },
                    },
                    bindings: [
                      [P, alice],
                      [Y, y2024],
                      [Total, 24_680_000],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "sum",
                          operands: [24_680_000],
                          value: "true",
                          result: 24_680_000,
                          results: [[Total, 24_680_000]],
                          range: { lower: 24_680_000, upper: 24_680_000 },
                        },
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "gt", left: Total, right: 20_000_000 },
                    bindings: [
                      [P, alice],
                      [Y, y2024],
                      [Total, 24_680_000],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "gt",
                          operands: [24_680_000, 20_000_000],
                          value: "true",
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
  },
  {
    name: "aggregate completeness: incomplete record stays unknown",
    invariant:
      "Without the completeness marker, the aggregate is not known to be complete, so a known total cannot make the route false; the conclusion stays unknown.",
    narration:
      "Alice has the same income fact but no completeness marker for 2024. Because the reviewed record is not known to be complete, annual_income_over_200k remains unknown rather than false.",
    build(kb) {
      kb.asserts(incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }), {
        source: "2024_w2",
        citation: "Wages, tips, other compensation: 246,800",
      });
      kb.rule(annualIncomeOver200k({ person: P, year: Y })).iff(incomeRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: incomeFact({
            person: alice,
            year: y2024,
            amountCents: 24_680_000,
          }),
          metadata: {
            source: "2024_w2",
            citation: "Wages, tips, other compensation: 246,800",
          },
        },
      ],
      rules: [incomeRule],
    },
    queryAtoms: annualIncomeOver200k({ person: alice, year: y2024 }),
    expectedProofs: {
      value: "unknown",
      goal: {
        kind: "atom",
        atom: annualIncomeOver200k({ person: alice, year: y2024 }),
      },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: incomeRule,
          body: {
            value: "unknown",
            goal: {
              kind: "sum",
              bind: Total,
              value: Amount,
              where: {
                kind: "atom",
                atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
              },
              completeWhen: {
                kind: "atom",
                atom: incomeReviewComplete({ person: alice, year: y2024 }),
              },
            },
            bindings: [
              [P, alice],
              [Y, y2024],
            ],
          },
        },
      ],
    },
  },
  {
    name: "DOD: aggregate incompleteness keeps meaningful unknown proof shape",
    invariant:
      "When aggregate completeness is unknown, the query should remain unknown with inconclusive support that preserves the aggregate and completeWhen goal.",
    narration:
      "Alice has an income row but no complete-review marker. The annual-income query should stay unknown, and its proof should show that the sum was blocked by missing completeness instead of returning a bare unknown atom.",
    build(kb) {
      kb.asserts(incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }), {
        source: "2024_w2",
      });
      kb.rule(annualIncomeOver200k({ person: P, year: Y })).iff(incomeRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
          metadata: { source: "2024_w2" },
        },
      ],
      rules: [incomeRule],
    },
    queryAtoms: annualIncomeOver200k({ person: alice, year: y2024 }),
    expectedProofs: {
      value: "unknown",
      goal: {
        kind: "atom",
        atom: annualIncomeOver200k({ person: alice, year: y2024 }),
      },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: incomeRule,
          body: {
            value: "unknown",
            goal: {
              kind: "sum",
              bind: Total,
              value: Amount,
              where: {
                kind: "atom",
                atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
              },
              completeWhen: {
                kind: "atom",
                atom: incomeReviewComplete({ person: alice, year: y2024 }),
              },
            },
            bindings: [
              [P, alice],
              [Y, y2024],
            ],
          },
        },
      ],
    },
  },
  {
    name: "count aggregate: row count meets the cardinality threshold",
    invariant:
      "count over matching income facts yields the number of rows; when that count is at least 2, the rule derives true with an axiom child per counted row.",
    narration:
      "Alice has income facts for 2023 and 2024. Counting matching income rows gives 2, which meets the threshold, so multiple_income_sources derives true with an axiom child for each counted income fact.",
    build(kb) {
      kb.asserts(incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }), {
        source: "2024_w2",
      });
      kb.asserts(incomeFact({ person: alice, year: y2023, amountCents: 21_000_000 }), {
        source: "2023_w2",
      });
      kb.rule(multipleIncomeSources({ person: P })).iff(incomeSourceCountRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: incomeFact({
            person: alice,
            year: y2024,
            amountCents: 24_680_000,
          }),
          metadata: { source: "2024_w2" },
        },
        {
          sign: "+",
          atom: incomeFact({
            person: alice,
            year: y2023,
            amountCents: 21_000_000,
          }),
          metadata: { source: "2023_w2" },
        },
      ],
      rules: [incomeSourceCountRule],
    },
    queryAtoms: multipleIncomeSources({ person: alice }),
    expectedProofs: {
      value: "true",
      goal: { kind: "atom", atom: multipleIncomeSources({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: incomeSourceCountRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "count",
                  bind: Count,
                  where: {
                    kind: "or",
                    goals: [
                      {
                        kind: "atom",
                        atom: incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }),
                      },
                      {
                        kind: "atom",
                        atom: incomeFact({ person: alice, year: y2023, amountCents: 21_000_000 }),
                      },
                    ],
                  },
                },
                { kind: "gte", left: Count, right: 2 },
              ],
            },
            bindings: [
              [P, alice],
              [
                Count,
                {
                  kind: "numeric-range",
                  lower: 2,
                  upper: "infinity",
                  uncertainty: [{ kind: "open-world" }],
                },
              ],
            ],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "count",
                      bind: Count,
                      where: {
                        kind: "or",
                        goals: [
                          {
                            kind: "atom",
                            atom: incomeFact({
                              person: alice,
                              year: y2024,
                              amountCents: 24_680_000,
                            }),
                          },
                          {
                            kind: "atom",
                            atom: incomeFact({
                              person: alice,
                              year: y2023,
                              amountCents: 21_000_000,
                            }),
                          },
                        ],
                      },
                    },
                    bindings: [
                      [P, alice],
                      [
                        Count,
                        {
                          kind: "numeric-range",
                          lower: 2,
                          upper: "infinity",
                          uncertainty: [{ kind: "open-world" }],
                        },
                      ],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "count",
                          operands: [],
                          value: "true",
                          result: {
                            kind: "numeric-range",
                            lower: 2,
                            upper: "infinity",
                            uncertainty: [{ kind: "open-world" }],
                          },
                          results: [
                            [
                              Count,
                              {
                                kind: "numeric-range",
                                lower: 2,
                                upper: "infinity",
                                uncertainty: [{ kind: "open-world" }],
                              },
                            ],
                          ],
                          range: { lower: 2, upper: "infinity" },
                          uncertainty: [{ kind: "open-world" }],
                        },
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "gte", left: Count, right: 2 },
                    bindings: [
                      [P, alice],
                      [
                        Count,
                        {
                          kind: "numeric-range",
                          lower: 2,
                          upper: "infinity",
                          uncertainty: [{ kind: "open-world" }],
                        },
                      ],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "gte",
                          operands: [
                            {
                              kind: "numeric-range",
                              lower: 2,
                              upper: "infinity",
                              uncertainty: [{ kind: "open-world" }],
                            },
                            2,
                          ],
                          value: "true",
                          range: { lower: 2, upper: "infinity" },
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
  },
];

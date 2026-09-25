import {
  add,
  and,
  closedPredicate,
  gte,
  gt,
  letIn,
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
const P = variable("P");
const Amount = variable("Amount");
const AdjustedAmount = variable("AdjustedAmount");
const loanEligible = predicate("loan_eligible_with_preapproval", { person: Person });
const adjustedLoanEligible = predicate("adjusted_loan_eligible_with_preapproval", {
  person: Person,
});
const preapprovedOffer = closedPredicate("preapproved_offer", {
  person: Person,
  amount: Number,
});

/** Definition-of-done example for positive closed-world absence. */
export const closedWorldPositiveBoundaryTestCase: DslTestSpec = {
  name: "DOD: missing closed-world binder makes positive lookup false",
  invariant:
    "A positive atom over a closed-world predicate denotes a complete-table lookup: missing matching evidence is false, not unknown.",
  narration:
    "Alice is eligible only if the lender's finalized preapproval table contains an offer for her of at least 10000. Alice has no preapproved offer row, so the eligibility criterion is not satisfied.",
  build(kb) {
    const rule = kb
      .rule(loanEligible({ person: P }))
      .iff(and(preapprovedOffer({ person: P, amount: Amount }), gte(Amount, 10_000)));

    return { rule };
  },
  queryAtoms: loanEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedProofs: {
        value: "false",
        goal: { kind: "atom", atom: loanEligible({ person: alice }) },
        bindings: [],
        negative: [
          {
            source: "rule",
            rule,
            body: {
              value: "false",
              goal: {
                kind: "and",
                goals: [
                  {
                    kind: "atom",
                    atom: preapprovedOffer({ person: P, amount: Amount }),
                  },
                  { kind: "gte", left: Amount, right: 10_000 },
                ],
              },
              bindings: [[P, alice]],
              negative: [
                {
                  source: "subgoals",
                  judgments: [
                    {
                      value: "false",
                      goal: {
                        kind: "atom",
                        atom: preapprovedOffer({ person: P, amount: Amount }),
                      },
                      bindings: [[P, alice]],
                      negative: [{ source: "closed-world-absence" }],
                    },
                    {
                      value: "unknown",
                      goal: { kind: "gte", left: Amount, right: 10_000 },
                      bindings: [[P, alice]],
                      inconclusive: [
                        {
                          source: "primitive",
                          evaluation: {
                            operation: "gte",
                            operands: [{ kind: "missing-binding", variable: Amount }, 10_000],
                            value: "unknown",
                            uncertainty: [{ kind: "missing-binding", variable: Amount }],
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
};

/** Definition-of-done example for closed-world absence through dependent arithmetic. */
export const closedWorldPositiveArithmeticBoundaryTestCase: DslTestSpec = {
  name: "DOD: missing closed-world binder makes dependent arithmetic false",
  invariant:
    "Dependent arithmetic after a missing closed-world lookup must not soften complete-table absence into open-world unknown.",
  narration:
    "Alice is eligible only if the finalized preapproval table contains an offer whose adjusted amount is positive. The table has no row for Alice, so the route is false even though the dependent arithmetic cannot resolve an amount.",
  build(kb) {
    const rule = kb
      .rule(adjustedLoanEligible({ person: P }))
      .iff(
        and(
          preapprovedOffer({ person: P, amount: Amount }),
          letIn(AdjustedAmount, add(Amount, 1), gt(AdjustedAmount, 0)),
        ),
      );

    return { rule };
  },
  queryAtoms: adjustedLoanEligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedProofs: {
        value: "false",
        goal: { kind: "atom", atom: adjustedLoanEligible({ person: alice }) },
        bindings: [],
        negative: [
          {
            source: "rule",
            rule,
            body: {
              value: "false",
              goal: {
                kind: "and",
                goals: [
                  {
                    kind: "atom",
                    atom: preapprovedOffer({ person: P, amount: Amount }),
                  },
                  {
                    kind: "and",
                    goals: [
                      {
                        kind: "add",
                        bind: AdjustedAmount,
                        left: Amount,
                        right: 1,
                      },
                      { kind: "gt", left: AdjustedAmount, right: 0 },
                    ],
                  },
                ],
              },
              bindings: [[P, alice]],
              negative: [
                {
                  source: "subgoals",
                  judgments: [
                    {
                      value: "false",
                      goal: {
                        kind: "atom",
                        atom: preapprovedOffer({ person: P, amount: Amount }),
                      },
                      bindings: [[P, alice]],
                      negative: [{ source: "closed-world-absence" }],
                    },
                    {
                      value: "unknown",
                      goal: {
                        kind: "and",
                        goals: [
                          {
                            kind: "add",
                            bind: AdjustedAmount,
                            left: Amount,
                            right: 1,
                          },
                          { kind: "gt", left: AdjustedAmount, right: 0 },
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
                                kind: "add",
                                bind: AdjustedAmount,
                                left: Amount,
                                right: 1,
                              },
                              bindings: [[P, alice]],
                              inconclusive: [
                                {
                                  source: "primitive",
                                  evaluation: {
                                    operation: "add",
                                    operands: [{ kind: "missing-binding", variable: Amount }, 1],
                                    value: "unknown",
                                    uncertainty: [{ kind: "missing-binding", variable: Amount }],
                                  },
                                },
                              ],
                            },
                            {
                              value: "unknown",
                              goal: { kind: "gt", left: AdjustedAmount, right: 0 },
                              bindings: [[P, alice]],
                              inconclusive: [
                                {
                                  source: "primitive",
                                  evaluation: {
                                    operation: "gt",
                                    operands: [
                                      { kind: "missing-binding", variable: AdjustedAmount },
                                      0,
                                    ],
                                    value: "unknown",
                                    uncertainty: [
                                      { kind: "missing-binding", variable: AdjustedAmount },
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
};

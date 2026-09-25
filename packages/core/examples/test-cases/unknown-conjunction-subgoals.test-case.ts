import { and, closedPredicate, not, predicate } from "../../src/dsl";
import { Person } from "../scenarios/common";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

const mia = new Person("mia");

const hasCard = predicate("has_card", { person: Person });
const cardRevoked = closedPredicate("card_revoked", { person: Person });
const mayBorrow = predicate("may_borrow", { person: Person });

const borrowRule = {
  head: { sign: "+", atom: mayBorrow({ person: P }) },
  kind: "iff",
  body: and(hasCard({ person: P }), not(cardRevoked({ person: P }))),
} as const;

export const unknownConjunctionSubgoalsTestCase: DslTestSpec = {
  name: "unknown and: subgoal judgments are preserved as inconclusive support",
  invariant:
    "A compound goal that evaluates to unknown still records its subgoal judgments as inconclusive support, so a consumer can see which conjunct is undetermined and which is already settled.",
  narration:
    "Borrowing requires a library card and no revocation. With an empty knowledge base, has_card is open-world unknown while not(card_revoked) is true by closed-world absence. The verdict is unknown — but the proof must not stop there: the and judgment keeps both subproofs, showing that the card is the open question and the revocation check already passed.",
  build(kb) {
    kb.rule(mayBorrow({ person: P })).iff(borrowRule.body);
  },
  expectedKnowledgeBase: {
    literals: [],
    rules: [borrowRule],
  },
  queryAtoms: mayBorrow({ person: mia }),
  expectedProofs: {
    value: "unknown",
    goal: { kind: "atom", atom: mayBorrow({ person: mia }) },
    bindings: [],
    inconclusive: [
      {
        source: "rule",
        rule: borrowRule,
        body: {
          value: "unknown",
          goal: {
            kind: "and",
            goals: [
              { kind: "atom", atom: hasCard({ person: mia }) },
              {
                kind: "not",
                goal: { kind: "atom", atom: cardRevoked({ person: mia }) },
              },
            ],
          },
          bindings: [[P, mia]],
          inconclusive: [
            {
              source: "subgoals",
              judgments: [
                {
                  value: "unknown",
                  goal: { kind: "atom", atom: hasCard({ person: mia }) },
                  bindings: [[P, mia]],
                },
                {
                  value: "true",
                  goal: {
                    kind: "not",
                    goal: { kind: "atom", atom: cardRevoked({ person: mia }) },
                  },
                  bindings: [[P, mia]],
                  positive: [
                    {
                      source: "subgoals",
                      judgments: [
                        {
                          value: "false",
                          goal: { kind: "atom", atom: cardRevoked({ person: mia }) },
                          bindings: [[P, mia]],
                          negative: [{ source: "closed-world-absence" }],
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

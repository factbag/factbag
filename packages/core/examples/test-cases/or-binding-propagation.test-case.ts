import { or, predicate, variable, type PredicateSchema } from "../../src/dsl";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");

const leftPath = predicate("left_path", { person: Person });
const rightPath = predicate("right_path", { person: Person });
const reachable = predicate("reachable", { person: Person });

const reachableBody = or(leftPath({ person: P }), rightPath({ person: P }));

/**
 * Definition-of-done example for disjunction binding propagation.
 *
 * This is expected to fail until `or(...)` carries branch bindings out to the
 * enclosing rule body.
 */
export const orBindingPropagationTestCase: DslTestSpec = {
  name: "DOD: queryAll carries bindings out of or branches",
  invariant:
    "A variable bound inside any true `or` branch must be available to ground the rule head for queryAll candidate enumeration.",
  narration:
    "Alice is reachable if Alice appears in either path predicate. The only evidence is in the right branch, so queryAll(reachable(P)) should still return reachable(alice) with a proof whose or-body records the unknown left branch and true right branch.",
  build(kb) {
    kb.asserts(rightPath({ person: alice }), { source: "right_path_registry" });
    const rule = kb.rule(reachable({ person: P })).iff(reachableBody);

    return { rule };
  },
  queryAtoms: reachable({ person: P }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: {
        literals: [
          {
            sign: "+",
            atom: rightPath({ person: alice }),
            metadata: { source: "right_path_registry" },
          },
        ],
        rules: [rule],
      },
      expectedProofs: [
        {
          value: "true",
          goal: { kind: "atom", atom: reachable({ person: alice }) },
          bindings: [],
          positive: [
            {
              source: "rule",
              rule,
              body: {
                value: "true",
                goal: {
                  kind: "or",
                  goals: [
                    { kind: "atom", atom: leftPath({ person: alice }) },
                    { kind: "atom", atom: rightPath({ person: alice }) },
                  ],
                },
                bindings: [[P, alice]],
                positive: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "unknown",
                        goal: { kind: "atom", atom: leftPath({ person: alice }) },
                        bindings: [[P, alice]],
                      },
                      {
                        value: "true",
                        goal: { kind: "atom", atom: rightPath({ person: alice }) },
                        bindings: [[P, alice]],
                        positive: [
                          {
                            source: "evidence",
                            literals: [
                              {
                                sign: "+",
                                atom: rightPath({ person: alice }),
                                metadata: { source: "right_path_registry" },
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
      ],
    };
  },
};

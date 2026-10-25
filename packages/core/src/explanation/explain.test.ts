/**
 * Asserts that proof judgments render into compact, deterministic explanation
 * JSON across direct evidence, conflicts, unknowns, and closed-world negation.
 */
import { describe, expect, it } from "vitest";
import {
  ceilTo,
  closedPredicate,
  floorTo,
  gte,
  letIn,
  max,
  min,
  not,
  predicate,
  roundTo,
  variable,
} from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";
import type { Explanation } from "./types";
import { explainJudgment } from "./explain";

class Person {
  constructor(readonly id: string) {}
}

type ExplanationCase = Readonly<{
  name: string;
  run: () => Explanation;
  expected: Explanation;
}>;

const alice = new Person("alice");
const bob = new Person("bob");
const cara = new Person("cara");
const drew = new Person("drew");

describe("explainJudgment", () => {
  it.each([min, max, roundTo, floorTo, ceilTo])(
    "names %s in primitive explanation claims",
    (operator) => {
      // Arrange
      const kb = new KnowledgeBase();
      const rounded = closedPredicate("rounded", { value: Number });
      const V = variable("V");
      kb.rule(rounded({ value: V })).iff(letIn(V, operator(1, 2), gte(V, 0)));

      // Act
      const explanation = explainJudgment(query(kb, rounded({ value: 1 })));

      // Assert
      const claims = (node: Explanation): string[] => [
        node.claim,
        ...("given" in node ? node.given : []).flatMap(claims),
      ];
      expect(claims(explanation)).toContainEqual(
        expect.stringContaining(` = ${operator.name}(1, 2) = true`),
      );
    },
  );

  describe("direct atom evidence", () => {
    const activeSanction = predicate("active_sanction", { person: Person });

    const cases: readonly ExplanationCase[] = [
      {
        name: "unknown when no evidence is known",
        run() {
          const kb = new KnowledgeBase();

          return explainJudgment(query(kb, activeSanction({ person: alice })));
        },
        expected: {
          claim: "active_sanction(alice) = unknown",
          because: "no supporting evidence or rule was found",
        },
      },
      {
        name: "true from accepted positive evidence",
        run() {
          const kb = new KnowledgeBase();

          kb.asserts(activeSanction({ person: bob }));

          return explainJudgment(query(kb, activeSanction({ person: bob })));
        },
        expected: {
          claim: "active_sanction(bob) = true",
          because: {
            claim: "active_sanction(bob) = true",
          },
        },
      },
      {
        name: "false from accepted negative evidence",
        run() {
          const kb = new KnowledgeBase();

          kb.denies(activeSanction({ person: cara }));

          return explainJudgment(query(kb, activeSanction({ person: cara })));
        },
        expected: {
          claim: "active_sanction(cara) = false",
          because: {
            claim: "active_sanction(cara) = false",
          },
        },
      },
      {
        name: "evidence cites its source",
        run() {
          const kb = new KnowledgeBase();

          kb.asserts(activeSanction({ person: bob }), { source: "sanctions_registry" });

          return explainJudgment(query(kb, activeSanction({ person: bob })));
        },
        expected: {
          claim: "active_sanction(bob) = true",
          because: {
            claim: "active_sanction(bob) = true",
            source: "sanctions_registry",
          },
        },
      },
      {
        name: "conflicted from opposed accepted evidence",
        run() {
          const kb = new KnowledgeBase();

          kb.asserts(activeSanction({ person: drew }));
          kb.denies(activeSanction({ person: drew }));

          return explainJudgment(query(kb, activeSanction({ person: drew })));
        },
        expected: {
          claim: "active_sanction(drew) = conflicted",
          because: [
            {
              claim: "active_sanction(drew) = true",
            },
            {
              claim: "active_sanction(drew) = false",
            },
          ],
        },
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        expect(testCase.run()).toEqual(testCase.expected);
      });
    }
  });

  describe("closed-world not through a derived rule", () => {
    const P = variable("P");
    const activeSanction = closedPredicate("active_sanction", { person: Person });
    const eligible = predicate("eligible", { person: Person });

    function buildKb(): KnowledgeBase {
      const kb = new KnowledgeBase();

      kb.asserts(activeSanction({ person: bob }));
      kb.denies(activeSanction({ person: cara }));
      kb.asserts(activeSanction({ person: drew }));
      kb.denies(activeSanction({ person: drew }));
      kb.rule(eligible({ person: P })).iff(not(activeSanction({ person: P })));

      return kb;
    }

    const cases: readonly ExplanationCase[] = [
      {
        name: "missing closed-world evidence derives true",
        run() {
          return explainJudgment(query(buildKb(), eligible({ person: alice })));
        },
        expected: {
          claim: "eligible(alice) = true",
          because: "eligible(P) iff not(active_sanction(P)), with P = alice",
          given: [
            {
              claim: "not(active_sanction(alice)) = true",
              because: "active_sanction(alice) is closed-world, and no evidence is known",
            },
          ],
        },
      },
      {
        name: "positive closed-world evidence derives false",
        run() {
          return explainJudgment(query(buildKb(), eligible({ person: bob })));
        },
        expected: {
          claim: "eligible(bob) = false",
          because: "eligible(P) iff not(active_sanction(P)), with P = bob",
          given: [
            {
              claim: "not(active_sanction(bob)) = false",
              given: [
                {
                  claim: "active_sanction(bob) = true",
                  because: {
                    claim: "active_sanction(bob) = true",
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: "negative closed-world evidence derives true",
        run() {
          return explainJudgment(query(buildKb(), eligible({ person: cara })));
        },
        expected: {
          claim: "eligible(cara) = true",
          because: "eligible(P) iff not(active_sanction(P)), with P = cara",
          given: [
            {
              claim: "not(active_sanction(cara)) = true",
              given: [
                {
                  claim: "active_sanction(cara) = false",
                  because: {
                    claim: "active_sanction(cara) = false",
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: "conflicted closed-world evidence derives conflicted",
        run() {
          return explainJudgment(query(buildKb(), eligible({ person: drew })));
        },
        expected: {
          claim: "eligible(drew) = conflicted",
          because: "eligible(P) iff not(active_sanction(P)), with P = drew",
          given: [
            {
              claim: "not(active_sanction(drew)) = conflicted",
              given: [
                {
                  claim: "active_sanction(drew) = conflicted",
                  because: [
                    {
                      claim: "active_sanction(drew) = true",
                    },
                    {
                      claim: "active_sanction(drew) = false",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        expect(testCase.run()).toEqual(testCase.expected);
      });
    }
  });
});

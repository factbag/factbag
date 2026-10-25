/**
 * Asserts that proof judgments render into compact, deterministic explanation
 * JSON across direct evidence, conflicts, unknowns, and closed-world negation.
 */
import { describe, expect, it } from "vitest";
import {
  and,
  ceilTo,
  closedPredicate,
  daysBetween,
  floorTo,
  gte,
  letIn,
  max,
  min,
  not,
  or,
  predicate,
  roundTo,
  variable,
  yearsBetween,
} from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";
import type { Judgment } from "../types/judgment";
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

function conjunction(judgments: readonly Judgment[]): Judgment {
  return {
    goal: { kind: "and", goals: judgments.map((judgment) => judgment.goal) },
    bindings: [],
    value: "true",
    positive: [{ source: "subgoals", judgments }],
  };
}

function children(explanation: Explanation | undefined): readonly Explanation[] {
  if (explanation === undefined || !("given" in explanation)) {
    throw new Error(`Expected children for ${explanation?.claim}`);
  }
  return explanation.given;
}

describe("explainJudgment", () => {
  it.each([daysBetween, yearsBetween])(
    "names the %s date operation in a rendered proof",
    (operator) => {
      // Arrange
      const kb = new KnowledgeBase();
      const oldEnough = closedPredicate("old_enough", { person: Person });
      kb.rule(oldEnough({ person: alice })).iff(
        gte(operator(new Date("2017-12-31"), new Date("1950-03-02")), 65),
      );
      // Act
      const explanation = explainJudgment(query(kb, oldEnough({ person: alice })));
      // Assert
      expect(JSON.stringify(explanation)).toContain(`${operator.name}(`);
    },
  );

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

  it("lists equal subtrees once but keeps different derivations of the same claim", () => {
    // Arrange
    const P = variable("P");
    const base = predicate("base", { person: Person });
    const alternate = predicate("alternate", { person: Person });
    const derived = predicate("derived", { person: Person });
    const firstKb = new KnowledgeBase();
    firstKb.asserts(base({ person: alice }));
    firstKb.rule(derived({ person: P })).iff(base({ person: P }));
    const secondKb = new KnowledgeBase();
    secondKb.asserts(alternate({ person: alice }));
    secondKb.rule(derived({ person: P })).iff(alternate({ person: P }));
    // Separate queries produce equal content without sharing judgment objects.
    const first = query(firstKb, derived({ person: alice }));
    const duplicate = query(firstKb, derived({ person: alice }));
    const distinct = query(secondKb, derived({ person: alice }));

    // Act
    const explanation = explainJudgment(conjunction([first, duplicate, distinct]));

    // Assert
    expect(duplicate).not.toBe(first);
    expect(children(explanation)).toEqual([
      {
        claim: "derived(alice) = true",
        because: "derived(P) iff base(P), with P = alice",
        given: [{ claim: "base(alice) = true", because: { claim: "base(alice) = true" } }],
      },
      {
        claim: "derived(alice) = true",
        because: "derived(P) iff alternate(P), with P = alice",
        given: [
          { claim: "alternate(alice) = true", because: { claim: "alternate(alice) = true" } },
        ],
      },
    ]);
  });

  it("keeps equal claims and rules distinct when their supporting evidence differs", () => {
    // Arrange
    const P = variable("P");
    const base = predicate("base", { person: Person });
    const derived = predicate("derived", { person: Person });
    const judgments = ["registry", "interview"].map((source) => {
      const kb = new KnowledgeBase();
      kb.asserts(base({ person: alice }), { source });
      kb.rule(derived({ person: P })).iff(base({ person: P }));
      return query(kb, derived({ person: alice }));
    });

    // Act
    const explanation = explainJudgment(conjunction(judgments));

    // Assert
    expect(children(explanation)).toEqual([
      {
        claim: "derived(alice) = true",
        because: "derived(P) iff base(P), with P = alice",
        given: [
          {
            claim: "base(alice) = true",
            because: { claim: "base(alice) = true", source: "registry" },
          },
        ],
      },
      {
        claim: "derived(alice) = true",
        because: "derived(P) iff base(P), with P = alice",
        given: [
          {
            claim: "base(alice) = true",
            because: { claim: "base(alice) = true", source: "interview" },
          },
        ],
      },
    ]);
  });

  it("shares the explanation of a reused judgment across distinct branches", () => {
    // Arrange
    const P = variable("P");
    const seed = predicate("seed", { person: Person });
    const base = predicate("base", { person: Person });
    const left = predicate("left", { person: Person });
    const right = predicate("right", { person: Person });
    const both = predicate("both", { person: Person });
    const kb = new KnowledgeBase();
    kb.asserts(seed({ person: alice }));
    kb.asserts(left({ person: alice }));
    kb.asserts(right({ person: alice }));
    kb.rule(base({ person: P })).iff(seed({ person: P }));
    kb.rule(both({ person: P })).iff(
      or(
        and(base({ person: P }), left({ person: P })),
        and(base({ person: P }), right({ person: P })),
      ),
    );
    const judgment = query(kb, both({ person: alice }));

    // Act
    const explanation = explainJudgment(judgment);
    const branches = children(children(explanation)[0]);

    // Assert
    expect(branches.map((branch) => branch.claim)).toEqual([
      "and(base(alice), left(alice)) = true",
      "and(base(alice), right(alice)) = true",
    ]);
    expect(children(branches[0])).toHaveLength(2);
    expect(children(branches[1])).toHaveLength(2);
    // Atom wrappers carry branch bindings, but their rule body is reused.
    const leftBody = children(children(branches[0])[0])[0];
    const rightBody = children(children(branches[1])[0])[0];
    expect(leftBody).toBe(rightBody);
    expect(leftBody).toEqual({
      claim: "seed(alice) = true",
      because: { claim: "seed(alice) = true" },
    });
  });

  /** Each level adds two paths to the previous level, but only seven new nodes. */
  it("builds a deep diamond proof as a linear-sized explanation DAG", () => {
    // Arrange
    const depth = 24;
    const P = variable("P");
    const base = predicate("base", { person: Person });
    const kb = new KnowledgeBase();
    kb.asserts(base({ person: alice }));
    let previous = base;
    for (let level = 1; level <= depth; level++) {
      const next = predicate(`level_${level}`, { person: Person });
      const a = predicate(`a_${level}`, { person: Person });
      const b = predicate(`b_${level}`, { person: Person });
      kb.asserts(a({ person: alice }));
      kb.asserts(b({ person: alice }));
      kb.rule(next({ person: P })).iff(
        or(
          and(previous({ person: P }), a({ person: P })),
          and(previous({ person: P }), b({ person: P })),
        ),
      );
      previous = next;
    }
    const judgment = query(kb, previous({ person: alice }));

    // Act
    const start = performance.now();
    const explanation = explainJudgment(judgment);
    const elapsed = performance.now() - start;
    const seen = new Set<Explanation>();
    const pending = [explanation];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node !== undefined && !seen.has(node)) {
        seen.add(node);
        if ("given" in node) {
          pending.push(...node.given);
        }
      }
    }

    // Assert
    expect(judgment.value).toBe("true");
    expect(explanation.claim).toBe("level_24(alice) = true");
    // One root; per level: or, two ands, two scoped previous atoms, a and b.
    expect(seen.size).toBe(1 + 7 * depth);
    expect(elapsed).toBeLessThan(3_000);
  });

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

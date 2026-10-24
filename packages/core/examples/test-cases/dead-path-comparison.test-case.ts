import { expect } from "vitest";
import type { QueryJudgment } from "../../src/query";
import type { GroundAtom } from "../../src/types/atom";
import type { DslTestSpec } from "../test-runner/test-runner";

/** Match the public proof root; internal arithmetic temporaries are not this contract. */
function proof(atom: GroundAtom, value: QueryJudgment["value"]): QueryJudgment {
  const support: unknown = expect.arrayContaining([expect.objectContaining({ source: "rule" })]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- Vitest's asymmetric matcher checks these proof fields in the existing harness.
  return expect.objectContaining({
    value,
    goal: { kind: "atom", atom },
    bindings: [],
    [value === "false" ? "negative" : "positive"]: support,
  });
}
import { and, closedPredicate, gte, lte, or, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const married_on = closedPredicate("married_on", { a: Person, b: Person, day: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const married_at = closedPredicate("married_at", { a: Person, b: Person, day: Date });
const married_in = closedPredicate("married_in", { a: Person, b: Person, year: BigInt });
const year_end = closedPredicate("year_end", { year: BigInt, last: Date });

const A = variable("A");
const B = variable("B");
const D = variable("D");
const S = variable("S");
const Y = variable("Y");
const L = variable("L");

function build(kb: KnowledgeBase) {
  kb.entities.add(alice, bob);
  kb.asserts(married_on({ a: alice, b: bob, day: new Date("1992-02-03T00:00:00Z") }));
  kb.asserts(year_end({ year: 2013n, last: new Date("2013-12-31T00:00:00Z") }));
  // The day is an input the body only compares: it must be bound by the caller.
  const rule0 = kb
    .rule(married_at({ a: A, b: B, day: D }))
    .iff(and(married_on({ a: A, b: B, day: S }), lte(S, D)));
  // The first branch binds D from a death that never happened; the second decides.
  const rule1 = kb
    .rule(married_in({ a: A, b: B, year: Y }))
    .iff(
      and(
        year_end({ year: Y, last: L }),
        or(
          and(died({ person: B, day: D }), gte(D, L), married_at({ a: A, b: B, day: D })),
          married_at({ a: A, b: B, day: L }),
        ),
      ),
    );
  return {
    literals: [
      {
        sign: "+" as const,
        atom: married_on({ a: alice, b: bob, day: new Date("1992-02-03T00:00:00Z") }),
      },
      {
        sign: "+" as const,
        atom: year_end({ year: 2013n, last: new Date("2013-12-31T00:00:00Z") }),
      },
    ],
    rules: [rule0, rule1],
  };
}

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: a missing event does not crash a later comparison",
    invariant:
      "No death date exists. The failed death branch must not crash candidate discovery; the year-end marriage branch establishes the result.",
    narration:
      "No death date exists. The failed death branch must not crash candidate discovery; the year-end marriage branch establishes the result.",
    fails: "18a7ce9: a missing event does not crash a later comparison",
    build(kb) {
      return build(kb);
    },
    queryAtoms: married_in({ a: alice, b: bob, year: 2013n }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(married_in({ a: alice, b: bob, year: 2013n }), "true"),
      };
    },
  },
];

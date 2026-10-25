import { and, closedPredicate, gte, lte, or, variable } from "../../src/dsl";
import { UnsafeUnboundVariableProgrammerError, type KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const marriedOn = closedPredicate("married_on", { a: Person, b: Person, day: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const marriedAt = closedPredicate("married_at", { a: Person, b: Person, day: Date });
const widowedAt = closedPredicate("widowed_at", { person: Person, day: Date });
const A = variable("A");
const B = variable("B");
const S = variable("S");
const D = variable("D");
const E = variable("E");
const wedding = new Date("2001-06-01T00:00:00Z");
const beforeWedding = new Date("1999-01-01T00:00:00Z");
const afterWedding = new Date("2010-01-01T00:00:00Z");

const marriageRule = {
  kind: "iff",
  head: { sign: "+", atom: marriedAt({ a: A, b: B, day: D }) },
  body: and(or(marriedOn({ a: A, b: B, day: S }), marriedOn({ a: B, b: A, day: S })), lte(S, D)),
} as const;
const widowRule = {
  kind: "iff",
  head: { sign: "+", atom: widowedAt({ person: A, day: D }) },
  body: and(or(died({ person: A, day: E }), marriedOn({ a: A, b: B, day: S })), gte(D, E)),
} as const;
const literals = [{ sign: "+", atom: marriedOn({ a: alice, b: bob, day: wedding }) }] as const;

function build(kb: KnowledgeBase) {
  kb.entities.add(alice, bob);
  kb.asserts(marriedOn({ a: alice, b: bob, day: wedding }));
  kb.rule(marriageRule.head.atom).iff(marriageRule.body);
}

export const orBindingValidationTestCases: readonly DslTestSpec[] = [
  ...[
    { name: "forward", left: alice, right: bob },
    { name: "reverse", left: bob, right: alice },
  ].map(({ name, left, right }): DslTestSpec => ({
    name: `or binding validation: compares the date supplied by the ${name} branch`,
    invariant:
      "A variable constructively bound in every alternative is safe in a later comparison.",
    narration:
      "One marriage fact binds the wedding date through either direction of the relation. Queries after the wedding are true and queries before it are false, without a spurious recursion error.",
    build,
    expectedKnowledgeBase: { literals, rules: [marriageRule] },
    queryAtoms: [
      marriedAt({ a: left, b: right, day: afterWedding }),
      marriedAt({ a: left, b: right, day: beforeWedding }),
    ],
    expectedProofs: [
      ruleProof(marriedAt({ a: left, b: right, day: afterWedding }), "true", marriageRule, [
        [A, left],
        [B, right],
        [D, afterWedding],
        [S, wedding],
      ]),
      ruleProof(marriedAt({ a: left, b: right, day: beforeWedding }), "false", marriageRule, [
        [A, left],
        [B, right],
        [D, beforeWedding],
      ]),
    ],
  })),
  {
    name: "or binding validation: rejects a comparison bound in only one branch",
    invariant: "A variable absent from one alternative is not safely bound after the disjunction.",
    narration:
      "The death branch binds E but the marriage branch only binds S. Comparing the query date with E is unsafe even though a marriage fact exists.",
    build(kb) {
      build(kb);
      kb.rule(widowRule.head.atom).iff(widowRule.body);
    },
    expectedKnowledgeBase: { literals, rules: [marriageRule, widowRule] },
    queryAtoms: widowedAt({ person: alice, day: afterWedding }),
    expectedError: UnsafeUnboundVariableProgrammerError,
  },
];

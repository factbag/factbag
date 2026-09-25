import { predicate, variable } from "../../src/dsl";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const P = variable("P");

const seeded = predicate("seeded", { person: Person });
const eligible = predicate("eligible", { person: Person });
const reviewable = predicate("reviewable", { person: Person });

const baseRule = {
  head: { sign: "+", atom: eligible({ person: P }) },
  kind: "if",
  body: seeded({ person: P }),
} as const;

const eligibleFromReviewable = {
  head: { sign: "+", atom: eligible({ person: P }) },
  kind: "if",
  body: reviewable({ person: P }),
} as const;

const reviewableFromEligible = {
  head: { sign: "+", atom: reviewable({ person: P }) },
  kind: "iff",
  body: eligible({ person: P }),
} as const;

export const mutualRecursionCycleTestCase: DslTestSpec = {
  name: "mutual recursion cycle: grounded base terminates the cycle",
  invariant:
    "A positive mutual-recursion cycle must terminate, derive conclusions reachable from base evidence, and leave unsupported entities unknown.",
  narration:
    "eligible(P) is seeded by direct evidence, eligible(P) and reviewable(P) also imply each other. Alice has seed evidence, so reviewable(alice) should be derived through eligible(alice). Bob has no seed evidence, so the cycle alone should not manufacture reviewable(bob).",
  build(kb) {
    kb.asserts(seeded({ person: alice }));
    kb.rule(baseRule.head.atom).if(baseRule.body);
    kb.rule(eligibleFromReviewable.head.atom).if(eligibleFromReviewable.body);
    kb.rule(reviewableFromEligible.head.atom).iff(reviewableFromEligible.body);
  },
  expectedKnowledgeBase: {
    literals: [{ sign: "+", atom: seeded({ person: alice }) }],
    rules: [baseRule, eligibleFromReviewable, reviewableFromEligible],
  },
  queryAtoms: [reviewable({ person: alice }), reviewable({ person: bob })],
  expectedProofs: [
    {
      value: "true",
      goal: { kind: "atom", atom: reviewable({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: reviewableFromEligible,
          body: {
            value: "true",
            goal: { kind: "atom", atom: eligible({ person: alice }) },
            bindings: [[P, alice]],
            positive: [
              {
                source: "rule",
                rule: baseRule,
                body: {
                  value: "true",
                  goal: { kind: "atom", atom: seeded({ person: alice }) },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [{ sign: "+", atom: seeded({ person: alice }) }],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    {
      value: "unknown",
      goal: { kind: "atom", atom: reviewable({ person: bob }) },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: reviewableFromEligible,
          body: {
            value: "unknown",
            goal: { kind: "atom", atom: eligible({ person: bob }) },
            bindings: [[P, bob]],
            inconclusive: [
              {
                source: "rule",
                rule: baseRule,
                body: {
                  value: "unknown",
                  goal: { kind: "atom", atom: seeded({ person: bob }) },
                  bindings: [[P, bob]],
                },
              },
              {
                source: "rule",
                rule: eligibleFromReviewable,
                body: {
                  value: "unknown",
                  goal: { kind: "atom", atom: reviewable({ person: bob }) },
                  bindings: [[P, bob]],
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const pureMutualRecursionCycleTestCase: DslTestSpec = {
  name: "mutual recursion cycle: pure cycle remains unknown",
  invariant:
    "A positive mutual-recursion cycle with no grounding evidence must terminate without manufacturing truth.",
  narration:
    "eligible(P) and reviewable(P) imply each other, but there is no seed evidence. Querying either side of the cycle for Alice should remain unknown rather than deriving truth from the cycle alone.",
  build(kb) {
    kb.rule(eligibleFromReviewable.head.atom).if(eligibleFromReviewable.body);
    kb.rule(reviewableFromEligible.head.atom).iff(reviewableFromEligible.body);
  },
  expectedKnowledgeBase: {
    literals: [],
    rules: [eligibleFromReviewable, reviewableFromEligible],
  },
  queryAtoms: [eligible({ person: alice }), reviewable({ person: alice })],
  expectedProofs: [
    {
      value: "unknown",
      goal: { kind: "atom", atom: eligible({ person: alice }) },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: eligibleFromReviewable,
          body: {
            value: "unknown",
            goal: { kind: "atom", atom: reviewable({ person: alice }) },
            bindings: [[P, alice]],
            inconclusive: [
              {
                source: "rule",
                rule: reviewableFromEligible,
                body: {
                  value: "unknown",
                  goal: { kind: "atom", atom: eligible({ person: alice }) },
                  bindings: [[P, alice]],
                },
              },
            ],
          },
        },
      ],
    },
    {
      value: "unknown",
      goal: { kind: "atom", atom: reviewable({ person: alice }) },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: reviewableFromEligible,
          body: {
            value: "unknown",
            goal: { kind: "atom", atom: eligible({ person: alice }) },
            bindings: [[P, alice]],
            inconclusive: [
              {
                source: "rule",
                rule: eligibleFromReviewable,
                body: {
                  value: "unknown",
                  goal: { kind: "atom", atom: reviewable({ person: alice }) },
                  bindings: [[P, alice]],
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

import { and, closedPredicate, count, gte, letIn, not, or, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

const seed = closedPredicate("seed", { value: Number });
const first = closedPredicate("first", { value: Number });
const second = closedPredicate("second", { value: Number });
const both = closedPredicate("both", { value: Number });
const firstOnly = closedPredicate("firstOnly", { value: Number });
const total = closedPredicate("total", { value: Number });
const V = variable("V");
const N = variable("N");
const firstRule = {
  kind: "iff",
  head: { sign: "+", atom: first({ value: V }) },
  body: or(seed({ value: V }), second({ value: V })),
} as const;
const secondRule = {
  kind: "iff",
  head: { sign: "+", atom: second({ value: V }) },
  body: first({ value: V }),
} as const;
const bothRule = {
  kind: "iff",
  head: { sign: "+", atom: both({ value: V }) },
  body: and(first({ value: V }), second({ value: V })),
} as const;
const firstOnlyRule = {
  kind: "iff",
  head: { sign: "+", atom: firstOnly({ value: V }) },
  body: and(first({ value: V }), not(second({ value: V }))),
} as const;
const totalRule = {
  kind: "iff",
  head: { sign: "+", atom: total({ value: N }) },
  body: letIn(N, count(V).where(second({ value: V })), gte(N, 0)),
} as const;
const rules = [firstRule, secondRule, bothRule, firstOnlyRule, totalRule];
const scenario = {
  build(kb: KnowledgeBase) {
    kb.asserts(seed({ value: 1 }));
    // Ground evidence admits recursive enumeration; this denied value must not
    // become a true candidate or contribute to the count.
    kb.denies(first({ value: 2 }));
    for (const rule of rules) {
      kb.rule(rule.head.atom).iff(rule.body);
    }
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: seed({ value: 1 }) },
      { sign: "-", atom: first({ value: 2 }) },
    ],
    rules,
  },
} as const;

// Names are display labels; dependency and recursion keys must use declarations.
const inner = closedPredicate("shared:label", { value: Number });
const outer = closedPredicate("shared:label", { value: Number });
const innerRule = {
  kind: "iff",
  head: { sign: "+", atom: inner({ value: V }) },
  body: seed({ value: V }),
} as const;
const outerRule = {
  kind: "iff",
  head: { sign: "+", atom: outer({ value: V }) },
  body: inner({ value: V }),
} as const;
const sameNameScenario = {
  build(kb: KnowledgeBase) {
    kb.asserts(seed({ value: 1 }));
    kb.rule(innerRule.head.atom).iff(innerRule.body);
    kb.rule(outerRule.head.atom).iff(outerRule.body);
  },
  expectedKnowledgeBase: {
    literals: [{ sign: "+", atom: seed({ value: 1 }) }],
    rules: [innerRule, outerRule],
  },
} as const;

export const judgmentContextTestCases: readonly DslTestSpec[] = [
  {
    ...sameNameScenario,
    name: "judgment context: identically named declarations remain distinct",
    invariant: "Predicate names, including colons, must not alias active atoms or dependencies.",
    narration:
      "Two distinct declarations share a label. The outer rule must still follow the inner rule to the seed rather than treating it as recursion.",
    queryAtoms: [outer({ value: 1 }), outer({ value: 2 })],
    expectedProofs: [
      ruleProof(outer({ value: 1 }), "true", outerRule, [[V, 1]]),
      ruleProof(outer({ value: 2 }), "false", outerRule, [[V, 2]]),
    ],
  },
  {
    ...sameNameScenario,
    name: "judgment context: enumerates identically named declarations independently",
    invariant: "Candidate discovery must preserve predicate declaration identity.",
    narration: "The shared label does not hide the inner rule's seeded value during enumeration.",
    queryAtoms: outer({ value: V }),
    expectedProofs: [ruleProof(outer({ value: 1 }), "true", outerRule, [[V, 1]])],
  },
  {
    ...scenario,
    name: "judgment context: a recursive cutoff is not reused by a later conjunct",
    invariant: "Judgments reached with a recursive atom active cannot escape that context.",
    narration:
      "Proving first(1) cuts second(1)'s return to first(1); asked next, second(1) must recover the seed. The unseeded value is a negative control.",
    queryAtoms: [both({ value: 1 }), both({ value: 2 })],
    expectedProofs: [
      ruleProof(both({ value: 1 }), "true", bothRule, [[V, 1]]),
      ruleProof(both({ value: 2 }), "false", bothRule, [[V, 2]]),
    ],
  },
  {
    ...scenario,
    name: "judgment context: negation does not reuse a recursive cutoff",
    invariant: "A context-limited negative result must not become a successful negation.",
    narration: "The seed establishes both sides of the cycle, so firstOnly(1) is false.",
    queryAtoms: firstOnly({ value: 1 }),
    expectedProofs: ruleProof(firstOnly({ value: 1 }), "false", firstOnlyRule, [[V, 1]]),
  },
  {
    ...scenario,
    name: "judgment context: discovery retains the seeded recursive candidate",
    invariant: "Reuse during discovery must not freeze a partial recursive table.",
    narration:
      "Variable discovery follows the cycle and returns just the seeded value with both conjuncts true.",
    queryAtoms: both({ value: V }),
    expectedProofs: [ruleProof(both({ value: 1 }), "true", bothRule, [[V, 1]])],
  },
  {
    ...scenario,
    name: "judgment context: aggregate observes the completed recursive table",
    invariant: "A judgment depending on candidate discovery must see its final fixed point.",
    narration:
      "The mutually recursive predicates contain one value, so counting second yields one rather than a partial zero.",
    queryAtoms: [total({ value: 1 }), total({ value: 0 })],
    expectedProofs: [
      ruleProof(total({ value: 1 }), "true", totalRule, [[N, 1]]),
      ruleProof(total({ value: 0 }), "false", totalRule, [[N, 0]]),
    ],
  },
];

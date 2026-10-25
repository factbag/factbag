import { and, closedPredicate, gte, letIn, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Thing {
  constructor(readonly id: string) {}
}

const x1 = new Thing("x1");
const measured = closedPredicate("measured", { thing: Thing, value: Number });
const reported = closedPredicate("reported", { thing: Thing });
const X = variable("X");
const M = variable("M");
const V = variable("V");
const rule = {
  kind: "iff",
  head: { sign: "+", atom: reported({ thing: X }) },
  body: and(measured({ thing: X, value: M }), letIn(V, M, gte(V, 0))),
} as const;

function scenario(value?: number) {
  return {
    build(kb: KnowledgeBase) {
      kb.entities.add(x1);
      if (value !== undefined) {
        kb.asserts(measured({ thing: x1, value }));
      }
      kb.rule(rule.head.atom).iff(rule.body);
    },
    expectedKnowledgeBase: {
      literals:
        value === undefined ? [] : [{ sign: "+" as const, atom: measured({ thing: x1, value }) }],
      rules: [rule],
    },
  } as const;
}

export const deadPathLetTestCases: readonly DslTestSpec[] = [
  {
    ...scenario(),
    name: "dead-path let: a missing measurement yields false without binding a sentinel",
    invariant:
      "Copying an unavailable value after a failed lookup must not throw or invent a value.",
    narration:
      "There is no measurement. The grounded report is false, not an assertion error or a true report from a default zero.",
    fails: "A let binding stores the unbound marker, and its later comparison throws.",
    queryAtoms: reported({ thing: x1 }),
    expectedProofs: ruleProof(reported({ thing: x1 }), "false", rule, [[X, x1]]),
  },
  {
    ...scenario(),
    name: "dead-path let: an empty measurement relation yields no report candidates",
    invariant:
      "An unavailable alias must not crash candidate discovery or manufacture a ground result.",
    narration:
      "No measurement can supply the report's thing, so a variable query returns an empty list.",
    fails: "Candidate discovery stores the unbound marker in the let binding.",
    queryAtoms: reported({ thing: X }),
    expectedProofs: [],
  },
  ...(
    [
      { name: "positive", measurement: 12, value: "true" },
      { name: "zero", measurement: 0, value: "true" },
      { name: "negative", measurement: -1, value: "false" },
    ] as const
  ).map(({ name, measurement, value }): DslTestSpec => ({
    ...scenario(measurement),
    name: `dead-path let control: preserves a ${name} bound measurement`,
    invariant: "A live alias copies the actual measurement and evaluates its comparison normally.",
    narration:
      "A measurement exists. Non-negative values satisfy the report; a negative value does not.",
    queryAtoms: reported({ thing: x1 }),
    expectedProofs: ruleProof(reported({ thing: x1 }), value, rule, [
      [X, x1],
      [M, measurement],
      [V, measurement],
    ]),
  })),
  {
    ...scenario(12),
    name: "dead-path let control: discovers the measured report",
    invariant:
      "Tolerating unavailable aliases must not discard constructive bindings on live paths.",
    narration: "The measurement of twelve supplies x1 as the single true report candidate.",
    queryAtoms: reported({ thing: X }),
    expectedProofs: [
      ruleProof(reported({ thing: x1 }), "true", rule, [
        [X, x1],
        [M, 12],
        [V, 12],
      ]),
    ],
  },
];

import { expect } from "vitest";
import { and, closedPredicate, predicate, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import type { QueryJudgment } from "../../src/query";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

const applicant = closedPredicate("applicant", { name: String });
const approved = closedPredicate("approved", { name: String });
const eligible = closedPredicate("eligible", { name: String });
const pending = predicate("pending", { name: String });
const reviewed = closedPredicate("reviewed", { name: String });
const Name = variable("Name");
const applicantLiteral = { sign: "+", atom: applicant({ name: "Alice" }) } as const;
const eligibilityRule = {
  kind: "iff",
  head: { sign: "+", atom: eligible({ name: Name }) },
  body: and(applicant({ name: Name }), approved({ name: Name })),
} as const;
const reviewRule = {
  kind: "iff",
  head: { sign: "+", atom: reviewed({ name: Name }) },
  body: and(applicant({ name: Name }), pending({ name: Name })),
} as const;
const scenario = {
  build(kb: KnowledgeBase) {
    kb.asserts(applicantLiteral.atom);
    kb.rule(eligibilityRule.head.atom).iff(eligibilityRule.body);
  },
  expectedKnowledgeBase: { literals: [applicantLiteral], rules: [eligibilityRule] },
};

export const regressionExamples: readonly DslTestSpec[] = [
  {
    ...scenario,
    name: "candidate pruning: omits definitively false derived candidates",
    invariant: "A failed rule body does not introduce a candidate into enumeration.",
    narration:
      "Alice is an applicant but lacks closed-world approval; eligibility is not enumerated.",
    queryAtoms: eligible({ name: Name }),
    expectedProofs: [],
  },
  {
    ...scenario,
    name: "candidate pruning: omitted candidate still has a grounded negative proof",
    invariant: "Pruning discovery must preserve the truth and provenance of direct queries.",
    narration:
      "Asking explicitly about Alice still yields false with the eligibility rule as support.",
    queryAtoms: eligible({ name: "Alice" }),
    expectedProofs: ruleProof(eligible({ name: "Alice" }), "false", eligibilityRule, [
      [Name, "Alice"],
    ]),
  },
  ...(["unknown", "conflicted"] as const).map((value): DslTestSpec => {
    const positive = { sign: "+", atom: pending({ name: "Alice" }) } as const;
    const negative = { sign: "-", atom: pending({ name: "Alice" }) } as const;
    const support: unknown = expect.arrayContaining([
      {
        source: "rule",
        rule: reviewRule,
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Match semantic support without fixing internal conjunction expansion.
        body: expect.objectContaining({ value, bindings: [[Name, "Alice"]] }),
      },
    ]);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- The runner accepts asymmetric proof matchers.
    const proof: QueryJudgment = expect.objectContaining({
      goal: { kind: "atom", atom: reviewed({ name: "Alice" }) },
      value,
      bindings: [],
      [value === "unknown" ? "inconclusive" : "positive"]: support,
      ...(value === "conflicted" ? { negative: support } : {}),
    });
    return {
      name: `candidate pruning: retains ${value} rule bodies`,
      invariant: "Only false bodies are pruned; uncertainty and contradiction retain candidates.",
      narration: `Alice's open-world review is ${value}, so her derived review candidate remains discoverable.`,
      build(kb) {
        kb.asserts(applicantLiteral.atom);
        if (value === "conflicted") {
          kb.asserts(positive.atom);
          kb.denies(negative.atom);
        }
        kb.rule(reviewRule.head.atom).iff(reviewRule.body);
      },
      expectedKnowledgeBase: {
        literals: value === "unknown" ? [applicantLiteral] : [applicantLiteral, positive, negative],
        rules: [reviewRule],
      },
      queryAtoms: reviewed({ name: Name }),
      expectedProofs: [proof],
    };
  }),
  {
    name: "candidate pruning: another rule can still introduce the same candidate",
    invariant: "A failed rule must not veto a candidate supported by a different rule.",
    narration: "Alice lacks approval but a separate applicant rule establishes eligibility.",
    build(kb) {
      kb.asserts(applicantLiteral.atom);
      kb.rule(eligibilityRule.head.atom).if(eligibilityRule.body);
      kb.rule(eligible({ name: Name })).if(applicant({ name: Name }));
    },
    expectedKnowledgeBase: {
      literals: [applicantLiteral],
      rules: [
        { ...eligibilityRule, kind: "if" },
        {
          kind: "if",
          head: { sign: "+", atom: eligible({ name: Name }) },
          body: applicant({ name: Name }),
        },
      ],
    },
    queryAtoms: eligible({ name: Name }),
    expectedProofs: [
      ruleProof(
        eligible({ name: "Alice" }),
        "true",
        {
          kind: "if",
          head: { sign: "+", atom: eligible({ name: Name }) },
          body: applicant({ name: Name }),
        },
        [[Name, "Alice"]],
      ),
    ],
  },
  {
    name: "candidate pruning: explicit negative evidence remains enumerable",
    invariant: "Evidence seeds are retained even when no rule body supports a candidate.",
    narration:
      "Alice's eligibility is explicitly denied; enumeration returns the negative evidence.",
    build(kb) {
      kb.denies(eligible({ name: "Alice" }));
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "-", atom: eligible({ name: "Alice" }) }],
      rules: [],
    },
    queryAtoms: eligible({ name: Name }),
    expectedProofs: [
      {
        value: "false",
        goal: { kind: "atom", atom: eligible({ name: "Alice" }) },
        bindings: [],
        negative: [
          { source: "evidence", literals: [{ sign: "-", atom: eligible({ name: "Alice" }) }] },
        ],
      },
    ],
  },
];

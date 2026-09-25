import { and, not } from "../../src/dsl";
import { alice } from "../scenarios/common";
import { doctor, eatenApple, passedMedicalSchool } from "../scenarios/medical-credentialing";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: explicit negative support (`not`).
 *
 * `not(atom)` in a rule body requires accepted negative evidence for `atom`. It is
 * evidence negation, not negation-as-failure: the mere absence of a positive fact
 * does not satisfy `not(atom)`, so a rule guarded by `not` stays unknown until a
 * matching denial is accepted.
 */
const doctorRule = {
  head: { sign: "+", atom: doctor({ person: P }) },
  kind: "iff",
  body: and(passedMedicalSchool({ person: P }), not(eatenApple({ person: P }))),
} as const;

export const evidenceNegationTestCases: readonly DslTestSpec[] = [
  {
    name: "not: satisfied by accepted negative evidence",
    invariant:
      "A rule body `not(atom)` is satisfied by an accepted negative literal, contributing a negative axiom child to the derived proof.",
    narration:
      "Alice passed medical school and has an accepted denial that she ate an apple. The doctor rule requires the medical-school evidence and explicit negative support for the apple, so doctor(alice) derives true with a negative axiom child for the denial.",
    build(kb) {
      kb.asserts(passedMedicalSchool({ person: alice }), {
        source: "medical_school_registry",
      });
      kb.denies(eatenApple({ person: alice }), { source: "diet_review" });
      kb.rule(doctor({ person: P })).iff(doctorRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: passedMedicalSchool({ person: alice }),
          metadata: { source: "medical_school_registry" },
        },
        { sign: "-", atom: eatenApple({ person: alice }), metadata: { source: "diet_review" } },
      ],
      rules: [doctorRule],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "true",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: doctorRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "atom",
                  atom: passedMedicalSchool({ person: alice }),
                },
                {
                  kind: "not",
                  goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                },
              ],
            },
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: passedMedicalSchool({ person: alice }),
                    },
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: passedMedicalSchool({ person: alice }),
                            metadata: { source: "medical_school_registry" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "not",
                      goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                    },
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [
                          {
                            value: "false",
                            goal: {
                              kind: "atom",
                              atom: eatenApple({ person: alice }),
                            },
                            bindings: [[P, alice]],
                            negative: [
                              {
                                source: "evidence",
                                literals: [
                                  {
                                    sign: "-",
                                    atom: eatenApple({ person: alice }),
                                    metadata: { source: "diet_review" },
                                  },
                                ],
                              },
                            ],
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
  },
  {
    name: "not: missing evidence is not negation-as-failure",
    invariant:
      "With no accepted evidence about the negated atom, a `not`-guarded rule does not fire and the conclusion stays unknown rather than true.",
    narration:
      "Alice passed medical school but the KB holds no apple evidence at all. Because `not` requires explicit negative support, the doctor rule cannot fire and doctor(alice) is unknown, not true.",
    build(kb) {
      kb.asserts(passedMedicalSchool({ person: alice }), {
        source: "medical_school_registry",
      });
      kb.rule(doctor({ person: P })).iff(doctorRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: passedMedicalSchool({ person: alice }),
          metadata: { source: "medical_school_registry" },
        },
      ],
      rules: [doctorRule],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "unknown",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: doctorRule,
          body: {
            value: "unknown",
            goal: {
              kind: "and",
              goals: [
                { kind: "atom", atom: passedMedicalSchool({ person: alice }) },
                { kind: "not", goal: { kind: "atom", atom: eatenApple({ person: alice }) } },
              ],
            },
            bindings: [[P, alice]],
            inconclusive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: { kind: "atom", atom: passedMedicalSchool({ person: alice }) },
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: passedMedicalSchool({ person: alice }),
                            metadata: { source: "medical_school_registry" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "unknown",
                    goal: {
                      kind: "not",
                      goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                    },
                    bindings: [[P, alice]],
                    inconclusive: [
                      {
                        source: "subgoals",
                        judgments: [
                          {
                            value: "unknown",
                            goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                            bindings: [[P, alice]],
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
  },
];

import { and } from "../../src/dsl";
import { alice } from "../scenarios/common";
import { doctor, hasActiveLicense, passedMedicalSchool } from "../scenarios/medical-credentialing";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

export const derivedPredicateBoundaryTestCase: DslTestSpec = {
  name: "derived predicate boundary",
  invariant:
    "The KB contains only evidence literals and the doctor derivation rule before solving; the doctor conclusion appears only as a derived proof.",
  narration:
    "Alice is a doctor if Alice passed medical school and has an active license. The proof for doctor(alice) should be derived from the doctor rule with two axiom children: one for the medical-school evidence and one for the active-license evidence.",
  build(kb) {
    kb.asserts(passedMedicalSchool({ person: alice }), {
      source: "medical_school_registry",
    });
    kb.asserts(hasActiveLicense({ person: alice }), {
      source: "license_registry",
    });
    kb.rule(doctor({ person: P })).iff(
      and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
    );
  },
  expectedKnowledgeBase: {
    literals: [
      {
        sign: "+",
        atom: passedMedicalSchool({ person: alice }),
        metadata: { source: "medical_school_registry" },
      },
      {
        sign: "+",
        atom: hasActiveLicense({ person: alice }),
        metadata: { source: "license_registry" },
      },
    ],
    rules: [
      {
        head: { sign: "+", atom: doctor({ person: P }) },
        kind: "iff",
        body: and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
      },
    ],
  },
  queryAtoms: doctor({ person: alice }),
  expectedProofs: {
    value: "true",
    goal: { kind: "atom", atom: doctor({ person: alice }) },
    bindings: [],
    positive: [
      {
        source: "rule",
        rule: {
          head: { sign: "+", atom: doctor({ person: P }) },
          kind: "iff",
          body: and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
        },
        body: {
          value: "true",
          goal: {
            kind: "and",
            goals: [
              {
                kind: "atom",
                atom: passedMedicalSchool({ person: alice }),
              },
              { kind: "atom", atom: hasActiveLicense({ person: alice }) },
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
                    kind: "atom",
                    atom: hasActiveLicense({ person: alice }),
                  },
                  bindings: [[P, alice]],
                  positive: [
                    {
                      source: "evidence",
                      literals: [
                        {
                          sign: "+",
                          atom: hasActiveLicense({ person: alice }),
                          metadata: { source: "license_registry" },
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
};

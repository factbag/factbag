import { alice } from "../scenarios/common";
import { doctor } from "../scenarios/medical-credentialing";
import type { DslTestSpec } from "../test-runner/test-runner";

export const smokeGoalValueTestCases: readonly DslTestSpec[] = [
  {
    name: "smoke: positive proof",
    invariant:
      "A positive literal for doctor(alice) produces a true query result with a positive axiom proof.",
    narration:
      "The KB accepts doctor(alice) as positive evidence. Solving the same atom should return true with that literal as its axiom proof.",
    build(kb) {
      kb.asserts(doctor({ person: alice }), {
        source: "smoke_positive_source",
      });
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: doctor({ person: alice }),
          metadata: { source: "smoke_positive_source" },
        },
      ],
      rules: [],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "true",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "evidence",
          literals: [
            {
              sign: "+",
              atom: doctor({ person: alice }),
              metadata: { source: "smoke_positive_source" },
            },
          ],
        },
      ],
    },
  },
  {
    name: "smoke: negative proof",
    invariant:
      "A negative literal for doctor(alice) produces a false query result with a negative axiom proof.",
    narration:
      "The KB accepts explicit negative evidence for doctor(alice). Solving the same atom should return false with that denial as its axiom proof.",
    build(kb) {
      kb.denies(doctor({ person: alice }), {
        source: "smoke_negative_source",
      });
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "-",
          atom: doctor({ person: alice }),
          metadata: { source: "smoke_negative_source" },
        },
      ],
      rules: [],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "false",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
      negative: [
        {
          source: "evidence",
          literals: [
            {
              sign: "-",
              atom: doctor({ person: alice }),
              metadata: { source: "smoke_negative_source" },
            },
          ],
        },
      ],
    },
  },
  {
    name: "smoke: contradiction",
    invariant:
      "Conflicting literals for doctor(alice) produce a conflicted query result with parallel axiom proofs.",
    narration:
      "The KB accepts one positive and one negative literal for doctor(alice). Solving the atom should preserve both supports rather than choosing one.",
    build(kb) {
      kb.asserts(doctor({ person: alice }), {
        source: "smoke_positive_source",
      });
      kb.denies(doctor({ person: alice }), {
        source: "smoke_negative_source",
      });
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: doctor({ person: alice }),
          metadata: { source: "smoke_positive_source" },
        },
        {
          sign: "-",
          atom: doctor({ person: alice }),
          metadata: { source: "smoke_negative_source" },
        },
      ],
      rules: [],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "conflicted",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
      positive: [
        {
          source: "evidence",
          literals: [
            {
              sign: "+",
              atom: doctor({ person: alice }),
              metadata: { source: "smoke_positive_source" },
            },
          ],
        },
      ],
      negative: [
        {
          source: "evidence",
          literals: [
            {
              sign: "-",
              atom: doctor({ person: alice }),
              metadata: { source: "smoke_negative_source" },
            },
          ],
        },
      ],
    },
  },
  {
    name: "smoke: unknown",
    invariant:
      "No accepted literal or derivation for doctor(alice) produces an unknown query result with no proof roots.",
    narration:
      "The KB contains no evidence or rules for doctor(alice). Solving the atom should return unknown, not false and not default true.",
    build(): void {
      void doctor;
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [],
    },
    queryAtoms: doctor({ person: alice }),
    expectedProofs: {
      value: "unknown",
      goal: { kind: "atom", atom: doctor({ person: alice }) },
      bindings: [],
    },
  },
] as const satisfies readonly DslTestSpec[];

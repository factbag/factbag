import { activeAutoimmuneCondition, maya } from "../scenarios/clinical-trial";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: local retraction of conflicting evidence.
 *
 * Goal-value reasoning preserves conflicting accepted evidence as `conflicted`. A reviewer
 * resolves the conflict by retracting the exact literal handle they decide should
 * no longer remain. Retraction is local: only the named literal is removed, and
 * the surviving side determines the post-retraction goal value.
 */
export const retractionTestCases: readonly DslTestSpec[] = [
  {
    name: "retract positive: conflict collapses to false",
    invariant:
      "Retracting the positive literal of a contradiction leaves only negative support, so the atom solves to false.",
    narration:
      "Maya has both a positive and a negative literal for the autoimmune condition. The reviewer retracts the positive rheumatology assertion; only the negative intake denial remains, so the atom is false.",
    build(kb) {
      kb.denies(activeAutoimmuneCondition({ patient: maya }), {
        source: "oncology_intake",
      });
      const positive = kb.asserts(activeAutoimmuneCondition({ patient: maya }), {
        source: "rheumatology_note",
      });
      kb.retract(positive);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "-",
          atom: activeAutoimmuneCondition({ patient: maya }),
          metadata: { source: "oncology_intake" },
        },
      ],
      rules: [],
    },
    queryAtoms: activeAutoimmuneCondition({ patient: maya }),
    expectedProofs: {
      value: "false",
      goal: {
        kind: "atom",
        atom: activeAutoimmuneCondition({ patient: maya }),
      },
      bindings: [],
      negative: [
        {
          source: "evidence",
          literals: [
            {
              sign: "-",
              atom: activeAutoimmuneCondition({ patient: maya }),
              metadata: { source: "oncology_intake" },
            },
          ],
        },
      ],
    },
  },
  {
    name: "retract negative: conflict collapses to true",
    invariant:
      "Retracting the negative literal of a contradiction leaves only positive support, so the atom solves to true.",
    narration:
      "Same starting conflict, but the reviewer instead retracts the negative intake denial. Only the positive rheumatology assertion remains, so the atom is true.",
    build(kb) {
      const negative = kb.denies(activeAutoimmuneCondition({ patient: maya }), {
        source: "oncology_intake",
      });
      kb.asserts(activeAutoimmuneCondition({ patient: maya }), {
        source: "rheumatology_note",
      });
      kb.retract(negative);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: activeAutoimmuneCondition({ patient: maya }),
          metadata: { source: "rheumatology_note" },
        },
      ],
      rules: [],
    },
    queryAtoms: activeAutoimmuneCondition({ patient: maya }),
    expectedProofs: {
      value: "true",
      goal: {
        kind: "atom",
        atom: activeAutoimmuneCondition({ patient: maya }),
      },
      bindings: [],
      positive: [
        {
          source: "evidence",
          literals: [
            {
              sign: "+",
              atom: activeAutoimmuneCondition({ patient: maya }),
              metadata: { source: "rheumatology_note" },
            },
          ],
        },
      ],
    },
  },
] as const satisfies readonly DslTestSpec[];

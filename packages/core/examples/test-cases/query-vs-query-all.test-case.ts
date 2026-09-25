import { leo, maya, meetsInclusionCriteria, studyRx204 } from "../scenarios/clinical-trial";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: `query` vs `queryAll`.
 *
 * `query` names exactly one grounded proposition and returns a single goal-value
 * result. `queryAll` intentionally ranges over a pattern with variables and
 * returns one result per matching ground atom — zero, one, or many. `query` is
 * not a "first match" shorthand for `queryAll`.
 */
export const queryVsQueryAllTestCases: readonly DslTestSpec[] = [
  {
    name: "query: one grounded proposition",
    invariant:
      "query over a fully grounded atom returns the single goal-value result for that one proposition.",
    narration:
      "Leo has positive inclusion evidence for the trial. Querying the grounded atom should return exactly one true result backed by that literal as an axiom proof.",
    build(kb) {
      kb.asserts(meetsInclusionCriteria({ patient: leo, trial: studyRx204 }), {
        source: "screening_log",
      });
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
          metadata: { source: "screening_log" },
        },
      ],
      rules: [],
    },
    queryAtoms: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
    expectedProofs: {
      value: "true",
      goal: {
        kind: "atom",
        atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
      },
      bindings: [],
      positive: [
        {
          source: "evidence",
          literals: [
            {
              sign: "+",
              atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
              metadata: { source: "screening_log" },
            },
          ],
        },
      ],
    },
  },
  {
    name: "queryAll: pattern ranges over every match",
    invariant:
      "queryAll over an atom containing a variable returns one result per distinct matching ground atom, in evidence order.",
    narration:
      "Both Leo and Maya have inclusion evidence for the trial. Querying the pattern with a patient variable should return both propositions, not a single first match.",
    build(kb) {
      kb.asserts(meetsInclusionCriteria({ patient: leo, trial: studyRx204 }), {
        source: "screening_log",
      });
      kb.asserts(meetsInclusionCriteria({ patient: maya, trial: studyRx204 }), {
        source: "screening_log",
      });
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
          metadata: { source: "screening_log" },
        },
        {
          sign: "+",
          atom: meetsInclusionCriteria({ patient: maya, trial: studyRx204 }),
          metadata: { source: "screening_log" },
        },
      ],
      rules: [],
    },
    queryAtoms: meetsInclusionCriteria({ patient: P, trial: studyRx204 }),
    expectedProofs: [
      {
        value: "true",
        goal: {
          kind: "atom",
          atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
        },
        bindings: [],
        positive: [
          {
            source: "evidence",
            literals: [
              {
                sign: "+",
                atom: meetsInclusionCriteria({ patient: leo, trial: studyRx204 }),
                metadata: { source: "screening_log" },
              },
            ],
          },
        ],
      },
      {
        value: "true",
        goal: {
          kind: "atom",
          atom: meetsInclusionCriteria({ patient: maya, trial: studyRx204 }),
        },
        bindings: [],
        positive: [
          {
            source: "evidence",
            literals: [
              {
                sign: "+",
                atom: meetsInclusionCriteria({ patient: maya, trial: studyRx204 }),
                metadata: { source: "screening_log" },
              },
            ],
          },
        ],
      },
    ],
  },
] as const satisfies readonly DslTestSpec[];

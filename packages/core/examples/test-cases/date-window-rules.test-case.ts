import { add, and, gte, lte, sub, Var } from "../../src/dsl";
import {
  adequatePerformanceStatus,
  consentDate,
  ConsentDate,
  ecogScore,
  maya,
  Score,
  studyRx204,
  VisitDate,
} from "../scenarios/clinical-trial";
import { P, T } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: date-window rules.
 *
 * Date windows need no domain-specific helpers: store ordinary `Date` values in
 * predicates and constrain them with `gte`/`lte` and date subtraction. The
 * comparison and arithmetic terms are side constraints on the rule body — they
 * gate whether the rule fires but contribute no proof children of their own.
 */
const dayMs = 24 * 60 * 60 * 1000;
const consentDay = new Date("2026-03-15");
const inWindowVisit = new Date("2026-03-12");
const outOfWindowVisit = new Date("2026-02-10");
const extendedWindowVisit = new Date("2026-03-05");
const tmp0 = new Var("$tmp0");
const tmp1 = new Var("$tmp1");
const simpleLowerBound = new Date(consentDay.getTime() - 14 * dayMs);
const extendedWindowLength = 14 * dayMs;
const extendedLowerBound = new Date(consentDay.getTime() - extendedWindowLength);

const performanceRule = {
  head: {
    sign: "+",
    atom: adequatePerformanceStatus({ patient: P, trial: T }),
  },
  kind: "if",
  body: and(
    consentDate({ patient: P, trial: T, date: ConsentDate }),
    ecogScore({ patient: P, date: VisitDate, score: Score }),
    gte(VisitDate, sub(ConsentDate, 14 * dayMs)),
    lte(VisitDate, ConsentDate),
    lte(Score, 1),
  ),
} as const;

/**
 * Same window, but its length is composed with `add` (a base period plus an
 * extension) instead of a single literal. `add` is numeric only, so the sum feeds
 * the date subtraction that computes the lower bound.
 */
const extendedWindowRule = {
  head: {
    sign: "+",
    atom: adequatePerformanceStatus({ patient: P, trial: T }),
  },
  kind: "if",
  body: and(
    consentDate({ patient: P, trial: T, date: ConsentDate }),
    ecogScore({ patient: P, date: VisitDate, score: Score }),
    gte(VisitDate, sub(ConsentDate, add(7 * dayMs, 7 * dayMs))),
    lte(VisitDate, ConsentDate),
    lte(Score, 1),
  ),
} as const;

export const dateWindowRulesTestCases: readonly DslTestSpec[] = [
  {
    name: "date window: visit inside the window satisfies the rule",
    invariant:
      "When the visit date is on or within 14 days before consent and the score is low enough, the performance-status rule derives true from the two evidence atoms.",
    narration:
      "Maya consented on 2026-03-15 and was scored 1 on 2026-03-12, three days before consent. The window and score constraints both hold, so adequate_performance_status derives true with axiom children for the consent date and the ECOG score.",
    build(kb) {
      kb.asserts(consentDate({ patient: maya, trial: studyRx204, date: consentDay }), {
        source: "consent_form",
      });
      kb.asserts(ecogScore({ patient: maya, date: inWindowVisit, score: 1 }), {
        source: "screening_visit_note",
      });
      kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(performanceRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: consentDate({
            patient: maya,
            trial: studyRx204,
            date: consentDay,
          }),
          metadata: { source: "consent_form" },
        },
        {
          sign: "+",
          atom: ecogScore({ patient: maya, date: inWindowVisit, score: 1 }),
          metadata: { source: "screening_visit_note" },
        },
      ],
      rules: [performanceRule],
    },
    queryAtoms: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
    expectedProofs: {
      value: "true",
      goal: {
        kind: "atom",
        atom: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
      },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: performanceRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "atom",
                  atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                },
                {
                  kind: "atom",
                  atom: ecogScore({ patient: maya, date: inWindowVisit, score: 1 }),
                },
                {
                  kind: "and",
                  goals: [
                    { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                    { kind: "gte", left: VisitDate, right: tmp0 },
                  ],
                },
                { kind: "lte", left: VisitDate, right: ConsentDate },
                { kind: "lte", left: Score, right: 1 },
              ],
            },
            bindings: [
              [P, maya],
              [T, studyRx204],
              [ConsentDate, consentDay],
              [VisitDate, inWindowVisit],
              [Score, 1],
              [tmp0, simpleLowerBound],
            ],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, inWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: consentDate({
                              patient: maya,
                              trial: studyRx204,
                              date: consentDay,
                            }),
                            metadata: { source: "consent_form" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: ecogScore({ patient: maya, date: inWindowVisit, score: 1 }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, inWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: ecogScore({ patient: maya, date: inWindowVisit, score: 1 }),
                            metadata: { source: "screening_visit_note" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "and",
                      goals: [
                        { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                        { kind: "gte", left: VisitDate, right: tmp0 },
                      ],
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, inWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [
                          {
                            value: "true",
                            goal: { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, inWindowVisit],
                              [Score, 1],
                              [tmp0, simpleLowerBound],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "sub",
                                  operands: [consentDay, 14 * dayMs],
                                  value: "true",
                                  result: simpleLowerBound,
                                  results: [[tmp0, simpleLowerBound]],
                                },
                              },
                            ],
                          },
                          {
                            value: "true",
                            goal: { kind: "gte", left: VisitDate, right: tmp0 },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, inWindowVisit],
                              [Score, 1],
                              [tmp0, simpleLowerBound],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "gte",
                                  operands: [inWindowVisit, simpleLowerBound],
                                  value: "true",
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: VisitDate, right: ConsentDate },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, inWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "lte",
                          operands: [inWindowVisit, consentDay],
                          value: "true",
                        },
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: Score, right: 1 },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, inWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: { operation: "lte", operands: [1, 1], value: "true" },
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
    name: "date window: visit outside the window leaves the rule unknown",
    invariant:
      "When the visit date falls earlier than 14 days before consent, the window constraint fails, the rule does not fire, and the conclusion stays unknown.",
    narration:
      "Maya consented on 2026-03-15 but the only ECOG score is from 2026-02-10, more than 14 days earlier. The window constraint is not met, so adequate_performance_status remains unknown rather than true.",
    build(kb) {
      kb.asserts(consentDate({ patient: maya, trial: studyRx204, date: consentDay }), {
        source: "consent_form",
      });
      kb.asserts(ecogScore({ patient: maya, date: outOfWindowVisit, score: 1 }), {
        source: "screening_visit_note",
      });
      kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(performanceRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: consentDate({
            patient: maya,
            trial: studyRx204,
            date: consentDay,
          }),
          metadata: { source: "consent_form" },
        },
        {
          sign: "+",
          atom: ecogScore({ patient: maya, date: outOfWindowVisit, score: 1 }),
          metadata: { source: "screening_visit_note" },
        },
      ],
      rules: [performanceRule],
    },
    queryAtoms: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
    expectedProofs: {
      value: "unknown",
      goal: {
        kind: "atom",
        atom: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
      },
      bindings: [],
      inconclusive: [
        {
          source: "rule",
          rule: performanceRule,
          body: {
            value: "false",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "atom",
                  atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                },
                {
                  kind: "atom",
                  atom: ecogScore({ patient: maya, date: outOfWindowVisit, score: 1 }),
                },
                {
                  kind: "and",
                  goals: [
                    { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                    { kind: "gte", left: VisitDate, right: tmp0 },
                  ],
                },
                { kind: "lte", left: VisitDate, right: ConsentDate },
                { kind: "lte", left: Score, right: 1 },
              ],
            },
            bindings: [
              [P, maya],
              [T, studyRx204],
              [ConsentDate, consentDay],
              [VisitDate, outOfWindowVisit],
              [Score, 1],
              [tmp0, simpleLowerBound],
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, outOfWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: consentDate({
                              patient: maya,
                              trial: studyRx204,
                              date: consentDay,
                            }),
                            metadata: { source: "consent_form" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: ecogScore({ patient: maya, date: outOfWindowVisit, score: 1 }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, outOfWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: ecogScore({ patient: maya, date: outOfWindowVisit, score: 1 }),
                            metadata: { source: "screening_visit_note" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "false",
                    goal: {
                      kind: "and",
                      goals: [
                        { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                        { kind: "gte", left: VisitDate, right: tmp0 },
                      ],
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, outOfWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    negative: [
                      {
                        source: "subgoals",
                        judgments: [
                          {
                            value: "true",
                            goal: { kind: "sub", bind: tmp0, left: ConsentDate, right: 14 * dayMs },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, outOfWindowVisit],
                              [Score, 1],
                              [tmp0, simpleLowerBound],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "sub",
                                  operands: [consentDay, 14 * dayMs],
                                  value: "true",
                                  result: simpleLowerBound,
                                  results: [[tmp0, simpleLowerBound]],
                                },
                              },
                            ],
                          },
                          {
                            value: "false",
                            goal: { kind: "gte", left: VisitDate, right: tmp0 },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, outOfWindowVisit],
                              [Score, 1],
                              [tmp0, simpleLowerBound],
                            ],
                            negative: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "gte",
                                  operands: [outOfWindowVisit, simpleLowerBound],
                                  value: "false",
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: VisitDate, right: ConsentDate },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, outOfWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "lte",
                          operands: [outOfWindowVisit, consentDay],
                          value: "true",
                        },
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: Score, right: 1 },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, outOfWindowVisit],
                      [Score, 1],
                      [tmp0, simpleLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: { operation: "lte", operands: [1, 1], value: "true" },
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
    name: "date window: window length composed with add",
    invariant:
      "When the window length is expressed as add(7d, 7d), a visit 10 days before consent falls inside the composed 14-day window, so the rule derives true.",
    narration:
      "Maya consented on 2026-03-15 and was scored 1 on 2026-03-05, ten days before consent. The lower bound is consent minus add(7d, 7d) = 14 days, so the visit is inside the composed window and adequate_performance_status derives true.",
    build(kb) {
      kb.asserts(consentDate({ patient: maya, trial: studyRx204, date: consentDay }), {
        source: "consent_form",
      });
      kb.asserts(ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 }), {
        source: "screening_visit_note",
      });
      kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(extendedWindowRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        {
          sign: "+",
          atom: consentDate({
            patient: maya,
            trial: studyRx204,
            date: consentDay,
          }),
          metadata: { source: "consent_form" },
        },
        {
          sign: "+",
          atom: ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 }),
          metadata: { source: "screening_visit_note" },
        },
      ],
      rules: [extendedWindowRule],
    },
    queryAtoms: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
    expectedProofs: {
      value: "true",
      goal: {
        kind: "atom",
        atom: adequatePerformanceStatus({ patient: maya, trial: studyRx204 }),
      },
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: extendedWindowRule,
          body: {
            value: "true",
            goal: {
              kind: "and",
              goals: [
                {
                  kind: "atom",
                  atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                },
                {
                  kind: "atom",
                  atom: ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 }),
                },
                {
                  kind: "and",
                  goals: [
                    { kind: "add", bind: tmp0, left: 7 * dayMs, right: 7 * dayMs },
                    { kind: "sub", bind: tmp1, left: ConsentDate, right: tmp0 },
                    { kind: "gte", left: VisitDate, right: tmp1 },
                  ],
                },
                { kind: "lte", left: VisitDate, right: ConsentDate },
                { kind: "lte", left: Score, right: 1 },
              ],
            },
            bindings: [
              [P, maya],
              [T, studyRx204],
              [ConsentDate, consentDay],
              [VisitDate, extendedWindowVisit],
              [Score, 1],
              [tmp0, extendedWindowLength],
              [tmp1, extendedLowerBound],
            ],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: consentDate({ patient: maya, trial: studyRx204, date: consentDay }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, extendedWindowVisit],
                      [Score, 1],
                      [tmp0, extendedWindowLength],
                      [tmp1, extendedLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: consentDate({
                              patient: maya,
                              trial: studyRx204,
                              date: consentDay,
                            }),
                            metadata: { source: "consent_form" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "atom",
                      atom: ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 }),
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, extendedWindowVisit],
                      [Score, 1],
                      [tmp0, extendedWindowLength],
                      [tmp1, extendedLowerBound],
                    ],
                    positive: [
                      {
                        source: "evidence",
                        literals: [
                          {
                            sign: "+",
                            atom: ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 }),
                            metadata: { source: "screening_visit_note" },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: {
                      kind: "and",
                      goals: [
                        { kind: "add", bind: tmp0, left: 7 * dayMs, right: 7 * dayMs },
                        { kind: "sub", bind: tmp1, left: ConsentDate, right: tmp0 },
                        { kind: "gte", left: VisitDate, right: tmp1 },
                      ],
                    },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, extendedWindowVisit],
                      [Score, 1],
                      [tmp0, extendedWindowLength],
                      [tmp1, extendedLowerBound],
                    ],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [
                          {
                            value: "true",
                            goal: { kind: "add", bind: tmp0, left: 7 * dayMs, right: 7 * dayMs },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, extendedWindowVisit],
                              [Score, 1],
                              [tmp0, extendedWindowLength],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "add",
                                  operands: [7 * dayMs, 7 * dayMs],
                                  value: "true",
                                  result: extendedWindowLength,
                                  results: [[tmp0, extendedWindowLength]],
                                  range: {
                                    lower: extendedWindowLength,
                                    upper: extendedWindowLength,
                                  },
                                },
                              },
                            ],
                          },
                          {
                            value: "true",
                            goal: { kind: "sub", bind: tmp1, left: ConsentDate, right: tmp0 },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, extendedWindowVisit],
                              [Score, 1],
                              [tmp0, extendedWindowLength],
                              [tmp1, extendedLowerBound],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "sub",
                                  operands: [consentDay, extendedWindowLength],
                                  value: "true",
                                  result: extendedLowerBound,
                                  results: [[tmp1, extendedLowerBound]],
                                },
                              },
                            ],
                          },
                          {
                            value: "true",
                            goal: { kind: "gte", left: VisitDate, right: tmp1 },
                            bindings: [
                              [P, maya],
                              [T, studyRx204],
                              [ConsentDate, consentDay],
                              [VisitDate, extendedWindowVisit],
                              [Score, 1],
                              [tmp0, extendedWindowLength],
                              [tmp1, extendedLowerBound],
                            ],
                            positive: [
                              {
                                source: "primitive",
                                evaluation: {
                                  operation: "gte",
                                  operands: [extendedWindowVisit, extendedLowerBound],
                                  value: "true",
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: VisitDate, right: ConsentDate },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, extendedWindowVisit],
                      [Score, 1],
                      [tmp0, extendedWindowLength],
                      [tmp1, extendedLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: {
                          operation: "lte",
                          operands: [extendedWindowVisit, consentDay],
                          value: "true",
                        },
                      },
                    ],
                  },
                  {
                    value: "true",
                    goal: { kind: "lte", left: Score, right: 1 },
                    bindings: [
                      [P, maya],
                      [T, studyRx204],
                      [ConsentDate, consentDay],
                      [VisitDate, extendedWindowVisit],
                      [Score, 1],
                      [tmp0, extendedWindowLength],
                      [tmp1, extendedLowerBound],
                    ],
                    positive: [
                      {
                        source: "primitive",
                        evaluation: { operation: "lte", operands: [1, 1], value: "true" },
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

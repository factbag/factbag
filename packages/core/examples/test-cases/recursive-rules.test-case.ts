import { and, div, gt, letIn, mul, variable } from "../../src/dsl";
import {
  ChildBps,
  DirectBps,
  dmitry,
  effectiveOwnershipBps,
  EffectiveBps,
  EntityVar,
  Intermediate,
  neva,
  Owner,
  ownershipInterestFact,
  ParentBps,
  volga,
} from "../scenarios/ownership";
import type { DslTestSpec } from "../test-runner/test-runner";

/**
 * Theme: recursive rule derivation.
 *
 * A rule whose body references its own head predicate derives a transitive
 * closure. The ownership chain is just the vehicle: the base case lifts a direct
 * fact; the recursive case combines an already-derived conclusion with another
 * fact (here multiplying basis points along the chain, divided by 10,000). A
 * `queryAll` over the pattern returns every conclusion the recursion reaches.
 */
const baseRule = {
  head: {
    sign: "+",
    atom: effectiveOwnershipBps({
      owner: Owner,
      entity: EntityVar,
      basisPoints: DirectBps,
    }),
  },
  kind: "if",
  body: ownershipInterestFact({
    owner: Owner,
    entity: EntityVar,
    basisPoints: DirectBps,
  }),
} as const;

const recursiveRule = {
  head: {
    sign: "+",
    atom: effectiveOwnershipBps({
      owner: Owner,
      entity: EntityVar,
      basisPoints: EffectiveBps,
    }),
  },
  kind: "if",
  body: and(
    effectiveOwnershipBps({
      owner: Owner,
      entity: Intermediate,
      basisPoints: ParentBps,
    }),
    ownershipInterestFact({
      owner: Intermediate,
      entity: EntityVar,
      basisPoints: ChildBps,
    }),
    letIn(EffectiveBps, div(mul(ParentBps, ChildBps), 10_000), gt(EffectiveBps, 0)),
  ),
} as const;

const Tmp0 = variable("$tmp0");
const Tmp1 = variable("$tmp1");

const directOwnershipJudgment = {
  value: "true",
  goal: {
    kind: "atom",
    atom: effectiveOwnershipBps({
      owner: dmitry,
      entity: volga,
      basisPoints: 7_500,
    }),
  },
  bindings: [],
  positive: [
    {
      source: "rule",
      rule: baseRule,
      body: {
        value: "true",
        goal: {
          kind: "atom",
          atom: ownershipInterestFact({
            owner: dmitry,
            entity: volga,
            basisPoints: 7_500,
          }),
        },
        bindings: [
          [Owner, dmitry],
          [EntityVar, volga],
          [DirectBps, 7_500],
        ],
        positive: [
          {
            source: "evidence",
            literals: [
              {
                sign: "+",
                atom: ownershipInterestFact({
                  owner: dmitry,
                  entity: volga,
                  basisPoints: 7_500,
                }),
              },
            ],
          },
        ],
      },
    },
  ],
} as const;

const recursiveBodyBindings = [
  [Owner, dmitry],
  [EntityVar, neva],
  [EffectiveBps, 5_250],
  [Intermediate, volga],
  [ParentBps, 7_500],
  [ChildBps, 7_000],
  [Tmp0, 52_500_000],
  [Tmp1, 5_250],
] as const;

const recursiveOwnershipJudgment = {
  value: "true",
  goal: {
    kind: "atom",
    atom: effectiveOwnershipBps({
      owner: dmitry,
      entity: neva,
      basisPoints: 5_250,
    }),
  },
  bindings: [],
  positive: [
    {
      source: "rule",
      rule: recursiveRule,
      body: {
        value: "true",
        goal: {
          kind: "and",
          goals: [
            {
              kind: "atom",
              atom: effectiveOwnershipBps({
                owner: dmitry,
                entity: volga,
                basisPoints: 7_500,
              }),
            },
            {
              kind: "atom",
              atom: ownershipInterestFact({
                owner: volga,
                entity: neva,
                basisPoints: 7_000,
              }),
            },
            {
              kind: "and",
              goals: [
                {
                  kind: "mul",
                  bind: Tmp0,
                  left: ParentBps,
                  right: ChildBps,
                },
                {
                  kind: "div",
                  bind: Tmp1,
                  left: Tmp0,
                  right: 10_000,
                },
                {
                  kind: "eq",
                  left: EffectiveBps,
                  right: Tmp1,
                },
                {
                  kind: "gt",
                  left: EffectiveBps,
                  right: 0,
                },
              ],
            },
          ],
        },
        bindings: recursiveBodyBindings,
        positive: [
          {
            source: "subgoals",
            judgments: [
              {
                ...directOwnershipJudgment,
                bindings: recursiveBodyBindings,
              },
              {
                value: "true",
                goal: {
                  kind: "atom",
                  atom: ownershipInterestFact({
                    owner: volga,
                    entity: neva,
                    basisPoints: 7_000,
                  }),
                },
                bindings: recursiveBodyBindings,
                positive: [
                  {
                    source: "evidence",
                    literals: [
                      {
                        sign: "+",
                        atom: ownershipInterestFact({
                          owner: volga,
                          entity: neva,
                          basisPoints: 7_000,
                        }),
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
                    {
                      kind: "mul",
                      bind: Tmp0,
                      left: ParentBps,
                      right: ChildBps,
                    },
                    {
                      kind: "div",
                      bind: Tmp1,
                      left: Tmp0,
                      right: 10_000,
                    },
                    {
                      kind: "eq",
                      left: EffectiveBps,
                      right: Tmp1,
                    },
                    {
                      kind: "gt",
                      left: EffectiveBps,
                      right: 0,
                    },
                  ],
                },
                bindings: recursiveBodyBindings,
                positive: [
                  {
                    source: "subgoals",
                    judgments: [
                      {
                        value: "true",
                        goal: {
                          kind: "mul",
                          bind: Tmp0,
                          left: ParentBps,
                          right: ChildBps,
                        },
                        bindings: recursiveBodyBindings,
                        positive: [
                          {
                            source: "primitive",
                            evaluation: {
                              operation: "mul",
                              operands: [7_500, 7_000],
                              value: "true",
                              result: 52_500_000,
                              results: [[Tmp0, 52_500_000]],
                              range: { lower: 52_500_000, upper: 52_500_000 },
                            },
                          },
                        ],
                      },
                      {
                        value: "true",
                        goal: {
                          kind: "div",
                          bind: Tmp1,
                          left: Tmp0,
                          right: 10_000,
                        },
                        bindings: recursiveBodyBindings,
                        positive: [
                          {
                            source: "primitive",
                            evaluation: {
                              operation: "div",
                              operands: [52_500_000, 10_000],
                              value: "true",
                              result: 5_250,
                              results: [[Tmp1, 5_250]],
                              range: { lower: 5_250, upper: 5_250 },
                            },
                          },
                        ],
                      },
                      {
                        value: "true",
                        goal: { kind: "eq", left: EffectiveBps, right: Tmp1 },
                        bindings: recursiveBodyBindings,
                        positive: [
                          {
                            source: "primitive",
                            evaluation: {
                              operation: "eq",
                              operands: [5_250, 5_250],
                              value: "true",
                            },
                          },
                        ],
                      },
                      {
                        value: "true",
                        goal: {
                          kind: "gt",
                          left: EffectiveBps,
                          right: 0,
                        },
                        bindings: recursiveBodyBindings,
                        positive: [
                          {
                            source: "primitive",
                            evaluation: {
                              operation: "gt",
                              operands: [5_250, 0],
                              value: "true",
                            },
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
} as const;

export const recursiveRulesTestCase: DslTestSpec = {
  name: "recursive rule: direct and indirect ownership stakes",
  invariant:
    "queryAll over an effective-ownership pattern returns the direct stake via the base rule and each indirect stake via the self-referential recursive rule, with basis points multiplied along the chain.",
  narration:
    "Dmitry directly owns 75% of Volga, which directly owns 70% of Neva. Effective ownership of Volga is the direct 7,500 bps; effective ownership of Neva is 7,500 * 7,000 / 10,000 = 5,250 bps, derived recursively from the direct proof and the Volga-Neva fact.",
  build(kb) {
    kb.asserts(ownershipInterestFact({ owner: dmitry, entity: volga, basisPoints: 7_500 }));
    kb.asserts(ownershipInterestFact({ owner: volga, entity: neva, basisPoints: 7_000 }));
    kb.rule(
      effectiveOwnershipBps({
        owner: Owner,
        entity: EntityVar,
        basisPoints: DirectBps,
      }),
    ).if(baseRule.body);
    kb.rule(
      effectiveOwnershipBps({
        owner: Owner,
        entity: EntityVar,
        basisPoints: EffectiveBps,
      }),
    ).if(recursiveRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      {
        sign: "+",
        atom: ownershipInterestFact({
          owner: dmitry,
          entity: volga,
          basisPoints: 7_500,
        }),
      },
      {
        sign: "+",
        atom: ownershipInterestFact({
          owner: volga,
          entity: neva,
          basisPoints: 7_000,
        }),
      },
    ],
    rules: [baseRule, recursiveRule],
  },
  queryAtoms: effectiveOwnershipBps({
    owner: dmitry,
    entity: EntityVar,
    basisPoints: EffectiveBps,
  }),
  expectedProofs: [directOwnershipJudgment, recursiveOwnershipJudgment],
};

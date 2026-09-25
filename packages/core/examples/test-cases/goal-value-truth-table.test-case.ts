import { and, or, predicate, type Atom } from "../../src/dsl";
import type { Judgment, QueryJudgment, GoalValue } from "../../src/query";
import type { Literal, Rule } from "../../src/knowledge-base";
import { alice, Person } from "../scenarios/common";
import { P } from "../scenarios/vars";
import type { DslTestSpec } from "../test-runner/test-runner";

const leftInput = predicate("truth_table_left_input", { person: Person });
const rightInput = predicate("truth_table_right_input", { person: Person });
const thirdInput = predicate("truth_table_third_input", { person: Person });
const fourthInput = predicate("truth_table_fourth_input", { person: Person });
const andResult = predicate("truth_table_and_result", { person: Person });
const orResult = predicate("truth_table_or_result", { person: Person });
const nestedResult = predicate("truth_table_nested_result", { person: Person });

const leftRuleAtom = leftInput({ person: P });
const rightRuleAtom = rightInput({ person: P });
const thirdRuleAtom = thirdInput({ person: P });
const fourthRuleAtom = fourthInput({ person: P });

const leftAtom = leftInput({ person: alice });
const rightAtom = rightInput({ person: alice });
const thirdAtom = thirdInput({ person: alice });
const fourthAtom = fourthInput({ person: alice });

const leftGoal = { kind: "atom", atom: leftAtom } as const;
const rightGoal = { kind: "atom", atom: rightAtom } as const;
const thirdGoal = { kind: "atom", atom: thirdAtom } as const;
const fourthGoal = { kind: "atom", atom: fourthAtom } as const;

const andHeadAtom = andResult({ person: P });
const andQueryAtom = andResult({ person: alice });
const andQueryGoal = { kind: "atom", atom: andQueryAtom } as const;
const andBody = and(leftRuleAtom, rightRuleAtom);
const andRule = {
  kind: "iff",
  head: { sign: "+", atom: andHeadAtom },
  body: andBody,
} as const;
const binaryAndGoal = { kind: "and", goals: [leftGoal, rightGoal] } as const;

const orHeadAtom = orResult({ person: P });
const orQueryAtom = orResult({ person: alice });
const orQueryGoal = { kind: "atom", atom: orQueryAtom } as const;
const orBody = or(leftRuleAtom, rightRuleAtom);
const orRule = {
  kind: "iff",
  head: { sign: "+", atom: orHeadAtom },
  body: orBody,
} as const;
const binaryOrGoal = { kind: "or", goals: [leftGoal, rightGoal] } as const;

const nestedHeadAtom = nestedResult({ person: P });
const nestedQueryAtom = nestedResult({ person: alice });
const nestedQueryGoal = { kind: "atom", atom: nestedQueryAtom } as const;

const nestedPureAndBody = and(leftRuleAtom, and(rightRuleAtom, and(thirdRuleAtom, fourthRuleAtom)));
const nestedPureAndRule = {
  kind: "iff",
  head: { sign: "+", atom: nestedHeadAtom },
  body: nestedPureAndBody,
} as const;
const nestedPureAndInnerGoal = { kind: "and", goals: [thirdGoal, fourthGoal] } as const;
const nestedPureAndMiddleGoal = {
  kind: "and",
  goals: [rightGoal, nestedPureAndInnerGoal],
} as const;
const nestedPureAndGoal = {
  kind: "and",
  goals: [leftGoal, nestedPureAndMiddleGoal],
} as const;

const nestedPureOrBody = or(leftRuleAtom, or(rightRuleAtom, or(thirdRuleAtom, fourthRuleAtom)));
const nestedPureOrRule = {
  kind: "iff",
  head: { sign: "+", atom: nestedHeadAtom },
  body: nestedPureOrBody,
} as const;
const nestedPureOrInnerGoal = { kind: "or", goals: [thirdGoal, fourthGoal] } as const;
const nestedPureOrMiddleGoal = {
  kind: "or",
  goals: [rightGoal, nestedPureOrInnerGoal],
} as const;
const nestedPureOrGoal = {
  kind: "or",
  goals: [leftGoal, nestedPureOrMiddleGoal],
} as const;

const mixedConflictBody = and(or(leftRuleAtom, rightRuleAtom), thirdRuleAtom);
const mixedConflictRule = {
  kind: "iff",
  head: { sign: "+", atom: nestedHeadAtom },
  body: mixedConflictBody,
} as const;
const mixedConflictInnerGoal = { kind: "or", goals: [leftGoal, rightGoal] } as const;
const mixedConflictGoal = {
  kind: "and",
  goals: [mixedConflictInnerGoal, thirdGoal],
} as const;

const mixedUnknownBody = or(and(leftRuleAtom, rightRuleAtom), thirdRuleAtom);
const mixedUnknownRule = {
  kind: "iff",
  head: { sign: "+", atom: nestedHeadAtom },
  body: mixedUnknownBody,
} as const;
const mixedUnknownInnerGoal = { kind: "and", goals: [leftGoal, rightGoal] } as const;
const mixedUnknownGoal = { kind: "or", goals: [mixedUnknownInnerGoal, thirdGoal] } as const;

const leftFalseJudgment = {
  value: "false",
  goal: leftGoal,
  bindings: [[P, alice]],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: leftAtom }] }],
} as const;
const leftUnknownJudgment = {
  value: "unknown",
  goal: leftGoal,
  bindings: [[P, alice]],
} as const;
const leftConflictedJudgment = {
  value: "conflicted",
  goal: leftGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: leftAtom }] }],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: leftAtom }] }],
} as const;
const leftTrueJudgment = {
  value: "true",
  goal: leftGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: leftAtom }] }],
} as const;

const rightFalseJudgment = {
  value: "false",
  goal: rightGoal,
  bindings: [[P, alice]],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: rightAtom }] }],
} as const;
const rightUnknownJudgment = {
  value: "unknown",
  goal: rightGoal,
  bindings: [[P, alice]],
} as const;
const rightConflictedJudgment = {
  value: "conflicted",
  goal: rightGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: rightAtom }] }],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: rightAtom }] }],
} as const;
const rightTrueJudgment = {
  value: "true",
  goal: rightGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: rightAtom }] }],
} as const;

const thirdFalseJudgment = {
  value: "false",
  goal: thirdGoal,
  bindings: [[P, alice]],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: thirdAtom }] }],
} as const;
const thirdConflictedJudgment = {
  value: "conflicted",
  goal: thirdGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: thirdAtom }] }],
  negative: [{ source: "evidence", literals: [{ sign: "-", atom: thirdAtom }] }],
} as const;
const thirdTrueJudgment = {
  value: "true",
  goal: thirdGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: thirdAtom }] }],
} as const;
const fourthTrueJudgment = {
  value: "true",
  goal: fourthGoal,
  bindings: [[P, alice]],
  positive: [{ source: "evidence", literals: [{ sign: "+", atom: fourthAtom }] }],
} as const;

const leftJudgments = {
  conflicted: leftConflictedJudgment,
  false: leftFalseJudgment,
  true: leftTrueJudgment,
  unknown: leftUnknownJudgment,
} as const;

const rightJudgments = {
  conflicted: rightConflictedJudgment,
  false: rightFalseJudgment,
  true: rightTrueJudgment,
  unknown: rightUnknownJudgment,
} as const;

type TruthTableFixture = Readonly<{
  operator: "and" | "or";
  leftValue: GoalValue;
  rightValue: GoalValue;
  expectedValue: GoalValue;
  expectedProofs: QueryJudgment;
}>;

const truthTableFixtures = [
  {
    operator: "and",
    leftValue: "false",
    rightValue: "false",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "false",
    rightValue: "unknown",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightUnknownJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "false",
    rightValue: "conflicted",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "false",
    rightValue: "true",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "unknown",
    rightValue: "false",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "unknown",
    rightValue: "unknown",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: andQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "and",
    leftValue: "unknown",
    rightValue: "conflicted",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: andQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "and",
    leftValue: "unknown",
    rightValue: "true",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: andQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "and",
    leftValue: "conflicted",
    rightValue: "false",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "conflicted",
    rightValue: "unknown",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: andQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "and",
    leftValue: "conflicted",
    rightValue: "conflicted",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: andQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "conflicted",
    rightValue: "true",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: andQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightTrueJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightTrueJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "true",
    rightValue: "false",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: andQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "false",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "true",
    rightValue: "unknown",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: andQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "and",
    leftValue: "true",
    rightValue: "conflicted",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: andQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "conflicted",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "and",
    leftValue: "true",
    rightValue: "true",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: andQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: andRule,
          body: {
            value: "true",
            goal: binaryAndGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "false",
    rightValue: "false",
    expectedValue: "false",
    expectedProofs: {
      value: "false",
      goal: orQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "false",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "false",
    rightValue: "unknown",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: orQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "or",
    leftValue: "false",
    rightValue: "conflicted",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "false",
    rightValue: "true",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftFalseJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "unknown",
    rightValue: "false",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: orQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "or",
    leftValue: "unknown",
    rightValue: "unknown",
    expectedValue: "unknown",
    expectedProofs: {
      value: "unknown",
      goal: orQueryGoal,
      bindings: [],
    },
  },
  {
    operator: "or",
    leftValue: "unknown",
    rightValue: "conflicted",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "unknown",
    rightValue: "true",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftUnknownJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "conflicted",
    rightValue: "false",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightFalseJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightFalseJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "conflicted",
    rightValue: "unknown",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightUnknownJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightUnknownJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightUnknownJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightUnknownJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "conflicted",
    rightValue: "conflicted",
    expectedValue: "conflicted",
    expectedProofs: {
      value: "conflicted",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "conflicted",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "conflicted",
    rightValue: "true",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftConflictedJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "true",
    rightValue: "false",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightFalseJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "true",
    rightValue: "unknown",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightUnknownJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "true",
    rightValue: "conflicted",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightConflictedJudgment],
              },
            ],
          },
        },
      ],
    },
  },
  {
    operator: "or",
    leftValue: "true",
    rightValue: "true",
    expectedValue: "true",
    expectedProofs: {
      value: "true",
      goal: orQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: orRule,
          body: {
            value: "true",
            goal: binaryOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [leftTrueJudgment, rightTrueJudgment],
              },
            ],
          },
        },
      ],
    },
  },
] as const satisfies readonly TruthTableFixture[];

export const goalValueTruthTableTestCases: readonly DslTestSpec[] = [
  ...truthTableFixtures.map(truthTableCase),
  nestedCase({
    name: "truth table: nested pure and tree",
    narration:
      "A nested and tree with false, unknown, conflicted, and true leaves evaluates to false.",
    values: ["false", "unknown", "conflicted", "true"],
    body: nestedPureAndBody,
    rule: nestedPureAndRule,
    expectedProofs: {
      value: "false",
      goal: nestedQueryGoal,
      bindings: [],
      negative: [
        {
          source: "rule",
          rule: nestedPureAndRule,
          body: {
            value: "false",
            goal: nestedPureAndGoal,
            bindings: [[P, alice]],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  leftFalseJudgment,
                  {
                    value: "unknown",
                    goal: nestedPureAndMiddleGoal,
                    bindings: [[P, alice]],
                    inconclusive: [
                      {
                        source: "subgoals",
                        judgments: [
                          rightUnknownJudgment,
                          {
                            value: "conflicted",
                            goal: nestedPureAndInnerGoal,
                            bindings: [[P, alice]],
                            positive: [
                              {
                                source: "subgoals",
                                judgments: [thirdConflictedJudgment, fourthTrueJudgment],
                              },
                            ],
                            negative: [
                              {
                                source: "subgoals",
                                judgments: [thirdConflictedJudgment, fourthTrueJudgment],
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
  }),
  nestedCase({
    name: "truth table: nested pure or tree",
    narration:
      "A nested or tree with false, unknown, conflicted, and true leaves evaluates to true.",
    values: ["false", "unknown", "conflicted", "true"],
    body: nestedPureOrBody,
    rule: nestedPureOrRule,
    expectedProofs: {
      value: "true",
      goal: nestedQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: nestedPureOrRule,
          body: {
            value: "true",
            goal: nestedPureOrGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  leftFalseJudgment,
                  {
                    value: "true",
                    goal: nestedPureOrMiddleGoal,
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [
                          rightUnknownJudgment,
                          {
                            value: "true",
                            goal: nestedPureOrInnerGoal,
                            bindings: [[P, alice]],
                            positive: [
                              {
                                source: "subgoals",
                                judgments: [thirdConflictedJudgment, fourthTrueJudgment],
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
  }),
  nestedCase({
    name: "truth table: mixed tree preserves conflict under true",
    narration: "The mixed tree and(or(false, conflicted), true) evaluates to conflicted.",
    values: ["false", "conflicted", "true", "unknown"],
    body: mixedConflictBody,
    rule: mixedConflictRule,
    expectedProofs: {
      value: "conflicted",
      goal: nestedQueryGoal,
      bindings: [],
      positive: [
        {
          source: "rule",
          rule: mixedConflictRule,
          body: {
            value: "conflicted",
            goal: mixedConflictGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: mixedConflictInnerGoal,
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                    negative: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                  },
                  thirdTrueJudgment,
                ],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: mixedConflictInnerGoal,
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                    negative: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                  },
                  thirdTrueJudgment,
                ],
              },
            ],
          },
        },
      ],
      negative: [
        {
          source: "rule",
          rule: mixedConflictRule,
          body: {
            value: "conflicted",
            goal: mixedConflictGoal,
            bindings: [[P, alice]],
            positive: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: mixedConflictInnerGoal,
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                    negative: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                  },
                  thirdTrueJudgment,
                ],
              },
            ],
            negative: [
              {
                source: "subgoals",
                judgments: [
                  {
                    value: "conflicted",
                    goal: mixedConflictInnerGoal,
                    bindings: [[P, alice]],
                    positive: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                    negative: [
                      {
                        source: "subgoals",
                        judgments: [leftFalseJudgment, rightConflictedJudgment],
                      },
                    ],
                  },
                  thirdTrueJudgment,
                ],
              },
            ],
          },
        },
      ],
    },
  }),
  nestedCase({
    name: "truth table: mixed tree can remain unknown",
    narration: "The mixed tree or(and(true, unknown), false) evaluates to unknown.",
    values: ["true", "unknown", "false", "conflicted"],
    body: mixedUnknownBody,
    rule: mixedUnknownRule,
    expectedUnknownBody: {
      value: "unknown",
      goal: mixedUnknownGoal,
      bindings: [[P, alice]],
      inconclusive: [
        {
          source: "subgoals",
          judgments: [
            {
              value: "unknown",
              goal: mixedUnknownInnerGoal,
              bindings: [[P, alice]],
              inconclusive: [
                {
                  source: "subgoals",
                  judgments: [leftTrueJudgment, rightUnknownJudgment],
                },
              ],
            },
            thirdFalseJudgment,
          ],
        },
      ],
    },
    expectedProofs: {
      value: "unknown",
      goal: nestedQueryGoal,
      bindings: [],
    },
  }),
];

function truthTableCase(args: TruthTableFixture): DslTestSpec {
  const body = args.operator === "and" ? andBody : orBody;
  const headAtom = args.operator === "and" ? andHeadAtom : orHeadAtom;
  const queryAtom = args.operator === "and" ? andQueryAtom : orQueryAtom;
  const rule = args.operator === "and" ? andRule : orRule;
  const literals = [
    ...literalsFor(leftAtom, args.leftValue),
    ...literalsFor(rightAtom, args.rightValue),
  ];

  return {
    name: `truth table: ${args.leftValue} ${args.operator} ${args.rightValue} = ${args.expectedValue}`,
    invariant: `${args.operator} follows the goal-value truth table for ${args.leftValue} and ${args.rightValue}.`,
    narration: `The ${args.operator} rule body combines ${args.leftValue} and ${args.rightValue}, so the derived result is ${args.expectedValue}.`,
    build(kb) {
      for (const literal of literals) {
        if (literal.sign === "+") {
          kb.asserts(literal.atom);
        } else {
          kb.denies(literal.atom);
        }
      }
      kb.rule(headAtom).iff(body);
    },
    expectedKnowledgeBase: {
      literals,
      rules: [rule],
    },
    queryAtoms: queryAtom,
    expectedProofs:
      args.expectedValue === "unknown"
        ? {
            ...args.expectedProofs,
            inconclusive: [
              {
                source: "rule",
                rule,
                body: {
                  value: "unknown" as const,
                  goal: args.operator === "and" ? binaryAndGoal : binaryOrGoal,
                  bindings: [[P, alice]],
                  inconclusive: [
                    {
                      source: "subgoals" as const,
                      judgments: [leftJudgments[args.leftValue], rightJudgments[args.rightValue]],
                    },
                  ],
                },
              },
            ],
          }
        : args.expectedProofs,
  } satisfies DslTestSpec;
}

function nestedCase(
  args: Readonly<{
    name: string;
    narration: string;
    values: readonly [GoalValue, GoalValue, GoalValue, GoalValue];
    body: unknown;
    rule: Rule<typeof nestedResult.params, unknown>;
    expectedProofs: QueryJudgment;
    expectedUnknownBody?: Judgment;
  }>,
): DslTestSpec {
  const leafAtoms = [leftAtom, rightAtom, thirdAtom, fourthAtom] as const;
  const literals = [
    ...literalsFor(leafAtoms[0], args.values[0]),
    ...literalsFor(leafAtoms[1], args.values[1]),
    ...literalsFor(leafAtoms[2], args.values[2]),
    ...literalsFor(leafAtoms[3], args.values[3]),
  ];

  return {
    name: args.name,
    invariant: "Nested goal-value trees evaluate by recursively applying min and max.",
    narration: args.narration,
    build(kb) {
      for (const literal of literals) {
        if (literal.sign === "+") {
          kb.asserts(literal.atom);
        } else {
          kb.denies(literal.atom);
        }
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Install a runtime-selected truth-table body whose union is wider than the DSL overload.
      kb.rule(nestedHeadAtom).iff(args.body as never);
    },
    expectedKnowledgeBase: {
      literals,
      rules: [args.rule],
    },
    queryAtoms: nestedQueryAtom,
    expectedProofs:
      args.expectedProofs.value === "unknown" && args.expectedUnknownBody !== undefined
        ? {
            ...args.expectedProofs,
            inconclusive: [
              {
                source: "rule",
                rule: args.rule,
                body: args.expectedUnknownBody,
              },
            ],
          }
        : args.expectedProofs,
  } satisfies DslTestSpec;
}

function literalsFor(atom: Atom, value: GoalValue): readonly Literal[] {
  switch (value) {
    case "false":
      return [{ sign: "-", atom }];
    case "unknown":
      return [];
    case "conflicted":
      return [
        { sign: "+", atom },
        { sign: "-", atom },
      ];
    case "true":
      return [{ sign: "+", atom }];
    default:
      throw new Error("Unhandled goal value");
  }
}

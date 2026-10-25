import {
  add,
  and,
  ceilTo,
  closedPredicate,
  div,
  floorTo,
  gt,
  gte,
  letIn,
  lte,
  max,
  min,
  mul,
  or,
  roundTo,
  sub,
  variable,
} from "../../src/dsl";
import type { NumericTerm } from "../../src/dsl";
import { PrimitiveArithmeticProgrammerError } from "../../src/exceptions/programmer-errors";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const result = closedPredicate("result", { person: Person, value: Number });
const P = variable("P");
const X = variable("X");
const V = variable("V");
const Excess = variable("Excess");

function scenario(amount: number | undefined, expression: NumericTerm) {
  const rule = {
    kind: "iff",
    head: { sign: "+", atom: result({ person: P, value: V }) },
    body: and(income({ person: P, amount: X }), letIn(V, expression, gte(V, -Infinity))),
  } as const;
  return {
    rule,
    build(kb: KnowledgeBase) {
      kb.entities.add(alice);
      if (amount !== undefined) {
        kb.asserts(income({ person: alice, amount }));
      }
      kb.rule(rule.head.atom).iff(rule.body);
    },
    expectedKnowledgeBase: {
      literals:
        amount === undefined
          ? []
          : [{ sign: "+" as const, atom: income({ person: alice, amount }) }],
      rules: [rule],
    },
  };
}

/** Independently calculated values; each case checks bound constraints and discovery. */
const values = [
  {
    name: "whole-dollar tax rounds down",
    amount: 7208.28,
    expression: roundTo(X, 0),
    expected: 7208,
  },
  { name: "whole-dollar tax rounds up", amount: 305.76, expression: roundTo(X, 0), expected: 306 },
  { name: "positive half rounds away", amount: 2.5, expression: roundTo(X, 0), expected: 3 },
  { name: "negative half rounds away", amount: -2.5, expression: roundTo(X, 0), expected: -3 },
  { name: "cents", amount: 12.345, expression: roundTo(X, 2), expected: 12.35 },
  {
    name: "decimal half avoids binary multiplication error",
    amount: 1.005,
    expression: roundTo(X, 2),
    expected: 1.01,
  },
  { name: "negative decimal half", amount: -1.005, expression: roundTo(X, 2), expected: -1.01 },
  {
    name: "scientific notation decimal half",
    amount: 1.005e-7,
    expression: roundTo(X, 9),
    expected: 1.01e-7,
  },
  {
    name: "computed decimal places",
    amount: 12.345,
    expression: roundTo(X, div(6, 3)),
    expected: 12.35,
  },
  {
    name: "below decimal half stays below",
    amount: 1.0049999999999997,
    expression: roundTo(X, 2),
    expected: 1,
  },
  { name: "nearest thousand", amount: 12_345, expression: roundTo(X, -3), expected: 12_000 },
  { name: "half thousand", amount: 12_500, expression: roundTo(X, -3), expected: 13_000 },
  { name: "already whole", amount: 10, expression: roundTo(X, 0), expected: 10 },
  { name: "whole-dollar floor", amount: 10.77, expression: floorTo(X, 0), expected: 10 },
  { name: "whole-dollar ceiling", amount: 10.77, expression: ceilTo(X, 0), expected: 11 },
  { name: "already whole ceiling", amount: 10, expression: ceilTo(X, 0), expected: 10 },
  { name: "negative floor", amount: -10.2, expression: floorTo(X, 0), expected: -11 },
  { name: "negative ceiling", amount: -10.2, expression: ceilTo(X, 0), expected: -10 },
  {
    name: "cent floor preserves decimal integer",
    amount: 0.29,
    expression: floorTo(X, 2),
    expected: 0.29,
  },
  {
    name: "cent ceiling preserves decimal integer",
    amount: 0.07,
    expression: ceilTo(X, 2),
    expected: 0.07,
  },
  { name: "thousand floor", amount: -12_345, expression: floorTo(X, -3), expected: -13_000 },
  { name: "thousand ceiling", amount: -12_345, expression: ceilTo(X, -3), expected: -12_000 },
  { name: "cap applies", amount: 118, expression: min(X, 100), expected: 100 },
  { name: "cap leaves smaller value", amount: 22, expression: min(X, 100), expected: 22 },
  { name: "minimum applies", amount: 250, expression: max(X, 500), expected: 500 },
  { name: "minimum leaves larger value", amount: 750, expression: max(X, 500), expected: 750 },
  {
    name: "deduction floor leaves remainder",
    amount: 1800,
    expression: max(sub(2000, X), 0),
    expected: 200,
  },
  {
    name: "deduction floor prevents negative amount",
    amount: 2800,
    expression: max(sub(2000, X), 0),
    expected: 0,
  },
  {
    name: "fraction of 2500 counts as a step",
    amount: 26_932,
    expression: min(mul(2, ceilTo(div(X, 2500), 0)), 100),
    expected: 22,
  },
  {
    name: "phaseout points are capped",
    amount: 200_000,
    expression: min(mul(2, ceilTo(div(X, 2500), 0)), 100),
    expected: 100,
  },
  {
    name: "tax on second-bracket excess",
    amount: 42_876,
    expression: roundTo(mul(add(X, -36_900), 0.28), 0),
    expected: 1673,
  },
] as const;

const taxRule = {
  kind: "iff",
  head: { sign: "+", atom: result({ person: P, value: V }) },
  body: and(
    income({ person: P, amount: X }),
    or(
      and(lte(X, 36_900), letIn(V, roundTo(mul(X, 0.15), 0), gte(V, 0))),
      and(
        gt(X, 36_900),
        letIn(
          Excess,
          sub(X, 36_900),
          letIn(V, roundTo(add(5535, mul(Excess, 0.28)), 0), gte(V, 0)),
        ),
      ),
    ),
  ),
} as const;

export const roundingTestCases: readonly DslTestSpec[] = [
  ...[
    {
      name: "fine scale preserves large input",
      amount: 1e308,
      expression: roundTo(X, 2),
      expected: 1e308,
    },
    {
      name: "extreme positive places preserve input",
      amount: 10,
      expression: floorTo(X, 1e21),
      expected: 10,
    },
    {
      name: "extreme negative places round to zero",
      amount: 10,
      expression: roundTo(X, -1e21),
      expected: 0,
    },
    {
      name: "coarse positive ceiling overflows",
      amount: 10,
      expression: ceilTo(X, -1e21),
      expected: Infinity,
    },
    {
      name: "coarse negative floor overflows",
      amount: -10,
      expression: floorTo(X, -1e21),
      expected: -Infinity,
    },
    {
      name: "tiny nonzero ceiling preserves direction",
      amount: Number.MIN_VALUE,
      expression: ceilTo(X, -1),
      expected: 10,
    },
    {
      name: "tiny nonzero floor preserves direction",
      amount: -Number.MIN_VALUE,
      expression: floorTo(X, -1),
      expected: -10,
    },
  ].map(({ name, amount, expression, expected }): DslTestSpec => {
    const setup = scenario(amount, expression);
    return {
      ...setup,
      name: `rounding: ${name}`,
      invariant:
        "Extreme integer scales preserve precision or direction rather than producing accidental NaN.",
      narration: `Rounding ${amount} yields ${expected} under number range limits.`,
      queryAtoms: result({ person: alice, value: V }),
      expectedProofs: [
        ruleProof(result({ person: alice, value: expected }), "true", setup.rule, [
          [P, alice],
          [X, amount],
          [V, expected],
        ]),
      ],
    };
  }),
  ...[min, max, roundTo, floorTo, ceilTo].flatMap((operator): DslTestSpec[] =>
    [operator(X, 0), operator(0, X)].map((expression, index) => {
      const dated = closedPredicate("dated", { person: Person, date: Date });
      const date = new Date("2026-01-01T00:00:00Z");
      const rule = {
        kind: "iff",
        head: { sign: "+", atom: result({ person: P, value: V }) },
        body: and(dated({ person: P, date: X }), letIn(V, expression, gte(V, 0))),
      } as const;
      return {
        name: `rounding: ${operator.name} rejects a date in operand ${index}`,
        invariant:
          "These arithmetic operations accept numeric values only, not dates bound through variables.",
        narration:
          "The input variable is bound, but its date value cannot be used in numeric rounding or extrema.",
        build(kb: KnowledgeBase) {
          kb.entities.add(alice);
          kb.asserts(dated({ person: alice, date }));
          kb.rule(rule.head.atom).iff(rule.body);
        },
        expectedKnowledgeBase: {
          literals: [{ sign: "+", atom: dated({ person: alice, date }) }],
          rules: [rule],
        },
        queryAtoms: result({ person: alice, value: V }),
        expectedError: PrimitiveArithmeticProgrammerError,
      };
    }),
  ),
  ...values.flatMap(({ name, amount, expression, expected }): DslTestSpec[] => {
    const setup = scenario(amount, expression);
    return [
      {
        ...setup,
        name: `rounding: ${name} constrains a grounded result`,
        invariant: "Arithmetic agrees with a bound output rather than overwriting it.",
        narration: `The result is ${expected}; the next whole value is rejected.`,
        queryAtoms: [
          result({ person: alice, value: expected }),
          result({ person: alice, value: expected + 1 }),
        ],
        expectedProofs: [expected, expected + 1].map((value) =>
          ruleProof(
            result({ person: alice, value }),
            value === expected ? "true" : "false",
            setup.rule,
            [
              [P, alice],
              [X, amount],
              [V, value],
            ],
          ),
        ),
      },
      {
        ...setup,
        name: `rounding: ${name} enumerates exactly one result`,
        invariant: "An unbound output is constructively bound to the arithmetic result.",
        narration: `Alice has one input, ${amount}, yielding only ${expected}.`,
        queryAtoms: result({ person: alice, value: V }),
        expectedProofs: [
          ruleProof(result({ person: alice, value: expected }), "true", setup.rule, [
            [P, alice],
            [X, amount],
            [V, expected],
          ]),
        ],
      },
    ];
  }),
  ...[11_153, 42_876].flatMap((amount): DslTestSpec[] => {
    const expected = amount === 11_153 ? 1673 : 7208;
    const setup = {
      build(kb: KnowledgeBase) {
        kb.entities.add(alice);
        kb.asserts(income({ person: alice, amount }));
        kb.rule(taxRule.head.atom).iff(taxRule.body);
      },
      expectedKnowledgeBase: {
        literals: [{ sign: "+" as const, atom: income({ person: alice, amount }) }],
        rules: [taxRule],
      },
      invariant: "Each tax bracket rounds its formula and preserves bound output constraints.",
      narration: `Taxable income of ${amount} yields whole-dollar tax of ${expected}.`,
    };
    return [
      {
        ...setup,
        name: `rounding: two-bracket tax on ${amount} accepts only its computed amount`,
        queryAtoms: [
          result({ person: alice, value: expected }),
          result({ person: alice, value: expected + 1 }),
        ],
        expectedProofs: [expected, expected + 1].map((value) =>
          ruleProof(
            result({ person: alice, value }),
            value === expected ? "true" : "false",
            taxRule,
            [
              [P, alice],
              [X, amount],
              [V, value],
            ],
          ),
        ),
      },
      {
        ...setup,
        name: `rounding: two-bracket tax on ${amount} enumerates one amount`,
        queryAtoms: result({ person: alice, value: V }),
        expectedProofs: [
          ruleProof(result({ person: alice, value: expected }), "true", taxRule, [
            [P, alice],
            [X, amount],
            [V, expected],
          ]),
        ],
      },
    ];
  }),
  ...[min(X, 100), max(X, 0), roundTo(X, 0), floorTo(X, 0), ceilTo(X, 0)].flatMap(
    (expression): DslTestSpec[] => {
      const setup = scenario(undefined, expression);
      return [
        {
          ...setup,
          name: `rounding: ${expression.kind} tolerates an unavailable operand on a failed path`,
          invariant: "A missing measurement produces no invented arithmetic binding.",
          narration:
            "The closed income lookup fails; arithmetic remains unavailable without throwing.",
          queryAtoms: result({ person: alice, value: 0 }),
          expectedProofs: ruleProof(result({ person: alice, value: 0 }), "false", setup.rule, [
            [P, alice],
            [V, 0],
          ]),
        },
        {
          ...setup,
          name: `rounding: ${expression.kind} discovers no candidates on a failed path`,
          invariant: "An unavailable operand must not manufacture a candidate output.",
          narration: "There is no income row, so no result can be enumerated.",
          queryAtoms: result({ person: alice, value: V }),
          expectedProofs: [],
        },
      ];
    },
  ),
  ...[roundTo, floorTo, ceilTo].flatMap((operator): DslTestSpec[] =>
    [0.5, NaN, Infinity, -Infinity].map((places) => ({
      ...scenario(10, operator(X, places)),
      name: `rounding: ${operator.name} rejects ${places} decimal places`,
      invariant: "Decimal places must be a finite whole number, reported as invalid program logic.",
      narration:
        "The numeric places operand is not an integer and cannot specify a rounding scale.",
      queryAtoms: result({ person: alice, value: V }),
      expectedError: PrimitiveArithmeticProgrammerError,
    })),
  ),
];

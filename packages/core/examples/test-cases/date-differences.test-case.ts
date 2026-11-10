import {
  add,
  and,
  closedPredicate,
  daysBetween,
  firstOfMonth,
  gte,
  letIn,
  sub,
  variable,
  yearOf,
  yearsBetween,
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { PrimitiveArithmeticProgrammerError } from "../../src/exceptions";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const person = new Person("traveler");
const stay = closedPredicate("stay", { person: Person, from: Date, to: Date });
const born = closedPredicate("born", { person: Person, day: Date });
const stayDays = closedPredicate("stay_days", { person: Person, days: Number });
const ageOn = closedPredicate("age_on", { person: Person, day: Date, years: Number });
const overHalfYear = closedPredicate("over_half_year", { person: Person });
const taxYear = closedPredicate("tax_year", { year: Number });
const yearSpan = closedPredicate("year_span", { year: Number, first: Date, last: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const deathYear = closedPredicate("death_year", { person: Person, year: Number });
const P = variable("P");
const F = variable("F");
const T = variable("T");
const D = variable("D");
const B = variable("B");
const N = variable("N");
const Y = variable("Y");
const L = variable("L");

const daysRule = {
  kind: "iff",
  head: { sign: "+", atom: stayDays({ person: P, days: N }) },
  body: and(stay({ person: P, from: F, to: T }), letIn(N, add(daysBetween(T, F), 1), gte(N, 0))),
} as const;
const halfYearRule = {
  kind: "iff",
  head: { sign: "+", atom: overHalfYear({ person: P }) },
  body: and(stay({ person: P, from: F, to: T }), gte(add(daysBetween(T, F), 1), 183)),
} as const;
const ageRule = {
  kind: "iff",
  head: { sign: "+", atom: ageOn({ person: P, day: D, years: N }) },
  body: and(born({ person: P, day: B }), letIn(N, yearsBetween(D, B), gte(N, -1000))),
} as const;

const DAY_MS = 86_400_000;
const yearSpanRule = {
  kind: "iff",
  head: { sign: "+", atom: yearSpan({ year: Y, first: F, last: L }) },
  body: and(
    taxYear({ year: Y }),
    letIn(F, firstOfMonth(Y, 1), letIn(L, sub(firstOfMonth(add(Y, 1), 1), DAY_MS), gte(L, F))),
  ),
} as const;
const deathYearRule = {
  kind: "iff",
  head: { sign: "+", atom: deathYear({ person: P, year: N }) },
  body: and(died({ person: P, day: D }), letIn(N, yearOf(D), gte(N, 0))),
} as const;

function yearSpanCases(year: number, first: string, last: string): DslTestSpec[] {
  const evidence = taxYear({ year });
  const scenario = {
    build(kb: KnowledgeBase) {
      kb.asserts(evidence);
      kb.rule(yearSpanRule.head.atom).iff(yearSpanRule.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "+", atom: evidence }],
      rules: [yearSpanRule],
    },
    invariant:
      "A year's first and last days follow from the first days of its month and the next year's.",
    narration: `The year ${year} runs from ${first} to ${last}.`,
  } as const;
  const bindings = [
    [Y, year],
    [F, new Date(first)],
    [L, new Date(last)],
  ] as const;
  const result = yearSpan({ year, first: new Date(first), last: new Date(last) });
  return [
    {
      ...scenario,
      name: `firstOfMonth: ${year}, ground span`,
      queryAtoms: result,
      expectedProofs: ruleProof(result, "true", yearSpanRule, bindings),
    },
    {
      ...scenario,
      name: `firstOfMonth: ${year}, enumerated span`,
      queryAtoms: yearSpan({ year, first: F, last: L }),
      expectedProofs: [ruleProof(result, "true", yearSpanRule, bindings)],
    },
  ];
}

function deathYearCases(name: string, on: string, year: number): DslTestSpec[] {
  const day = new Date(on);
  const evidence = died({ person, day });
  const scenario = {
    build(kb: KnowledgeBase) {
      kb.entities.add(person);
      kb.asserts(evidence);
      kb.rule(deathYearRule.head.atom).iff(deathYearRule.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "+", atom: evidence }],
      rules: [deathYearRule],
    },
    invariant: "A date's year is its UTC calendar year.",
    narration: `A death on ${on} falls in ${year}.`,
  } as const;
  const bindings = [
    [P, person],
    [D, day],
  ] as const;
  const result = deathYear({ person, year });
  return [
    {
      ...scenario,
      name: `yearOf: ${name}, enumerated year`,
      queryAtoms: deathYear({ person, year: N }),
      expectedProofs: [ruleProof(result, "true", deathYearRule, [...bindings, [N, year]])],
    },
    {
      ...scenario,
      name: `yearOf: ${name}, rejects the next year`,
      queryAtoms: deathYear({ person, year: year + 1 }),
      expectedProofs: ruleProof(
        deathYear({ person, year: year + 1 }),
        "false",
        deathYearRule,
        bindings,
      ),
    },
  ];
}

function stayCases(name: string, from: string, to: string, days: number): DslTestSpec[] {
  const start = new Date(from);
  const end = new Date(to);
  const evidence = stay({ person, from: start, to: end });
  const scenario = {
    build(kb: KnowledgeBase) {
      kb.entities.add(person);
      kb.asserts(evidence);
      kb.rule(daysRule.head.atom).iff(daysRule.body);
      kb.rule(halfYearRule.head.atom).iff(halfYearRule.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "+", atom: evidence }],
      rules: [daysRule, halfYearRule],
    },
    invariant: "UTC calendar day differences compose with addition and bind number-valued results.",
    narration: `The stay from ${from} to ${to} counts ${days} days including both endpoints.`,
  } as const;
  const bindings = [
    [P, person],
    [F, start],
    [T, end],
  ] as const;
  const result = stayDays({ person, days });
  return [
    {
      ...scenario,
      name: `daysBetween: ${name}, ground count`,
      queryAtoms: result,
      expectedProofs: ruleProof(result, "true", daysRule, [...bindings, [N, days]]),
    },
    {
      ...scenario,
      name: `daysBetween: ${name}, enumerated count`,
      queryAtoms: stayDays({ person, days: N }),
      expectedProofs: [ruleProof(result, "true", daysRule, [...bindings, [N, days]])],
    },
    {
      ...scenario,
      name: `daysBetween: ${name}, rejects an incorrect count`,
      queryAtoms: stayDays({ person, days: days + 1 }),
      expectedProofs: ruleProof(stayDays({ person, days: days + 1 }), "false", daysRule, bindings),
    },
    {
      ...scenario,
      name: `daysBetween: ${name}, half-year threshold`,
      queryAtoms: overHalfYear({ person }),
      expectedProofs: ruleProof(
        overHalfYear({ person }),
        days >= 183 ? "true" : "false",
        halfYearRule,
        bindings,
      ),
    },
  ];
}

function ageCases(name: string, birthday: string, on: string, years: number): DslTestSpec[] {
  const birth = new Date(birthday);
  const day = new Date(on);
  const evidence = born({ person, day: birth });
  const scenario = {
    build(kb: KnowledgeBase) {
      kb.entities.add(person);
      kb.asserts(evidence);
      kb.rule(ageRule.head.atom).iff(ageRule.body);
    },
    expectedKnowledgeBase: {
      literals: [{ sign: "+", atom: evidence }],
      rules: [ageRule],
    },
    invariant:
      "Whole years count UTC anniversaries, with signed results and March 1 leap-day anniversaries.",
    narration: `A birthday of ${birthday} gives ${years} whole years on ${on}.`,
  } as const;
  const bindings = [
    [P, person],
    [D, day],
    [B, birth],
  ] as const;
  const result = ageOn({ person, day, years });
  return [
    {
      ...scenario,
      name: `yearsBetween: ${name}, ground age`,
      queryAtoms: result,
      expectedProofs: ruleProof(result, "true", ageRule, [...bindings, [N, years]]),
    },
    {
      ...scenario,
      name: `yearsBetween: ${name}, enumerated age`,
      queryAtoms: ageOn({ person, day, years: N }),
      expectedProofs: [ruleProof(result, "true", ageRule, [...bindings, [N, years]])],
    },
    {
      ...scenario,
      name: `yearsBetween: ${name}, rejects an incorrect age`,
      queryAtoms: ageOn({ person, day, years: years + 1 }),
      expectedProofs: ruleProof(
        ageOn({ person, day, years: years + 1 }),
        "false",
        ageRule,
        bindings,
      ),
    },
  ];
}

export const dateDifferencesTestCases: readonly DslTestSpec[] = [
  ...stayCases("ignores time of day", "2015-09-01T23:00:00Z", "2015-12-31", 122),
  ...stayCases("spans a leap year", "2015-12-31", "2016-12-31", 367),
  ...stayCases("same calendar day", "2016-03-01T23:00:00Z", "2016-03-01", 1),
  ...stayCases("reversed by one day", "2016-03-02", "2016-03-01", 0),
  ...ageCases("year end", "1950-03-02", "2017-12-31", 67),
  ...ageCases("before anniversary", "1950-03-02", "2015-03-01", 64),
  ...ageCases("on anniversary", "1950-03-02", "2015-03-02", 65),
  ...ageCases("month end", "2014-01-31", "2019-12-31", 5),
  ...ageCases("before leap-day anniversary", "2000-02-29", "2017-02-28", 16),
  ...ageCases("common-year leap-day anniversary", "2000-02-29", "2017-03-01", 17),
  ...ageCases("leap-year anniversary", "2000-02-29", "2016-02-29", 16),
  ...ageCases("within first year", "2017-09-16", "2018-09-15", 0),
  ...ageCases("signed reverse", "2020-01-01", "2018-12-31", -1),
  ...yearSpanCases(2016, "2016-01-01", "2016-12-31"),
  ...yearSpanCases(2100, "2100-01-01", "2100-12-31"),
  ...deathYearCases("last day of the year", "2010-12-31", 2010),
  ...deathYearCases("first day of the year", "2011-01-01", 2011),
  ...deathYearCases("ignores time of day", "2010-12-31T23:59:59Z", 2010),
  {
    name: "firstOfMonth: rejects a month outside 1 to 12",
    invariant: "A month outside the calendar must not roll over into another year.",
    narration: "Month 13 of 2018 is a programmer error, not January 2019.",
    build(kb) {
      kb.rule(yearSpan({ year: 2018, first: F, last: F })).iff(
        letIn(F, firstOfMonth(2018, 13), gte(F, F)),
      );
    },
    expectedKnowledgeBase: {
      literals: [],
      rules: [
        {
          kind: "iff",
          head: { sign: "+", atom: yearSpan({ year: 2018, first: F, last: F }) },
          body: letIn(F, firstOfMonth(2018, 13), gte(F, F)),
        },
      ],
    },
    queryAtoms: yearSpan({ year: 2018, first: F, last: F }),
    expectedError: PrimitiveArithmeticProgrammerError,
  },
  ...[daysBetween, yearsBetween].map((operator): DslTestSpec => {
    const result = closedPredicate(`composed_${operator.name}`, { value: Number });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: result({ value: N }) },
      body: letIn(
        N,
        operator(sub(new Date("2021-01-02"), 86_400_000), new Date("2020-01-01")),
        gte(N, 0),
      ),
    } as const;
    const value = operator === daysBetween ? 366 : 1;
    return {
      name: `${operator.name}: consumes a date-valued formula`,
      invariant:
        "Date subtraction remains date-valued at runtime and composes with calendar differences.",
      narration:
        "Subtracting a day from January 2 produces January 1 before counting the leap year since 2020.",
      build(kb) {
        kb.rule(rule.head.atom).iff(rule.body);
      },
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      queryAtoms: result({ value: N }),
      expectedProofs: [ruleProof(result({ value }), "true", rule, [[N, value]])],
    };
  }),
  ...[daysBetween, yearsBetween].map((operator): DslTestSpec => {
    const result = closedPredicate(`invalid_${operator.name}`, {});
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: result({}) },
      // @ts-expect-error Numbers must not be accepted as date operands, even at runtime.
      body: gte(operator(2, 1), 0),
    } as const;
    return {
      name: `${operator.name}: rejects numeric operands at runtime`,
      invariant: "Date-only arithmetic must not silently fall through to numeric arithmetic.",
      narration:
        "A caller bypassing the type system receives a programmer error, not an invented date difference.",
      build(kb) {
        kb.rule(rule.head.atom).iff(rule.body);
      },
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      queryAtoms: result({}),
      expectedError: PrimitiveArithmeticProgrammerError,
    };
  }),
];

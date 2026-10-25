import {
  add,
  and,
  closedPredicate,
  daysBetween,
  gte,
  letIn,
  sub,
  variable,
  yearsBetween,
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { PrimitiveArithmeticProgrammerError } from "../../src/knowledge-base";
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
const P = variable("P");
const F = variable("F");
const T = variable("T");
const D = variable("D");
const B = variable("B");
const N = variable("N");

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

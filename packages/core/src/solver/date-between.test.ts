/**
 * `daysBetween` and `yearsBetween` count calendar units in UTC: whole days between two
 * dates' calendar days whatever the time of day, and whole years by anniversaries.
 */
import { describe, expect, it } from "vitest";
import { add, and, closedPredicate, daysBetween, gte, letIn, variable, yearsBetween } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";
import { explainJudgment } from "../explanation";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const stay = closedPredicate("stay", { person: Person, from: Date, to: Date });
const born = closedPredicate("born", { person: Person, day: Date });
const stayDays = closedPredicate("stay_days", { person: Person, days: Number });
const ageOn = closedPredicate("age_on", { person: Person, day: Date, years: Number });
const yearsTo = closedPredicate("years_to", { person: Person, day: Date, years: Number });
const overHalfYear = closedPredicate("over_half_year", { person: Person });
const P = variable("P");
const F = variable("F");
const T = variable("T");
const D = variable("D");
const B = variable("B");
const N = variable("N");

function setup(): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  kb.rule(stayDays({ person: P, days: N })).iff(
    and(stay({ person: P, from: F, to: T }), letIn(N, add(daysBetween(T, F), 1), gte(N, 0))),
  );
  kb.rule(ageOn({ person: P, day: D, years: N })).iff(
    and(born({ person: P, day: B }), letIn(N, yearsBetween(D, B), gte(N, 0))),
  );
  kb.rule(yearsTo({ person: P, day: D, years: N })).iff(
    and(born({ person: P, day: B }), letIn(N, yearsBetween(D, B), gte(N, -1000))),
  );
  kb.rule(overHalfYear({ person: P })).iff(
    and(stay({ person: P, from: F, to: T }), gte(add(daysBetween(T, F), 1), 183)),
  );
  return kb;
}

function daysOf(kb: KnowledgeBase): unknown {
  const [judgment, ...rest] = queryAll(kb, stayDays({ person: alice, days: N }));
  expect(rest).toEqual([]);
  expect(judgment?.value).toBe("true");
  return judgment?.goal.atom.fields.days;
}

describe("daysBetween", () => {
  it("counts calendar days, ignoring the time of day", () => {
    const kb = setup();
    kb.asserts(
      stay({ person: alice, from: new Date("2015-09-01T23:00:00Z"), to: new Date("2015-12-31") }),
    );
    // September 1st to December 31st inclusive: 30 + 31 + 30 + 31 = 122 days.
    expect(daysOf(kb)).toBe(122);
    expect(query(kb, overHalfYear({ person: alice })).value).toBe("false");
  });

  it("spans a leap day and a year boundary", () => {
    const kb = setup();
    kb.asserts(stay({ person: alice, from: new Date("2015-12-31"), to: new Date("2016-12-31") }));
    expect(daysOf(kb)).toBe(367);
    expect(query(kb, overHalfYear({ person: alice })).value).toBe("true");
  });

  it("is zero on the same day and negative in reverse", () => {
    const kb = setup();
    kb.asserts(stay({ person: alice, from: new Date("2016-03-01"), to: new Date("2016-03-01") }));
    expect(daysOf(kb)).toBe(1);
    const reversed = setup();
    reversed.asserts(
      stay({ person: alice, from: new Date("2016-03-02"), to: new Date("2016-03-01") }),
    );
    // -1 + 1 = 0: the rule's gte(N, 0) still admits it.
    expect(daysOf(reversed)).toBe(0);
  });
});

describe("yearsBetween", () => {
  function ageOf(birthday: string, day: string): unknown {
    const kb = setup();
    kb.asserts(born({ person: alice, day: new Date(birthday) }));
    const [judgment, ...rest] = queryAll(
      kb,
      ageOn({ person: alice, day: new Date(day), years: N }),
    );
    expect(rest).toEqual([]);
    return judgment?.goal.atom.fields.years;
  }

  it("counts anniversaries", () => {
    expect(ageOf("1950-03-02", "2017-12-31")).toBe(67);
    expect(ageOf("1950-03-02", "2015-03-01")).toBe(64);
    expect(ageOf("1950-03-02", "2015-03-02")).toBe(65);
    expect(ageOf("2014-01-31", "2019-12-31")).toBe(5);
  });

  it("puts the anniversary of a leap day on the 1st of March in a common year", () => {
    expect(ageOf("2000-02-29", "2017-02-28")).toBe(16);
    expect(ageOf("2000-02-29", "2017-03-01")).toBe(17);
    expect(ageOf("2000-02-29", "2016-02-29")).toBe(16);
  });

  it("is zero within the first year and negative in reverse", () => {
    expect(ageOf("2017-09-16", "2018-09-15")).toBe(0);
    const kb = setup();
    kb.asserts(born({ person: alice, day: new Date("2020-01-01") }));
    const before = (day: string, years: number): string =>
      query(kb, yearsTo({ person: alice, day: new Date(day), years })).value;
    expect(before("2019-06-01", 0)).toBe("true");
    expect(before("2018-12-31", -1)).toBe("true");
    expect(before("2018-12-31", 0)).toBe("false");
  });

  it("names the operation in an explanation", () => {
    const kb = setup();
    kb.asserts(born({ person: alice, day: new Date("1950-03-02") }));
    const explanation = explainJudgment(
      query(kb, ageOn({ person: alice, day: new Date("2017-12-31"), years: 67 })),
    );
    expect(JSON.stringify(explanation)).toContain("yearsBetween(");
  });
});

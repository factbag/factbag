/**
 * A conjunct that fails leaves its variables unbound. A later subgoal on that same path may
 * still need candidates derived from rules, and those rules may compare the unbound
 * variable. The path is already false, so the derivation must tolerate the gap rather than
 * report a programmer error.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, gte, lte, not, or, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const married_on = closedPredicate("married_on", { a: Person, b: Person, day: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const married_at = closedPredicate("married_at", { a: Person, b: Person, day: Date });
const married_in = closedPredicate("married_in", { a: Person, b: Person, year: BigInt });
const year_end = closedPredicate("year_end", { year: BigInt, last: Date });

const A = variable("A");
const B = variable("B");
const D = variable("D");
const S = variable("S");
const Y = variable("Y");
const L = variable("L");

function setup(): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice, bob);
  kb.asserts(married_on({ a: alice, b: bob, day: new Date("1992-02-03T00:00:00Z") }));
  kb.asserts(year_end({ year: 2013n, last: new Date("2013-12-31T00:00:00Z") }));
  // The day is an input the body only compares: it must be bound by the caller.
  kb.rule(married_at({ a: A, b: B, day: D })).iff(
    and(married_on({ a: A, b: B, day: S }), lte(S, D)),
  );
  // The first branch binds D from a death that never happened; the second decides.
  kb.rule(married_in({ a: A, b: B, year: Y })).iff(
    and(
      year_end({ year: Y, last: L }),
      or(
        and(died({ person: B, day: D }), gte(D, L), married_at({ a: A, b: B, day: D })),
        married_at({ a: A, b: B, day: L }),
      ),
    ),
  );
  return kb;
}

describe("candidate derivation on a failed path", () => {
  it("does not treat an unbound comparison operand as a programmer error", () => {
    const kb = setup();
    expect(query(kb, married_in({ a: alice, b: bob, year: 2013n })).value).toBe("true");
  });

  it("still enumerates candidates on a live path", () => {
    const kb = setup();
    kb.asserts(died({ person: bob, day: new Date("2014-07-09T00:00:00Z") }));
    expect(query(kb, married_in({ a: alice, b: bob, year: 2013n })).value).toBe("true");
    expect(
      query(kb, married_at({ a: alice, b: bob, day: new Date("1991-01-01T00:00:00Z") })).value,
    ).toBe("false");
  });

  it("leaves negation on the failed path unknown without crashing", () => {
    const kb = setup();
    const unmarried_at = closedPredicate("unmarried_at", { a: Person, b: Person, day: Date });
    const unmarried_in = closedPredicate("unmarried_in", { a: Person, b: Person, year: BigInt });
    kb.rule(unmarried_at({ a: A, b: B, day: D })).iff(not(married_at({ a: A, b: B, day: D })));
    kb.rule(unmarried_in({ a: A, b: B, year: Y })).iff(
      and(
        year_end({ year: Y, last: L }),
        or(
          and(died({ person: B, day: D }), unmarried_at({ a: A, b: B, day: D })),
          unmarried_at({ a: A, b: B, day: L }),
        ),
      ),
    );
    expect(query(kb, unmarried_in({ a: alice, b: bob, year: 2013n })).value).toBe("false");
  });
});

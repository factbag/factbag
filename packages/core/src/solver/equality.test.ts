/**
 * `eq` and `neq` as rule-body constraints: numbers and dates by value, entities by type
 * and id, and a variable left unbound makes the comparison unknown rather than an error.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, eq, neq, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Person {
  constructor(readonly id: string) {}
}
class Company {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const carol = new Person("carol");
const lives_with = closedPredicate("lives_with", { a: Person, b: Person });
const has_other_housemate = closedPredicate("has_other_housemate", {
  person: Person,
  than: Person,
});
const paid = closedPredicate("paid", { person: Person, amount: Number, day: Date });
const paid_exactly = closedPredicate("paid_exactly", { person: Person, amount: Number });
const paid_on = closedPredicate("paid_on", { person: Person, day: Date });
const P = variable("P");
const Q = variable("Q");
const T = variable("T");
const A = variable("A");
const D = variable("D");
const X = variable("X");

describe("eq and neq", () => {
  it("compares numbers and dates by value", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(alice);
    kb.asserts(paid({ person: alice, amount: 100, day: new Date("2020-03-04T00:00:00Z") }));
    kb.rule(paid_exactly({ person: P, amount: A })).iff(
      and(paid({ person: P, amount: X, day: D }), eq(X, A)),
    );
    kb.rule(paid_on({ person: P, day: D })).iff(
      and(paid({ person: P, amount: X, day: T }), eq(T, D)),
    );
    expect(query(kb, paid_exactly({ person: alice, amount: 100 })).value).toBe("true");
    expect(query(kb, paid_exactly({ person: alice, amount: 101 })).value).toBe("false");
    // A different Date instance for the same instant is equal.
    expect(query(kb, paid_on({ person: alice, day: new Date("2020-03-04T00:00:00Z") })).value).toBe(
      "true",
    );
    expect(query(kb, paid_on({ person: alice, day: new Date("2020-03-05T00:00:00Z") })).value).toBe(
      "false",
    );
  });

  it("compares entities by type and id, not by instance", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(alice, bob, carol);
    kb.asserts(lives_with({ a: alice, b: bob }));
    const withCarol = kb.asserts(lives_with({ a: alice, b: carol }));
    kb.rule(has_other_housemate({ person: P, than: Q })).iff(
      and(lives_with({ a: P, b: T }), neq(T, Q)),
    );
    expect(query(kb, has_other_housemate({ person: alice, than: bob })).value).toBe("true");
    // Another instance with the same id is the same entity.
    expect(query(kb, has_other_housemate({ person: alice, than: new Person("bob") })).value).toBe(
      "true",
    );
    kb.retract(withCarol);
    expect(query(kb, has_other_housemate({ person: alice, than: new Person("bob") })).value).toBe(
      "false",
    );
    expect(query(kb, has_other_housemate({ person: alice, than: carol })).value).toBe("true");
  });

  it("tells entities of different types apart even with the same id", () => {
    const kb = new KnowledgeBase();
    const acme = new Company("bob");
    const same_as_bob = closedPredicate("same_as_bob", { thing: Company });
    kb.entities.add(alice, bob, acme);
    kb.asserts(lives_with({ a: alice, b: bob }));
    kb.rule(same_as_bob({ thing: X })).iff(and(lives_with({ a: alice, b: T }), eq(T, X)));
    expect(query(kb, same_as_bob({ thing: acme })).value).toBe("false");
  });

  it("enumerates the other housemates of a person", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(alice, bob, carol);
    kb.asserts(lives_with({ a: alice, b: bob }));
    kb.asserts(lives_with({ a: alice, b: carol }));
    const others = closedPredicate("others", { person: Person, than: Person, other: Person });
    kb.rule(others({ person: P, than: Q, other: T })).iff(
      and(lives_with({ a: P, b: T }), neq(T, Q)),
    );
    const found = queryAll(kb, others({ person: alice, than: bob, other: X }))
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => judgment.goal.atom.fields["other"]);
    expect(found).toEqual([carol]);
  });
});

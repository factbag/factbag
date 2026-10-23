/**
 * A `letIn` or aggregate whose variable is already bound constrains that variable
 * instead of rebinding it, so a rule cannot conclude a head value its body never
 * produced and `or` branches cannot report another branch's bindings as true.
 */
import { describe, expect, it } from "vitest";
import {
  add,
  and,
  closedPredicate,
  count,
  div,
  gt,
  gte,
  letIn,
  lte,
  mul,
  or,
  sum,
  variable,
} from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Person {
  constructor(readonly id: string) {}
}
class Event {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const paid = closedPredicate("paid", { who: Person, event: Event, amount: BigInt });
const week = closedPredicate("paid_in_week", { event: Event, week: String });
const total = closedPredicate("total_paid", { who: Person, amount: BigInt });
const tax = closedPredicate("tax_due", { who: Person, amount: BigInt });
const lesser = closedPredicate("lesser_of_total_and_tax", { who: Person, amount: BigInt });
const weeks = closedPredicate("weeks_paid", { who: Person, count: Number });

const P = variable("P");
const E = variable("E");
const A = variable("A");
const T = variable("T");
const R = variable("R");
const M = variable("M");
const W = variable("W");
const N = variable("N");

function setup(): KnowledgeBase {
  const kb = new KnowledgeBase();
  const first = new Event("first");
  const second = new Event("second");
  kb.entities.add(alice, first, second);
  kb.asserts(paid({ who: alice, event: first, amount: 100n }));
  kb.asserts(paid({ who: alice, event: second, amount: 251n }));
  kb.asserts(week({ event: first, week: "09" }));
  kb.asserts(week({ event: second, week: "09" }));
  kb.rule(total({ who: P, amount: T })).iff(
    letIn(T, sum(A).where(paid({ who: P, event: E, amount: A })), gte(T, 0n)),
  );
  // round(total * 0.28) with integer arithmetic: 351 * 28 = 9828 -> 98.
  kb.rule(tax({ who: P, amount: R })).iff(
    and(total({ who: P, amount: T }), letIn(R, div(add(mul(T, 28n), 50n), 100n), gte(R, 0n))),
  );
  kb.rule(lesser({ who: P, amount: M })).iff(
    and(
      total({ who: P, amount: T }),
      tax({ who: P, amount: R }),
      or(and(lte(T, R), letIn(M, T, gte(M, 0n))), and(gt(T, R), letIn(M, R, gte(M, 0n)))),
    ),
  );
  kb.rule(weeks({ who: P, count: N })).iff(
    letIn(
      N,
      count(W).where(and(paid({ who: P, event: E, amount: A }), week({ event: E, week: W }))),
      gte(N, 0),
    ),
  );
  return kb;
}

describe("let bindings of bound variables", () => {
  it("accepts the computed value and rejects any other", () => {
    const kb = setup();
    expect(query(kb, tax({ who: alice, amount: 98n })).value).toBe("true");
    expect(query(kb, tax({ who: alice, amount: 99n })).value).toBe("false");
    expect(
      queryAll(kb, tax({ who: alice, amount: R })).map((j) => [j.value, j.goal.atom.fields.amount]),
    ).toEqual([["true", 98n]]);
  });

  it("keeps or branches from reporting each other's bindings", () => {
    const kb = setup();
    // The other branch's amount is not even a candidate: its branch is false before the
    // head is discovered, and a ground query for it says so.
    const results = queryAll(kb, lesser({ who: alice, amount: M }));
    expect(results.map((j) => [j.value, j.goal.atom.fields.amount])).toEqual([["true", 98n]]);
    expect(query(kb, lesser({ who: alice, amount: 351n })).value).toBe("false");
  });

  it("constrains aggregate results the same way", () => {
    const kb = setup();
    expect(query(kb, weeks({ who: alice, count: 2 })).value).toBe("true");
    expect(query(kb, weeks({ who: alice, count: 5 })).value).toBe("false");
    expect(query(kb, total({ who: alice, amount: 351n })).value).toBe("true");
    expect(query(kb, total({ who: alice, amount: 1n })).value).toBe("false");
  });
});

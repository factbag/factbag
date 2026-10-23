/**
 * `min`, `max`, `roundTo`, `floorTo` and `ceilTo` on numbers and bigints: halves round
 * away from zero, places may be negative, and a bigint stays whole.
 */
import { describe, expect, it } from "vitest";
import {
  and,
  ceilTo,
  closedPredicate,
  div,
  floorTo,
  gte,
  letIn,
  max,
  min,
  mul,
  roundTo,
  sub,
  variable,
} from "../dsl";
import type { NumericTerm } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const whole = closedPredicate("whole", { person: Person, years: BigInt });
const result = closedPredicate("result", { person: Person, value: Number });
const bigResult = closedPredicate("big_result", { person: Person, value: BigInt });
const P = variable("P");
const X = variable("X");
const V = variable("V");

function valueOf(amount: number, expression: (x: typeof X) => NumericTerm): unknown {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  kb.asserts(income({ person: alice, amount }));
  kb.rule(result({ person: P, value: V })).iff(
    and(income({ person: P, amount: X }), letIn(V, expression(X), gte(V, -1e12))),
  );
  const [judgment, ...rest] = queryAll(kb, result({ person: alice, value: V }));
  expect(rest).toEqual([]);
  expect(judgment?.value).toBe("true");
  return judgment?.goal.atom.fields["value"];
}

function bigValueOf(years: bigint, expression: (x: typeof X) => NumericTerm): unknown {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  kb.asserts(whole({ person: alice, years }));
  kb.rule(bigResult({ person: P, value: V })).iff(
    and(whole({ person: P, years: X }), letIn(V, expression(X), gte(V, -1_000_000n))),
  );
  const [judgment] = queryAll(kb, bigResult({ person: alice, value: V }));
  expect(judgment?.value).toBe("true");
  return judgment?.goal.atom.fields["value"];
}

describe("rounding", () => {
  it("rounds halves away from zero", () => {
    expect(valueOf(7208.28, (x) => roundTo(x, 0))).toBe(7208);
    expect(valueOf(305.76, (x) => roundTo(x, 0))).toBe(306);
    expect(valueOf(2.5, (x) => roundTo(x, 0))).toBe(3);
    expect(valueOf(-2.5, (x) => roundTo(x, 0))).toBe(-3);
  });

  it("rounds to decimal places, positive and negative", () => {
    expect(valueOf(12.345, (x) => roundTo(x, 2))).toBe(12.35);
    expect(valueOf(12_345, (x) => roundTo(x, -3))).toBe(12_000);
    expect(valueOf(12_500, (x) => roundTo(x, -3))).toBe(13_000);
  });

  it("floors and ceils", () => {
    expect(valueOf(10.77, (x) => floorTo(x, 0))).toBe(10);
    expect(valueOf(10.77, (x) => ceilTo(x, 0))).toBe(11);
    expect(valueOf(10, (x) => ceilTo(x, 0))).toBe(10);
    expect(valueOf(-10.2, (x) => floorTo(x, 0))).toBe(-11);
    expect(valueOf(-10.2, (x) => ceilTo(x, 0))).toBe(-10);
    // Two points for each $2,500 or fraction thereof of a $26,932 excess: 11 steps, 22 points.
    expect(valueOf(26_932, (x) => mul(2, ceilTo(div(x, 2500), 0)))).toBe(22);
  });

  it("takes the lesser and the greater", () => {
    expect(valueOf(118, (x) => min(x, 100))).toBe(100);
    expect(valueOf(22, (x) => min(x, 100))).toBe(22);
    expect(valueOf(250, (x) => max(x, 500))).toBe(500);
    expect(valueOf(750, (x) => max(x, 500))).toBe(750);
    expect(valueOf(1800, (x) => max(sub(2000, x), 0))).toBe(200);
    expect(valueOf(2800, (x) => max(sub(2000, x), 0))).toBe(0);
  });

  it("works on bigints, which stay whole", () => {
    expect(bigValueOf(2017n, (x) => min(x, 2025n))).toBe(2017n);
    expect(bigValueOf(2017n, (x) => max(x, 2025n))).toBe(2025n);
    expect(bigValueOf(2017n, (x) => roundTo(x, 0n))).toBe(2017n);
    expect(bigValueOf(2017n, (x) => roundTo(x, -1n))).toBe(2020n);
    expect(bigValueOf(2015n, (x) => roundTo(x, -1n))).toBe(2020n);
    expect(bigValueOf(2014n, (x) => roundTo(x, -1n))).toBe(2010n);
    expect(bigValueOf(2017n, (x) => floorTo(x, -1n))).toBe(2010n);
    expect(bigValueOf(2017n, (x) => ceilTo(x, -1n))).toBe(2020n);
    expect(bigValueOf(-2017n, (x) => floorTo(x, -1n))).toBe(-2020n);
    expect(bigValueOf(-2017n, (x) => ceilTo(x, -1n))).toBe(-2010n);
    expect(bigValueOf(-2015n, (x) => roundTo(x, -1n))).toBe(-2020n);
  });

  it("constrains an already bound variable to the rounded value", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(alice);
    kb.asserts(income({ person: alice, amount: 42_876 }));
    // 15% up to 36,900, then $5,535 plus 28% of the excess, in whole dollars.
    kb.rule(result({ person: P, value: V })).iff(
      and(
        income({ person: P, amount: X }),
        letIn(V, roundTo(mul(sub(X, 36_900), 0.28), 0), gte(V, 0)),
      ),
    );
    expect(query(kb, result({ person: alice, value: 1673 })).value).toBe("true");
    expect(query(kb, result({ person: alice, value: 1674 })).value).toBe("false");
  });
});

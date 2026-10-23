/**
 * An `or` is judged per binding environment. A branch result that binds more
 * than the environment belongs to that larger environment, not to this one, so
 * a branch that is false and binds nothing cannot borrow truth from a sibling
 * whose bindings were discarded.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, lte, or, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Thing {
  constructor(readonly id: string) {}
}
const x1 = new Thing("x1");
const x3 = new Thing("x3");
const p = closedPredicate("p", { x: Thing });
const r = closedPredicate("r", {});
const s = closedPredicate("s", { x: Thing });
const t = closedPredicate("t", {});
const u = closedPredicate("u", { x: Thing });
const married_on = closedPredicate("married_on", { a: Thing, b: Thing, day: Date });
const married_at = closedPredicate("married_at", { a: Thing, b: Thing, day: Date });
const X = variable("X");
const A = variable("A");
const B = variable("B");
const S = variable("S");
const D = variable("D");

describe("or judged per environment", () => {
  it("does not let a branch that binds nothing borrow a sibling's truth", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(x1, x3);
    kb.asserts(p({ x: x1 }));
    kb.asserts(s({ x: x3 }));
    kb.rule(t({})).iff(and(or(p({ x: X }), r({})), s({ x: X })));
    kb.rule(u({ x: X })).iff(and(or(p({ x: X }), r({})), s({ x: X })));
    expect(query(kb, t({})).value).toBe("false");
    expect(queryAll(kb, u({ x: X })).map((j) => [j.goal.atom.fields.x, j.value])).toEqual([
      [x1, "false"],
      [x3, "false"],
    ]);
  });

  it("still finds the truth under the branch that binds", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(x1, x3);
    kb.asserts(p({ x: x1 }));
    kb.asserts(s({ x: x1 }));
    kb.rule(t({})).iff(and(or(p({ x: X }), r({})), s({ x: X })));
    expect(query(kb, t({})).value).toBe("true");
  });

  it("compares a variable bound by whichever branch held", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(x1, x3);
    kb.asserts(married_on({ a: x1, b: x3, day: new Date("2001-06-01") }));
    kb.rule(married_at({ a: A, b: B, day: D })).iff(
      and(or(married_on({ a: A, b: B, day: S }), married_on({ a: B, b: A, day: S })), lte(S, D)),
    );
    const on = (day: string): "true" | "false" | "unknown" | "conflicted" =>
      query(kb, married_at({ a: x3, b: x1, day: new Date(day) })).value;
    expect(on("2010-01-01")).toBe("true");
    expect(on("1999-01-01")).toBe("false");
  });
});

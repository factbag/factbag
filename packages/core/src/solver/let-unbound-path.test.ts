/**
 * A `letIn` of a variable that an earlier, failed conjunct left unbound binds nothing,
 * so the body is judged unknown on that dead path instead of failing an assertion.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, gte, letIn, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";

class Thing {
  constructor(readonly id: string) {}
}

const x1 = new Thing("x1");
const measured = closedPredicate("measured", { thing: Thing, value: Number });
const reported = closedPredicate("reported", { thing: Thing });
const X = variable("X");
const M = variable("M");
const V = variable("V");

describe("letIn of an unbound variable on a dead path", () => {
  it("leaves the let variable unbound and judges the atom by the failed conjunct", () => {
    const kb = new KnowledgeBase();
    kb.entities.add(x1);
    kb.rule(reported({ thing: X })).iff(
      and(measured({ thing: X, value: M }), letIn(V, M, gte(V, 0))),
    );
    expect(query(kb, reported({ thing: x1 })).value).toBe("false");
    kb.asserts(measured({ thing: x1, value: 5 }));
    expect(query(kb, reported({ thing: x1 })).value).toBe("true");
  });
});

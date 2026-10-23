/**
 * Variables bound in every branch of an `or` are available to what follows it.
 * Both validators must agree on this: the variable-use checker already did,
 * but the recursion checker's edge collector dropped branch bindings and
 * reported a comparison after the `or` as an ungrounded self-edge.
 */
import { describe, expect, it } from "vitest";
import { and, closedPredicate, gte, lte, or, variable } from "../../dsl";
import { UnsafeUnboundVariableProgrammerError } from "../../exceptions/programmer-errors";
import { KnowledgeBase } from "../../knowledge-base";
import { query } from "../../query";
import { ruleEdges } from "./utils";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const married_on = closedPredicate("married_on", { a: Person, b: Person, day: Date });
const died = closedPredicate("died", { person: Person, day: Date });
const married_at = closedPredicate("married_at", { a: Person, b: Person, day: Date });
const widowed_at = closedPredicate("widowed_at", { person: Person, day: Date });

const A = variable("A");
const B = variable("B");
const S = variable("S");
const D = variable("D");
const E = variable("E");

function setup(): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice, bob);
  kb.asserts(married_on({ a: alice, b: bob, day: new Date("2001-06-01") }));
  // S is bound in both branches, then compared after the or.
  kb.rule(married_at({ a: A, b: B, day: D })).iff(
    and(or(married_on({ a: A, b: B, day: S }), married_on({ a: B, b: A, day: S })), lte(S, D)),
  );
  return kb;
}

describe("bindings made inside an or", () => {
  it("are visible to a comparison after the or", () => {
    const kb = setup();
    const edges = [...kb.rules()].flatMap(ruleEdges);
    expect(edges.map((edge) => edge.kind)).toEqual(["positive", "positive"]);
    expect(query(kb, married_at({ a: bob, b: alice, day: new Date("2010-01-01") })).value).toBe(
      "true",
    );
    expect(query(kb, married_at({ a: bob, b: alice, day: new Date("1999-01-01") })).value).toBe(
      "false",
    );
  });

  it("are not visible when only one branch binds the variable", () => {
    const kb = setup();
    kb.rule(widowed_at({ person: A, day: D })).iff(
      and(or(died({ person: A, day: E }), married_on({ a: A, b: B, day: S })), gte(D, E)),
    );
    expect(() => query(kb, widowed_at({ person: alice, day: new Date("2010-01-01") }))).toThrow(
      UnsafeUnboundVariableProgrammerError,
    );
  });
});

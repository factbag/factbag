/**
 * A sum over no rows is the number 0, so it can meet number arithmetic: a person with no
 * stated income has an income of 0 that a rule may add to.
 */
import { describe, expect, it } from "vitest";
import { add, and, closedPredicate, gte, letIn, sum, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const total = closedPredicate("total_income", { person: Person, amount: Number });
const padded = closedPredicate("padded_income", { person: Person, amount: Number });
const P = variable("P");
const X = variable("X");
const T = variable("T");
const A = variable("A");

function setup(amounts: readonly number[]): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  for (const amount of amounts) {
    kb.asserts(income({ person: alice, amount }));
  }
  kb.rule(total({ person: P, amount: T })).iff(
    letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, 0)),
  );
  kb.rule(padded({ person: P, amount: A })).iff(
    and(total({ person: P, amount: T }), letIn(A, add(250, T), gte(A, 0))),
  );
  return kb;
}

describe("sum over no rows", () => {
  it("is the number zero", () => {
    const [judgment] = queryAll(setup([]), total({ person: alice, amount: T }));
    expect(judgment?.value).toBe("true");
    expect(judgment?.goal.atom.fields["amount"]).toBe(0);
  });

  it("takes part in number arithmetic", () => {
    expect(query(setup([]), padded({ person: alice, amount: 250 })).value).toBe("true");
    expect(query(setup([100]), padded({ person: alice, amount: 350 })).value).toBe("true");
    expect(query(setup([]), padded({ person: alice, amount: 0 })).value).toBe("false");
  });
});

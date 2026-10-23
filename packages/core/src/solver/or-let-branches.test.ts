/**
 * An `or` whose branches each bind the same variable with `letIn` from different
 * arithmetic, as a bracketed computation does. Arithmetic introduces temporaries into the
 * bindings, so a branch re-evaluated in its own environment binds "more" than that
 * environment in temporaries alone; the `or` must still judge it there rather than find
 * no judgment and fail.
 */
import { describe, expect, it } from "vitest";
import { add, and, closedPredicate, gte, letIn, mul, or, sub, sum, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query, queryAll } from "../query";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const income = closedPredicate("income", { person: Person, amount: Number });
const total = closedPredicate("total_income", { person: Person, amount: Number });
const tax = closedPredicate("bracketed_tax", { person: Person, amount: Number });
const P = variable("P");
const X = variable("X");
const T = variable("T");
const A = variable("A");
const E = variable("E");
const V = variable("V");

function setup(amounts: readonly number[]): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  for (const amount of amounts) {
    kb.asserts(income({ person: alice, amount }));
  }
  kb.rule(total({ person: P, amount: T })).iff(
    letIn(T, sum(X).where(income({ person: P, amount: X })), gte(T, 0)),
  );
  // 15% up to 36,900; 5,535 plus 28% of the excess above it.
  kb.rule(tax({ person: P, amount: A })).iff(
    and(
      total({ person: P, amount: T }),
      or(
        and(gte(36_900, T), letIn(A, mul(T, 0.15), gte(A, 0))),
        and(
          gte(T, 36_901),
          letIn(E, sub(T, 36_900), letIn(A, add(5_535, mul(0.28, E)), gte(A, 0))),
        ),
      ),
    ),
  );
  return kb;
}

function trueAmounts(kb: KnowledgeBase): readonly unknown[] {
  return queryAll(kb, tax({ person: alice, amount: V }))
    .filter((judgment) => judgment.value === "true")
    .map((judgment) => judgment.goal.atom.fields.amount);
}

describe("or branches binding one variable by letIn", () => {
  it("takes the lower branch when its guard holds", () => {
    const kb = setup([17_330, 100]);
    expect(trueAmounts(kb)).toEqual([2_614.5]);
    expect(query(kb, tax({ person: alice, amount: 2_614.5 })).value).toBe("true");
    expect(query(kb, tax({ person: alice, amount: 2_600 })).value).toBe("false");
  });

  it("takes the upper branch when its guard holds", () => {
    const kb = setup([42_876]);
    const [amount, ...rest] = trueAmounts(kb);
    expect(rest).toEqual([]);
    expect(amount).toBeCloseTo(7_208.28, 6);
    expect(query(kb, tax({ person: alice, amount: 2_614.5 })).value).toBe("false");
  });
});

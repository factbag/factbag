/**
 * An `or` reached after a false conjunct of an enclosing `and` is evaluated on a path that
 * may lack bindings. Its branch results from that pass must not then be taken as the binding
 * environments of a later pass on an available path, where the same branches bind more.
 */
import { describe, expect, it } from "vitest";
import { add, and, closedPredicate, gte, letIn, not, or, sum, variable } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { queryAll } from "../query";

class Thing {
  constructor(readonly id: string) {}
}
const alice = new Thing("alice");
const stated = closedPredicate("stated", { person: Thing, kind: String, amount: Number });
const has = closedPredicate("has", { person: Thing, kind: String });
const total = closedPredicate("total", { person: Thing, kind: String, amount: Number });
const base = closedPredicate("base", { person: Thing, amount: Number });
const deps = closedPredicate("deps", { person: Thing, amount: Number });
const main = closedPredicate("main", { person: Thing, amount: Number });
const joint = closedPredicate("joint", { person: Thing, spouse: Thing });
const hasJoint = closedPredicate("hasJoint", { person: Thing });
const ret = closedPredicate("ret", { person: Thing, amount: Number });
const P = variable("P");
const S = variable("S");
const K = variable("K");
const A = variable("A");
const E = variable("E");
const ND = variable("ND");
const X = variable("X");
const X2 = variable("X2");
const T = variable("T");

function build(): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(alice);
  kb.asserts(stated({ person: alice, kind: "e", amount: 2000 }));
  kb.asserts(stated({ person: alice, kind: "c", amount: 2000 }));
  kb.rule(has({ person: P, kind: K })).iff(stated({ person: P, kind: K, amount: A }));
  kb.rule(total({ person: P, kind: K, amount: T })).iff(
    letIn(T, sum(A).where(stated({ person: P, kind: K, amount: A })), gte(T, 0)),
  );
  kb.rule(base({ person: P, amount: E })).iff(letIn(E, 2000, gte(E, 0)));
  kb.rule(deps({ person: P, amount: ND })).iff(
    or(
      and(has({ person: P, kind: "c" }), total({ person: P, kind: "c", amount: ND })),
      and(not(has({ person: P, kind: "c" })), letIn(ND, 0, gte(ND, 0))),
    ),
  );
  kb.rule(main({ person: P, amount: A })).iff(
    or(
      and(has({ person: P, kind: "e" }), total({ person: P, kind: "e", amount: A })),
      and(
        not(has({ person: P, kind: "e" })),
        base({ person: P, amount: E }),
        deps({ person: P, amount: ND }),
        letIn(A, add(E, ND), gte(A, 0)),
      ),
    ),
  );
  kb.rule(hasJoint({ person: P })).iff(joint({ person: P, spouse: S }));
  kb.rule(ret({ person: P, amount: A })).iff(
    or(
      and(
        joint({ person: P, spouse: S }),
        main({ person: P, amount: X }),
        main({ person: S, amount: X2 }),
        letIn(A, add(X, X2), gte(A, 0)),
      ),
      and(not(hasJoint({ person: P })), main({ person: P, amount: A })),
    ),
  );
  return kb;
}

describe("or after a false conjunct", () => {
  it("answers the inner value directly", () => {
    const amounts = queryAll(build(), main({ person: alice, amount: A }))
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => judgment.goal.atom.fields["amount"]);
    expect(amounts).toEqual([2000]);
  });

  it("answers the same value through a rule whose first branch fails before it", () => {
    const amounts = queryAll(build(), ret({ person: alice, amount: A }))
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => judgment.goal.atom.fields["amount"]);
    expect(amounts).toEqual([2000]);
  });
});

import { expect } from "vitest";
import type { QueryJudgment } from "../../src/query";
import type { GroundAtom } from "../../src/types/atom";
import type { DslTestSpec } from "../test-runner/test-runner";

/** Match the public proof root; internal arithmetic temporaries are not this contract. */
function proof(atom: GroundAtom, value: QueryJudgment["value"]): QueryJudgment {
  const support: unknown = expect.arrayContaining([expect.objectContaining({ source: "rule" })]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- Vitest's asymmetric matcher checks these proof fields in the existing harness.
  return expect.objectContaining({
    value,
    goal: { kind: "atom", atom },
    bindings: [],
    [value === "false" ? "negative" : "positive"]: support,
  });
}
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
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";

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

function build(kb: KnowledgeBase) {
  const first = new Event("first");
  const second = new Event("second");
  kb.entities.add(alice, first, second);
  kb.asserts(paid({ who: alice, event: first, amount: 100n }));
  kb.asserts(paid({ who: alice, event: second, amount: 251n }));
  kb.asserts(week({ event: first, week: "09" }));
  kb.asserts(week({ event: second, week: "09" }));
  const rule0 = kb
    .rule(total({ who: P, amount: T }))
    .iff(letIn(T, sum(A).where(paid({ who: P, event: E, amount: A })), gte(T, 0n)));
  // round(total * 0.28) with integer arithmetic: 351 * 28 = 9828 -> 98.
  const rule1 = kb
    .rule(tax({ who: P, amount: R }))
    .iff(and(total({ who: P, amount: T }), letIn(R, div(add(mul(T, 28n), 50n), 100n), gte(R, 0n))));
  const rule2 = kb
    .rule(lesser({ who: P, amount: M }))
    .iff(
      and(
        total({ who: P, amount: T }),
        tax({ who: P, amount: R }),
        or(and(lte(T, R), letIn(M, T, gte(M, 0n))), and(gt(T, R), letIn(M, R, gte(M, 0n)))),
      ),
    );
  const rule3 = kb
    .rule(weeks({ who: P, count: N }))
    .iff(
      letIn(
        N,
        count(W).where(and(paid({ who: P, event: E, amount: A }), week({ event: E, week: W }))),
        gte(N, 0),
      ),
    );
  return {
    literals: [
      { sign: "+" as const, atom: paid({ who: alice, event: first, amount: 100n }) },
      { sign: "+" as const, atom: paid({ who: alice, event: second, amount: 251n }) },
      { sign: "+" as const, atom: week({ event: first, week: "09" }) },
      { sign: "+" as const, atom: week({ event: second, week: "09" }) },
    ],
    rules: [rule0, rule1, rule2, rule3],
  };
}

export const regressionExamples: readonly DslTestSpec[] = [
  {
    name: "Regression: a computed amount constrains the queried amount",
    invariant:
      "Alice was paid 351. The computed rounded amount is 98, so asking for 99 must be false.",
    narration:
      "Alice was paid 351. The computed rounded amount is 98, so asking for 99 must be false.",
    fails: "afb79b2: a computed amount constrains the queried amount",
    build(kb) {
      return build(kb);
    },
    queryAtoms: tax({ who: alice, amount: 99n }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(tax({ who: alice, amount: 99n }), "false"),
      };
    },
  },
  {
    name: "Regression: an aggregate constrains the queried count",
    invariant: "Two payment rows exist. Asking whether the aggregate count is five must be false.",
    narration: "Two payment rows exist. Asking whether the aggregate count is five must be false.",
    fails: "afb79b2: an aggregate constrains the queried count",
    build(kb) {
      return build(kb);
    },
    queryAtoms: weeks({ who: alice, count: 5 }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- build returns these exact handles to the declarative harness.
      const expectedKnowledgeBase = handles as {
        literals: ReturnType<KnowledgeBase["literals"]>;
        rules: ReturnType<KnowledgeBase["rules"]>;
      };
      return {
        expectedKnowledgeBase,
        expectedProofs: proof(weeks({ who: alice, count: 5 }), "false"),
      };
    },
  },
];

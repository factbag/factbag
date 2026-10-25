import { expect } from "vitest";
import {
  and,
  closedPredicate,
  count,
  div,
  gt,
  gte,
  letIn,
  lte,
  or,
  sum,
  variable,
} from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import type { QueryJudgment } from "../../src/query";
import type { GroundAtom } from "../../src/types/atom";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}
class Event {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const first = new Event("first");
const second = new Event("second");
const paid = closedPredicate("paid", { who: Person, event: Event, amount: Number });
const week = closedPredicate("paid_in_week", { event: Event, week: String });
const total = closedPredicate("total_paid", { who: Person, amount: Number });
const tax = closedPredicate("tax_due", { who: Person, amount: Number });
const lesser = closedPredicate("lesser_of_total_and_tax", { who: Person, amount: Number });
const weeks = closedPredicate("weeks_paid", { who: Person, count: Number });

const P = variable("P");
const E = variable("E");
const A = variable("A");
const T = variable("T");
const R = variable("R");
const M = variable("M");
const W = variable("W");
const N = variable("N");

const totalRule = {
  kind: "iff",
  head: { sign: "+", atom: total({ who: P, amount: T }) },
  body: letIn(T, sum(A).where(paid({ who: P, event: E, amount: A })), gte(T, 0)),
} as const;
const taxRule = {
  kind: "iff",
  head: { sign: "+", atom: tax({ who: P, amount: R }) },
  // Half the total keeps this binding example exact in number arithmetic.
  body: and(total({ who: P, amount: T }), letIn(R, div(T, 2), gte(R, 0))),
} as const;
const lesserRule = {
  kind: "iff",
  head: { sign: "+", atom: lesser({ who: P, amount: M }) },
  body: and(
    total({ who: P, amount: T }),
    tax({ who: P, amount: R }),
    or(and(lte(T, R), letIn(M, T, gte(M, 0))), and(gt(T, R), letIn(M, R, gte(M, 0)))),
  ),
} as const;
const weeksRule = {
  kind: "iff",
  head: { sign: "+", atom: weeks({ who: P, count: N }) },
  body: letIn(
    N,
    count(W).where(and(paid({ who: P, event: E, amount: A }), week({ event: E, week: W }))),
    gte(N, 0),
  ),
} as const;

const rules = [totalRule, taxRule, lesserRule, weeksRule] as const;
const scenario = {
  build(kb: KnowledgeBase) {
    kb.entities.add(alice, first, second);
    kb.asserts(paid({ who: alice, event: first, amount: 100 }));
    kb.asserts(paid({ who: alice, event: second, amount: 251 }));
    kb.asserts(week({ event: first, week: "09" }));
    kb.asserts(week({ event: second, week: "09" }));
    kb.rule(totalRule.head.atom).iff(totalRule.body);
    kb.rule(taxRule.head.atom).iff(taxRule.body);
    kb.rule(lesserRule.head.atom).iff(lesserRule.body);
    kb.rule(weeksRule.head.atom).iff(weeksRule.body);
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: paid({ who: alice, event: first, amount: 100 }) },
      { sign: "+", atom: paid({ who: alice, event: second, amount: 251 }) },
      { sign: "+", atom: week({ event: first, week: "09" }) },
      { sign: "+", atom: week({ event: second, week: "09" }) },
    ],
    rules,
  },
} as const;

/**
 * Check the supporting rule, its truth value, and the relevant rule bindings.
 * Arithmetic temporary names and unrelated intermediate proof structure are not
 * the bound-value contract; the existing arithmetic examples cover those trees.
 */
function proof(
  atom: GroundAtom,
  value: "true" | "false",
  rule: (typeof rules)[number],
  bindings: QueryJudgment["bindings"],
): QueryJudgment {
  const body: unknown = expect.objectContaining({
    value,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- An asymmetric matcher intentionally permits arithmetic temporaries.
    bindings: expect.arrayContaining([[P, alice], ...bindings]),
  });
  // oxlint-disable-next-line typescript/no-unsafe-return -- The existing runner evaluates these asymmetric proof expectations.
  return expect.objectContaining({
    value,
    goal: { kind: "atom", atom },
    bindings: [],
    [value === "false" ? "negative" : "positive"]: [{ source: "rule", rule, body }],
  });
}

/** Bound inputs constrain computed results; unbound outputs still discover them. */
export const boundValuesTestCases: readonly DslTestSpec[] = [
  {
    ...scenario,
    name: "bound values: accepts the computed amount and rejects a different amount",
    invariant: "A let binding must agree with a value supplied by the query, not overwrite it.",
    narration:
      "Alice's payments total 351 and tax is 175.5. Querying 175.5 succeeds; querying 99 fails.",
    queryAtoms: [tax({ who: alice, amount: 175.5 }), tax({ who: alice, amount: 99 })],
    expectedProofs: [
      proof(tax({ who: alice, amount: 175.5 }), "true", taxRule, [
        [R, 175.5],
        [T, 351],
      ]),
      proof(tax({ who: alice, amount: 99 }), "false", taxRule, [
        [R, 99],
        [T, 351],
      ]),
    ],
  },
  {
    ...scenario,
    name: "bound values: discovers the computed amount for an unbound query",
    invariant: "Constraining bound variables must not prevent binding an unbound output.",
    narration: "Asking for Alice's tax amount enumerates exactly one true result, 175.5.",
    queryAtoms: tax({ who: alice, amount: R }),
    expectedProofs: [
      proof(tax({ who: alice, amount: 175.5 }), "true", taxRule, [
        [R, 175.5],
        [T, 351],
      ]),
    ],
  },
  {
    ...scenario,
    name: "bound values: disjunction preserves each candidate's computed value",
    invariant: "A branch must not overwrite a candidate with a different branch's computed value.",
    narration:
      "The lesser of total payments (351) and tax (175.5) is 175.5. Enumeration omits the unsupported 351 candidate and retains the true 175.5 candidate.",
    queryAtoms: lesser({ who: alice, amount: M }),
    expectedProofs: [
      proof(lesser({ who: alice, amount: 175.5 }), "true", lesserRule, [
        [M, 175.5],
        [T, 351],
        [R, 175.5],
      ]),
    ],
  },
  {
    ...scenario,
    name: "bound values: rejects a grounded amount from the unsuccessful branch",
    invariant: "A grounded query must not borrow the value computed by a different branch.",
    narration: "Alice's lesser amount is 175.5, so a direct query for 351 is false.",
    queryAtoms: lesser({ who: alice, amount: 351 }),
    expectedProofs: proof(lesser({ who: alice, amount: 351 }), "false", lesserRule, [
      [M, 351],
      [T, 351],
      [R, 175.5],
    ]),
  },
  {
    ...scenario,
    name: "bound values: count constrains the queried count without deduplicating rows",
    invariant: "A count constrains a bound output to the number of matching rows.",
    narration:
      "Two payment rows share the same week label. The count is two, not five (or one distinct week).",
    queryAtoms: [weeks({ who: alice, count: 2 }), weeks({ who: alice, count: 5 })],
    expectedProofs: [
      proof(weeks({ who: alice, count: 2 }), "true", weeksRule, [[N, 2]]),
      proof(weeks({ who: alice, count: 5 }), "false", weeksRule, [[N, 5]]),
    ],
  },
  {
    ...scenario,
    name: "bound values: sum accepts its total and rejects a different queried total",
    invariant: "A sum must constrain an already-bound output rather than overwrite it.",
    narration: "Alice's payments are 100 and 251. Their total is 351, not one.",
    queryAtoms: [total({ who: alice, amount: 351 }), total({ who: alice, amount: 1 })],
    expectedProofs: [
      proof(total({ who: alice, amount: 351 }), "true", totalRule, [[T, 351]]),
      proof(total({ who: alice, amount: 1 }), "false", totalRule, [[T, 1]]),
    ],
  },
];

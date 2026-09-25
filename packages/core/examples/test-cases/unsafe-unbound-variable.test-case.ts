import {
  add,
  and,
  gt,
  letIn,
  not,
  predicate,
  sum,
  variable,
  type PredicateSchema,
} from "../../src/dsl";
import { UnsafeUnboundVariableProgrammerError, type Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const Age = variable("Age");
const Amount = variable("Amount");
const Copy = variable("Copy");
const Score = variable("Score");
const Total = variable("Total");
const eligible = predicate("eligible_with_safe_variables", { person: Person });
const reviewRequired = predicate("review_required_with_safe_variables", { person: Person });
const reviewed = predicate("reviewed_for_safe_variables", { person: Person });
const purchase = predicate("purchase_for_safe_variables", { person: Person });

function expectedError(rule: Rule<PredicateSchema, unknown>) {
  return {
    expectedKnowledgeBase: { literals: [], rules: [rule] },
    expectedError: UnsafeUnboundVariableProgrammerError,
  };
}

/** Definition-of-done examples for unsafe unbound variable failures. */
export const unsafeUnboundVariableTestCases: readonly DslTestSpec[] = [
  {
    name: "DOD: direct comparison with unbound variable throws programmer error",
    invariant:
      "A primitive comparison may only read variables that have a constructive binding source earlier in the rule body.",
    narration:
      "The rule compares Age without any atom, head match, let binding, or aggregate binding that could supply Age. That is invalid program logic, not ordinary uncertainty.",
    build(kb) {
      const rule = kb.rule(eligible({ person: alice })).iff(gt(Age, 18));

      return { rule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return expectedError(rule);
    },
  },
  {
    name: "DOD: arithmetic expression with unbound operand throws programmer error",
    invariant:
      "Arithmetic expressions may only read variables that have a constructive binding source earlier in the rule body.",
    narration:
      "The rule tries to compute Score + 1 before Score has been bound. The solver should reject the unsafe rule instead of carrying an unbound sentinel through arithmetic.",
    build(kb) {
      const rule = kb
        .rule(eligible({ person: alice }))
        .iff(letIn(Total, add(Score, 1), gt(Total, 0)));

      return { rule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return expectedError(rule);
    },
  },
  {
    name: "DOD: let binding from unbound variable throws programmer error",
    invariant:
      "A let binding RHS may only read variables that have a constructive binding source earlier in the rule body.",
    narration:
      "The rule aliases Score into Copy, but Score has no source. Binding another variable to an unsafe unbound variable should fail loudly.",
    build(kb) {
      const rule = kb.rule(eligible({ person: alice })).iff(letIn(Copy, Score, gt(Copy, 0)));

      return { rule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return expectedError(rule);
    },
  },
  {
    name: "DOD: negation with unbound variable throws programmer error",
    invariant:
      "A negated atom may only mention variables that have a constructive binding source earlier in the rule body.",
    narration:
      "The rule asks whether an unbound person was not reviewed. Because the negated atom cannot constructively enumerate P, the rule is unsafe and should throw a programmer error.",
    build(kb) {
      const P = variable("P");
      const rule = kb.rule(eligible({ person: alice })).iff(not(reviewed({ person: P })));

      return { rule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return expectedError(rule);
    },
  },
  {
    name: "DOD: unsafe variable is reported before recursive structure",
    invariant:
      "A locally unsafe variable read should be reported before broader recursive admissibility checks.",
    narration:
      "eligible(P) depends on review_required(P) and Age > Score, while review_required(P) depends back on eligible(P). Age is bound by the head/query, but Score has no source, so the precise failure is unsafe variable use rather than recursion.",
    build(kb) {
      const P = variable("P");
      const rule = kb
        .rule(eligible({ person: P }))
        .iff(and(reviewRequired({ person: P }), gt(Age, Score)));
      const recursiveRule = kb.rule(reviewRequired({ person: P })).iff(eligible({ person: P }));

      return { rule, recursiveRule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handles returned by build.
      const { rule, recursiveRule } = handles as {
        rule: Rule<PredicateSchema, unknown>;
        recursiveRule: Rule<PredicateSchema, unknown>;
      };

      return {
        expectedKnowledgeBase: { literals: [], rules: [rule, recursiveRule] },
        expectedError: UnsafeUnboundVariableProgrammerError,
      };
    },
  },
  {
    name: "DOD: aggregate value with unbound variable throws programmer error",
    invariant:
      "An aggregate value expression may only read variables bound by the aggregate row body or by an outer constructive source.",
    narration:
      "The aggregate sums Amount over purchase rows, but the row body only binds the person field and never supplies Amount. The aggregate value expression is therefore unsafe.",
    build(kb) {
      const rule = kb
        .rule(eligible({ person: alice }))
        .iff(letIn(Total, sum(Amount).where(purchase({ person: alice })), gt(Total, 0)));

      return { rule };
    },
    queryAtoms: eligible({ person: alice }),
    expected(handles) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
      const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

      return expectedError(rule);
    },
  },
];

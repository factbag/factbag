import { gt, letIn, predicate, variable, type PredicateSchema } from "../../src/dsl";
import { AssertionError } from "../../src/utils/assert";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const Score = variable("Score");
const eligible = predicate("eligible_from_score", { person: Person });
const scoreKnown = predicate("score_known", { person: Person });
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Pass an unsupported let RHS to verify runtime assertion rejection.
const unsupportedLetBody = letIn(Score, gt(1, 0) as never, scoreKnown({ person: alice }));

/** Definition-of-done example for unsupported `letIn` RHS assertions. */
export const letBindingPlaceholderTestCase: DslTestSpec = {
  name: "DOD: letIn unsupported RHS throws assertion error",
  invariant:
    "An unsupported let binding RHS is an invalid program shape and should fail loudly as an assertion error.",
  narration:
    "The rule tries to bind Score from a comparison formula. That RHS is not a supported let binding expression, so solving should throw an assertion error rather than returning an unknown proof placeholder.",
  build(kb) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Install the malformed let body to verify runtime assertion rejection.
    const rule = kb.rule(eligible({ person: alice })).iff(unsupportedLetBody as never);

    return { rule };
  },
  queryAtoms: eligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedError: AssertionError,
    };
  },
};

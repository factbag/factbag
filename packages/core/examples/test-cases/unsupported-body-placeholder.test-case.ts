import { predicate, type PredicateSchema } from "../../src/dsl";
import { AssertionError } from "../../src/utils/assert";
import type { Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const reviewed = predicate("reviewed", { person: Person });
const eligible = predicate("eligible_from_review", { person: Person });
const unsupportedBody = {
  kind: "unsupported_review_check",
  args: [reviewed({ person: alice })],
} as const;

/** Definition-of-done example for unsupported rule-body assertions. */
export const unsupportedBodyPlaceholderTestCase: DslTestSpec = {
  name: "DOD: unsupported body formula throws assertion error",
  invariant:
    "Unsupported body forms are invalid program shapes and should fail loudly as assertion errors.",
  narration:
    "The rule body uses a formula descriptor the solver does not understand. That is a programmer/modeling error, not domain uncertainty, so solving should throw an assertion error rather than returning an unknown proof placeholder.",
  build(kb) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Install an unsupported body placeholder to verify runtime assertion rejection.
    const rule = kb.rule(eligible({ person: alice })).iff(unsupportedBody as never);

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

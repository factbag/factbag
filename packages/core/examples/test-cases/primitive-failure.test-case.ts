import { add, gt, letIn, predicate, variable, type PredicateSchema } from "../../src/dsl";
import { PrimitiveArithmeticProgrammerError, type Rule } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const Total = variable("Total");
const eligible = predicate("eligible_with_numeric_total", { person: Person });
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Pass an invalid arithmetic operand to verify runtime programmer-error rejection.
const body = letIn(Total, add(1, "not-a-number" as unknown as never), gt(Total, 0));

/** Definition-of-done example for primitive failure handling. */
export const primitiveFailureTestCase: DslTestSpec = {
  name: "DOD: invalid arithmetic throws a programmer error",
  invariant:
    "A primitive arithmetic operation with unsupported operands should throw a programmer error, not produce a successful binding to undefined.",
  narration:
    "The rule tries to add a number and a string. That arithmetic operation is invalid program logic, so solving the query should fail loudly instead of treating the flawed ruleset as ordinary uncertainty.",
  build(kb) {
    const rule = kb.rule(eligible({ person: alice })).iff(body);

    return { rule };
  },
  queryAtoms: eligible({ person: alice }),
  expected(handles) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The harness passes the exact rule handle returned by build.
    const { rule } = handles as { rule: Rule<PredicateSchema, unknown> };

    return {
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      expectedError: PrimitiveArithmeticProgrammerError,
    };
  },
};

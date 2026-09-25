import { predicate, variable } from "../../src/dsl";
import { ExclusiveDefinitionProgrammerError } from "../../src/knowledge-base";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");
const eligible = predicate("eligible_with_exclusive_definition", { person: Person });
const citizen = predicate("citizen_for_exclusive_definition", { person: Person });
const veteran = predicate("veteran_for_exclusive_definition", { person: Person });

/** Definition-of-done example for iff exclusivity. */
export const exclusiveDefinitionTestCase: DslTestSpec = {
  name: "DOD: iff definition rejects additional rules for the same head",
  invariant:
    "A predicate with an `iff` definition is completely defined and cannot also receive additional sufficient `if` rules.",
  narration:
    "Eligibility is first declared as exactly citizenship. Adding a separate veteran-based eligibility rule would mix complete-definition and disjunctive-rule semantics, so the KB rejects the second rule immediately.",
  build(kb) {
    kb.rule(eligible({ person: P })).iff(citizen({ person: P }));
    kb.rule(eligible({ person: P })).if(veteran({ person: P }));
  },
  queryAtoms: eligible({ person: alice }),
  expectedBuildError: ExclusiveDefinitionProgrammerError,
};

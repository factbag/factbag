import { predicate } from "../../src/dsl";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const accredited = predicate("accredited", { person: Person });

/** Definition-of-done example for evidence metadata retention in proof support. */
export const evidenceMetadataProofTestCase: DslTestSpec = {
  name: "DOD: evidence proof support retains source and quote metadata",
  invariant:
    "Accepted evidence metadata should remain attached to proof leaves so later explanation rendering can include source and quote/citation text.",
  narration:
    "Alice's accredited status is supported by a reviewed document. The proof leaf should retain that source and citation metadata instead of reducing the evidence to only a signed atom.",
  build(kb) {
    kb.asserts(accredited({ person: alice }), {
      source: "investor_packet",
      citation: "Schedule A states Alice is accredited.",
    });
  },
  expectedKnowledgeBase: {
    literals: [
      {
        sign: "+",
        atom: accredited({ person: alice }),
        metadata: {
          source: "investor_packet",
          citation: "Schedule A states Alice is accredited.",
        },
      },
    ],
    rules: [],
  },
  queryAtoms: accredited({ person: alice }),
  expectedProofs: {
    value: "true",
    goal: { kind: "atom", atom: accredited({ person: alice }) },
    bindings: [],
    positive: [
      {
        source: "evidence",
        literals: [
          {
            sign: "+",
            atom: accredited({ person: alice }),
            metadata: {
              source: "investor_packet",
              citation: "Schedule A states Alice is accredited.",
            },
          },
        ],
      },
    ],
  },
};

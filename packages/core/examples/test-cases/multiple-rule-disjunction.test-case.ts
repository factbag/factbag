import { predicate, variable } from "../../src/dsl";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const P = variable("P");

const cleanRoute = predicate("clean_route", { person: Person });
const riskyRoute = predicate("risky_route", { person: Person });
const approved = predicate("approved", { person: Person });

const approvedFromCleanRoute = {
  head: { sign: "+", atom: approved({ person: P }) },
  kind: "if",
  body: cleanRoute({ person: P }),
} as const;

const approvedFromRiskyRoute = {
  head: { sign: "+", atom: approved({ person: P }) },
  kind: "if",
  body: riskyRoute({ person: P }),
} as const;

export const multipleRuleDisjunctionTestCase: DslTestSpec = {
  name: "multiple rules: true route dominates conflicted route while preserving support",
  invariant:
    "Multiple rules for the same head combine by disjunction: a true route dominates a conflicted route for the final value, while the proof keeps both contributing rule supports.",
  narration:
    "Alice is approved if either a clean route or a risky route succeeds. The clean route is true. The risky route has conflicting evidence. The final approval is true, and its positive supports include both the clean true rule and the conflicted risky rule body.",
  build(kb) {
    kb.asserts(cleanRoute({ person: alice }));
    kb.asserts(riskyRoute({ person: alice }));
    kb.denies(riskyRoute({ person: alice }));
    kb.rule(approvedFromCleanRoute.head.atom).if(approvedFromCleanRoute.body);
    kb.rule(approvedFromRiskyRoute.head.atom).if(approvedFromRiskyRoute.body);
  },
  expectedKnowledgeBase: {
    literals: [
      { sign: "+", atom: cleanRoute({ person: alice }) },
      { sign: "+", atom: riskyRoute({ person: alice }) },
      { sign: "-", atom: riskyRoute({ person: alice }) },
    ],
    rules: [approvedFromCleanRoute, approvedFromRiskyRoute],
  },
  queryAtoms: approved({ person: alice }),
  expectedProofs: {
    value: "true",
    goal: { kind: "atom", atom: approved({ person: alice }) },
    bindings: [],
    positive: [
      {
        source: "rule",
        rule: approvedFromCleanRoute,
        body: {
          value: "true",
          goal: { kind: "atom", atom: cleanRoute({ person: alice }) },
          bindings: [[P, alice]],
          positive: [
            {
              source: "evidence",
              literals: [{ sign: "+", atom: cleanRoute({ person: alice }) }],
            },
          ],
        },
      },
      {
        source: "rule",
        rule: approvedFromRiskyRoute,
        body: {
          value: "conflicted",
          goal: { kind: "atom", atom: riskyRoute({ person: alice }) },
          bindings: [[P, alice]],
          positive: [
            {
              source: "evidence",
              literals: [{ sign: "+", atom: riskyRoute({ person: alice }) }],
            },
          ],
          negative: [
            {
              source: "evidence",
              literals: [{ sign: "-", atom: riskyRoute({ person: alice }) }],
            },
          ],
        },
      },
    ],
  },
};

import { and, closedPredicate, eq, gt, neq, variable } from "../../src/dsl";
import type { KnowledgeBase } from "../../src/knowledge-base";
import { AssertionError } from "../../src/utils/assert";
import { ruleProof } from "../test-runner/rule-proof";
import type { DslTestSpec } from "../test-runner/test-runner";

class Person {
  constructor(readonly id: string) {}
}

class Company {
  constructor(readonly id: string) {}
}

const alice = new Person("alice");
const bob = new Person("bob");
const carol = new Person("carol");
const P = variable("P");
const Q = variable("Q");
const T = variable("T");
const X = variable("X");

const scalarCases = [
  { name: "equal numbers", schema: Number, left: 100, right: 100, equal: true },
  { name: "different numbers", schema: Number, left: 100, right: 101, equal: false },
  {
    name: "fresh dates at the same instant",
    schema: Date,
    left: new Date("2020-03-04T00:00:00Z"),
    right: new Date("2020-03-04T00:00:00Z"),
    equal: true,
  },
  {
    name: "different dates",
    schema: Date,
    left: new Date("2020-03-04T00:00:00Z"),
    right: new Date("2020-03-05T00:00:00Z"),
    equal: false,
  },
  { name: "equal strings", schema: String, left: "paid", right: "paid", equal: true },
  { name: "different strings", schema: String, left: "paid", right: "due", equal: false },
  { name: "equal booleans", schema: Boolean, left: false, right: false, equal: true },
  { name: "different booleans", schema: Boolean, left: false, right: true, equal: false },
] as const;

const livesWith = closedPredicate("lives_with", { person: Person, other: Person });
const hasOther = closedPredicate("has_other_housemate", { person: Person, than: Person });
const others = closedPredicate("others", { person: Person, than: Person, other: Person });
const otherRule = {
  kind: "iff",
  head: { sign: "+", atom: hasOther({ person: P, than: Q }) },
  body: and(livesWith({ person: P, other: T }), neq(T, Q)),
} as const;
const enumerationRule = {
  kind: "iff",
  head: { sign: "+", atom: others({ person: P, than: Q, other: T }) },
  body: otherRule.body,
} as const;

function housemates(retractCarol: boolean) {
  return {
    build(kb: KnowledgeBase) {
      kb.entities.add(alice, bob, carol);
      kb.asserts(livesWith({ person: alice, other: bob }));
      const withCarol = kb.asserts(livesWith({ person: alice, other: carol }));
      if (retractCarol) {
        kb.retract(withCarol);
      }
      kb.rule(otherRule.head.atom).iff(otherRule.body);
      kb.rule(enumerationRule.head.atom).iff(enumerationRule.body);
    },
    expectedKnowledgeBase: {
      literals: [
        { sign: "+" as const, atom: livesWith({ person: alice, other: bob }) },
        ...(retractCarol
          ? []
          : [{ sign: "+" as const, atom: livesWith({ person: alice, other: carol }) }]),
      ],
      rules: [otherRule, enumerationRule],
    },
  } as const;
}

export const equalityTestCases: readonly DslTestSpec[] = [
  ...[eq, neq].flatMap((operator) =>
    scalarCases.map(({ name, schema, left, right, equal }): DslTestSpec => {
      const observed = closedPredicate("observed", { person: Person, value: schema });
      const matches = closedPredicate("matches", { person: Person });
      const rule = {
        kind: "iff",
        head: { sign: "+", atom: matches({ person: P }) },
        body: and(observed({ person: P, value: X }), operator(X, right)),
      } as const;
      const value = equal === (operator === eq) ? "true" : "false";
      return {
        name: `equality: ${operator.name} compares ${name} by value`,
        invariant: "Equality uses scalar values, including date instants, not object instances.",
        narration: "A stored observation supplies the left operand; the comparison gates the rule.",
        build(kb) {
          kb.entities.add(alice);
          kb.asserts(observed({ person: alice, value: left }));
          kb.rule(rule.head.atom).iff(rule.body);
        },
        expectedKnowledgeBase: {
          literals: [{ sign: "+", atom: observed({ person: alice, value: left }) }],
          rules: [rule],
        },
        queryAtoms: matches({ person: alice }),
        expectedProofs: ruleProof(matches({ person: alice }), value, rule, [
          [P, alice],
          [X, left],
        ]),
      };
    }),
  ),
  ...[eq, neq].flatMap((operator) =>
    [
      { name: "the same instance", other: bob, equal: true },
      { name: "a fresh instance with the same type and id", other: new Person("bob"), equal: true },
      { name: "a different id", other: carol, equal: false },
      { name: "a different type with the same id", other: new Company("bob"), equal: false },
    ].map(({ name, other, equal }): DslTestSpec => {
      const matches = closedPredicate("matches_entity", { person: Person });
      const rule = {
        kind: "iff",
        head: { sign: "+", atom: matches({ person: P }) },
        body: and(livesWith({ person: P, other: T }), operator(T, other)),
      } as const;
      return {
        name: `equality: ${operator.name} distinguishes ${name}`,
        invariant: "Entity equality uses type and id rather than reference identity or id alone.",
        narration: "Alice lives with Bob. Compare the bound housemate against another entity.",
        build(kb) {
          kb.entities.add(alice, bob);
          kb.asserts(livesWith({ person: alice, other: bob }));
          kb.rule(rule.head.atom).iff(rule.body);
        },
        expectedKnowledgeBase: {
          literals: [{ sign: "+", atom: livesWith({ person: alice, other: bob }) }],
          rules: [rule],
        },
        queryAtoms: matches({ person: alice }),
        expectedProofs: ruleProof(
          matches({ person: alice }),
          equal === (operator === eq) ? "true" : "false",
          rule,
          [
            [P, alice],
            [T, bob],
          ],
        ),
      };
    }),
  ),
  ...[false, true].map((retractCarol): DslTestSpec => {
    const atom = hasOther({ person: alice, than: new Person("bob") });
    return {
      ...housemates(retractCarol),
      name: `equality: neq ${retractCarol ? "rejects Bob after retracting Carol" : "finds Carol rather than a fresh Bob"}`,
      invariant: "Only a housemate with a distinct identity can satisfy neq.",
      narration: "A newly constructed Bob is still Bob; Carol is the only distinct housemate.",
      queryAtoms: atom,
      expectedProofs: ruleProof(atom, retractCarol ? "false" : "true", otherRule, [
        [P, alice],
        [Q, bob],
        [T, retractCarol ? bob : carol],
      ]),
    };
  }),
  {
    ...housemates(false),
    name: "equality: neq enumerates exactly Carol",
    invariant: "A distinctness guard filters candidates without losing constructive bindings.",
    narration: "Querying Alice's housemates other than Bob returns just Carol.",
    queryAtoms: others({ person: alice, than: bob, other: X }),
    expectedProofs: [
      ruleProof(others({ person: alice, than: bob, other: carol }), "true", enumerationRule, [
        [P, alice],
        [Q, bob],
        [T, carol],
      ]),
    ],
  },
  ...[eq, neq].map((operator): DslTestSpec => {
    const matches = closedPredicate("missing_housemate", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: matches({ person: P }) },
      body: and(livesWith({ person: P, other: T }), operator(T, bob)),
    } as const;
    return {
      name: `equality: ${operator.name} tolerates an unbound operand on a failed path`,
      invariant: "Missing operands on failed derivation paths neither throw nor invent support.",
      narration: "No housemate exists to bind T, so the grounded head is false.",
      build(kb) {
        kb.entities.add(alice, bob);
        kb.rule(rule.head.atom).iff(rule.body);
      },
      expectedKnowledgeBase: { literals: [], rules: [rule] },
      queryAtoms: matches({ person: alice }),
      expectedProofs: ruleProof(matches({ person: alice }), "false", rule, [[P, alice]]),
    };
  }),
  ...["left", "right"].map((side): DslTestSpec => {
    const ordered = closedPredicate("ordered_housemate", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: ordered({ person: P }) },
      body: and(livesWith({ person: P, other: T }), side === "left" ? gt(T, 0) : gt(0, T)),
    } as const;
    return {
      name: `equality control: ordered comparisons reject an entity on the ${side}`,
      invariant: "Allowing entity equality must not make entities orderable.",
      narration: "A housemate binds T to Bob, which cannot be compared numerically.",
      build(kb) {
        kb.entities.add(alice, bob);
        kb.asserts(livesWith({ person: alice, other: bob }));
        kb.rule(rule.head.atom).iff(rule.body);
      },
      expectedKnowledgeBase: {
        literals: [{ sign: "+", atom: livesWith({ person: alice, other: bob }) }],
        rules: [rule],
      },
      queryAtoms: ordered({ person: alice }),
      expectedError: AssertionError,
    };
  }),
];

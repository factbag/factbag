/**
 * Asserts multi-result query solving for grounded variables, rule-body
 * unsupported cases, open-world negation, and closed-world negation semantics.
 */
import { describe, expect, it } from "vitest";
import {
  add,
  and,
  closedPredicate,
  count,
  exists,
  gt,
  letIn,
  not,
  predicate,
  variable,
} from "../dsl";
import { AssertionError } from "../utils/assert";
import { solveQueryAll } from "./solve-all";
import { KnowledgeBase } from "../knowledge-base/knowledge-base";
import { query, queryAll } from "../query/query";

class Person {
  constructor(readonly id: string) {}
}

it("terminates when propagating blocking through ownership and control", () => {
  const kb = new KnowledgeBase();
  const alice = new Person("alice");
  const bob = new Person("bob");
  const carol = new Person("carol");
  const blocked = predicate("blocked", { person: Person });
  const owns = predicate("owns", { owner: Person, entity: Person });
  const controls = predicate("controls", { owner: Person, entity: Person });
  const X = variable("X");
  const Y = variable("Y");

  kb.asserts(blocked({ person: alice }));
  kb.asserts(owns({ owner: alice, entity: bob }));
  kb.asserts(controls({ owner: bob, entity: carol }));
  kb.rule(blocked({ person: Y })).if(and(blocked({ person: X }), owns({ owner: X, entity: Y })));
  kb.rule(blocked({ person: Y })).if(
    and(blocked({ person: X }), controls({ owner: X, entity: Y })),
  );

  expect(query(kb, blocked({ person: carol })).value).toBe("true");
});

describe("recursive candidate discovery", () => {
  function fixture(reverseRules = false, edgeFirst = false) {
    const kb = new KnowledgeBase();
    const blocked = closedPredicate("blocked", { person: Person });
    const owns = predicate("owns", { owner: Person, entity: Person });
    const controls = predicate("controls", { owner: Person, entity: Person });
    const X = variable("X");
    const Y = variable("Y");
    for (const edge of reverseRules ? [controls, owns] : [owns, controls]) {
      const parent = blocked({ person: X });
      const relation = edge({ owner: X, entity: Y });
      kb.rule(blocked({ person: Y })).if(edgeFirst ? and(relation, parent) : and(parent, relation));
    }
    return { kb, blocked, owns, controls, X };
  }

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])("discovers a mixed chain with reversed rules=%s and edge-first=%s", (reverse, edgeFirst) => {
    const { kb, blocked, owns, controls, X } = fixture(reverse, edgeFirst);
    let previous = new Person("0");
    const people = [previous];
    kb.asserts(blocked({ person: previous }));
    for (let index = 1; index < 6; index++) {
      const person = new Person(String(index));
      const edge = index % 2 === 0 ? controls : owns;
      kb.asserts(edge({ owner: previous, entity: person }));
      people.push(person);
      previous = person;
    }

    expect(query(kb, blocked({ person: previous })).value).toBe("true");
    const results = queryAll(kb, blocked({ person: X }));
    expect(results.map((result) => result.goal.atom.fields.person.id).sort()).toEqual(
      people.map((person) => person.id).sort(),
    );
    expect(results.every((result) => result.value === "true")).toBe(true);
  });

  it("reaches a fixed point on a seeded cycle without duplicating answers", () => {
    const { kb, blocked, owns, controls, X } = fixture();
    const alice = new Person("alice");
    const bob = new Person("bob");
    const carol = new Person("carol");
    kb.asserts(blocked({ person: alice }));
    kb.asserts(owns({ owner: alice, entity: bob }));
    kb.asserts(controls({ owner: bob, entity: carol }));
    kb.asserts(owns({ owner: carol, entity: alice }));

    const results = queryAll(kb, blocked({ person: X }));
    expect(results.map((result) => result.goal.atom.fields.person.id).sort()).toEqual([
      "alice",
      "bob",
      "carol",
    ]);
    expect(results.every((result) => result.value === "true")).toBe(true);
  });

  it("propagates newly discovered candidates between mutually recursive predicates", () => {
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const bob = new Person("bob");
    const carol = new Person("carol");
    const blocked = predicate("blocked", { person: Person });
    const reviewable = predicate("reviewable", { person: Person });
    const owns = predicate("owns", { owner: Person, entity: Person });
    const X = variable("X");
    const Y = variable("Y");
    kb.asserts(blocked({ person: alice }));
    kb.asserts(owns({ owner: alice, entity: bob }));
    kb.asserts(owns({ owner: bob, entity: carol }));
    kb.rule(reviewable({ person: X })).if(blocked({ person: X }));
    kb.rule(blocked({ person: Y })).if(
      and(reviewable({ person: X }), owns({ owner: X, entity: Y })),
    );

    const results = queryAll(kb, reviewable({ person: X }));
    expect(results.map((result) => result.goal.atom.fields.person.id).sort()).toEqual([
      "alice",
      "bob",
      "carol",
    ]);
    expect(results.every((result) => result.value === "true")).toBe(true);
  });

  it("does not manufacture truth from an unseeded mixed cycle", () => {
    const { kb, blocked, owns, controls } = fixture();
    const alice = new Person("alice");
    const bob = new Person("bob");
    kb.asserts(owns({ owner: alice, entity: bob }));
    kb.asserts(controls({ owner: bob, entity: alice }));

    expect(query(kb, blocked({ person: alice })).value).toBe("unknown");
  });

  it("finishes recursive discovery before deriving aggregate-valued candidates", () => {
    const { kb, blocked, owns, controls, X } = fixture();
    const alice = new Person("alice");
    const bob = new Person("bob");
    const carol = new Person("carol");
    const total = predicate("total", { value: Number });
    const N = variable("N");
    kb.asserts(blocked({ person: alice }));
    kb.asserts(owns({ owner: alice, entity: bob }));
    kb.asserts(controls({ owner: bob, entity: carol }));
    kb.rule(total({ value: N })).if(letIn(N, count(X).where(blocked({ person: X })), gt(N, 0)));

    const results = queryAll(kb, total({ value: N }));
    expect(results.map((result) => result.goal.atom.fields.value)).toEqual([3]);
    expect(results[0]?.value).toBe("true");
  });

  it("does not reuse candidate tables after evidence is retracted", () => {
    const { kb, blocked, owns, controls, X } = fixture();
    const alice = new Person("alice");
    const bob = new Person("bob");
    const carol = new Person("carol");
    kb.asserts(blocked({ person: alice }));
    kb.asserts(owns({ owner: alice, entity: bob }));
    const edge = kb.asserts(controls({ owner: bob, entity: carol }));
    expect(
      queryAll(kb, blocked({ person: X }))
        .map((result) => result.goal.atom.fields.person.id)
        .sort(),
    ).toEqual(["alice", "bob", "carol"]);

    kb.retract(edge);
    const results = queryAll(kb, blocked({ person: X }));
    expect(results.map((result) => result.goal.atom.fields.person.id).sort()).toEqual([
      "alice",
      "bob",
    ]);
    expect(results.every((result) => result.value === "true")).toBe(true);
  });

  it("preserves repeated-variable constraints across candidate lookups", () => {
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const bob = new Person("bob");
    const pair = predicate("pair", { left: Person, right: Person });
    const observed = predicate("observed", { person: Person });
    const X = variable("X");
    const Y = variable("Y");
    const Z = variable("Z");
    kb.asserts(pair({ left: alice, right: bob }));
    kb.asserts(pair({ left: bob, right: bob }));
    // Populate the narrower table first: conflating pair(X, X) with pair(Y, Z)
    // would then incorrectly omit Alice from the broader lookup.
    kb.rule(observed({ person: Y })).if(
      and(pair({ left: X, right: X }), pair({ left: Y, right: Z })),
    );

    const results = queryAll(kb, observed({ person: Y }));
    expect(results.map((result) => result.goal.atom.fields.person.id).sort()).toEqual([
      "alice",
      "bob",
    ]);
    expect(results.every((result) => result.value === "true")).toBe(true);
  });
});

describe("solveQueryAll", () => {
  it("does not reuse a circularly restricted judgment in a less restricted proof", () => {
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const P = variable("P");
    const seeded = predicate("seeded", { person: Person });
    const eligible = predicate("eligible", { person: Person });
    const reviewable = predicate("reviewable", { person: Person });
    const approved = predicate("approved", { person: Person });
    kb.asserts(seeded({ person: alice }));
    kb.rule(eligible({ person: P })).if(reviewable({ person: P }));
    kb.rule(eligible({ person: P })).if(seeded({ person: P }));
    kb.rule(reviewable({ person: P })).if(eligible({ person: P }));
    kb.rule(approved({ person: P })).if(and(eligible({ person: P }), reviewable({ person: P })));

    // The first conjunct encounters reviewable(alice) while eligible(alice)
    // is active, so that nested proof is unknown. The second conjunct must
    // reconsider it with eligible(alice) available and obtain a true proof.
    expect(query(kb, approved({ person: alice })).value).toBe("true");
  });

  it("keeps each rule's caller bindings when reusing a ground judgment", () => {
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const X = variable("X");
    const Y = variable("Y");
    const eligible = predicate("eligible", { person: Person });
    const approved = predicate("approved", { person: Person });
    kb.asserts(eligible({ person: alice }));
    kb.rule(approved({ person: X })).if(eligible({ person: X }));
    kb.rule(approved({ person: Y })).if(eligible({ person: Y }));

    const result = query(kb, approved({ person: alice }));
    expect(result.value).toBe("true");
    if (result.value !== "true") {
      throw new Error("Expected both approval rules to succeed");
    }
    expect(
      result.positive
        .filter((support) => support.source === "rule")
        .map((support) => support.body.bindings),
    ).toEqual([[[X, alice]], [[Y, alice]]]);
  });

  it("does not share ground judgments between distinct predicates with the same name", () => {
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const P = variable("P");
    const first = predicate("eligible", { person: Person });
    const second = predicate("eligible", { person: Person });
    const approved = predicate("approved", { person: Person });
    kb.asserts(first({ person: alice }));
    kb.rule(approved({ person: P })).if(and(first({ person: P }), second({ person: P })));

    expect(query(kb, approved({ person: alice })).value).toBe("unknown");
  });

  it.fails("derives through distinct predicates with the same display name", () => {
    // Arrange
    const alice = new Person("alice");
    const P = variable("P");
    const downstream = predicate("eligible", { person: Person });
    const upstream = predicate("eligible", { person: Person });
    const seeded = predicate("seeded", { person: Person });
    const rules = [
      {
        kind: "iff",
        head: { sign: "+", atom: upstream({ person: P }) },
        body: seeded({ person: P }),
      },
      {
        kind: "iff",
        head: { sign: "+", atom: downstream({ person: P }) },
        body: upstream({ person: P }),
      },
    ] as const;

    // Act
    const [result] = solveQueryAll(
      [{ sign: "+", atom: seeded({ person: alice }) }],
      rules,
      downstream({ person: alice }),
    );

    // Assert
    expect(result?.value).toBe("true");
  });

  it("does not throw when a variable query matches multiple grounded results", () => {
    const alice = new Person("alice");
    const bob = new Person("bob");
    const P = variable("P");
    const doctor = predicate("doctor", { person: Person });

    expect(() =>
      solveQueryAll(
        [
          { sign: "+", atom: doctor({ person: alice }) },
          { sign: "+", atom: doctor({ person: bob }) },
        ],
        [],
        doctor({ person: P }),
      ),
    ).not.toThrow();
  });

  it("does not throw when no result is found for a ground atom", () => {
    const alice = new Person("alice");
    const doctor = predicate("doctor", { person: Person });

    expect(() => solveQueryAll([], [], doctor({ person: alice }))).not.toThrow();
  });

  it("does not treat missing evidence as negation-as-failure", () => {
    const alice = new Person("alice");
    const P = variable("P");
    const passedMedicalSchool = predicate("passed_medical_school", { person: Person });
    const eatenApple = predicate("eaten_apple", { person: Person });
    const doctor = predicate("doctor", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: doctor({ person: P }) },
      body: and(passedMedicalSchool({ person: P }), not(eatenApple({ person: P }))),
    } as const;

    expect(
      solveQueryAll(
        [{ sign: "+", atom: passedMedicalSchool({ person: alice }) }],
        [rule],
        doctor({ person: alice }),
      ),
    ).toEqual([
      {
        value: "unknown",
        goal: { kind: "atom", atom: doctor({ person: alice }) },
        bindings: [],
        inconclusive: [
          {
            source: "rule",
            rule,
            body: {
              value: "unknown",
              goal: {
                kind: "and",
                goals: [
                  { kind: "atom", atom: passedMedicalSchool({ person: alice }) },
                  { kind: "not", goal: { kind: "atom", atom: eatenApple({ person: alice }) } },
                ],
              },
              bindings: [[P, alice]],
              inconclusive: [
                {
                  source: "subgoals",
                  judgments: [
                    {
                      value: "true",
                      goal: { kind: "atom", atom: passedMedicalSchool({ person: alice }) },
                      bindings: [[P, alice]],
                      positive: [
                        {
                          source: "evidence",
                          literals: [{ sign: "+", atom: passedMedicalSchool({ person: alice }) }],
                        },
                      ],
                    },
                    {
                      value: "unknown",
                      goal: {
                        kind: "not",
                        goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                      },
                      bindings: [[P, alice]],
                      inconclusive: [
                        {
                          source: "subgoals",
                          judgments: [
                            {
                              value: "unknown",
                              goal: { kind: "atom", atom: eatenApple({ person: alice }) },
                              bindings: [[P, alice]],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ]);
  });

  it("satisfies open-world not with explicit negative evidence", () => {
    const alice = new Person("alice");
    const P = variable("P");
    const eatenApple = predicate("eaten_apple", { person: Person });
    const doctor = predicate("doctor", { person: Person });
    const rule = {
      kind: "if",
      head: { sign: "+", atom: doctor({ person: P }) },
      body: not(eatenApple({ person: P })),
    } as const;

    const result = solveQueryAll(
      [{ sign: "-", atom: eatenApple({ person: alice }) }],
      [rule],
      doctor({ person: alice }),
    );

    expect(result[0]?.value).toBe("true");
  });

  it("treats missing closed-world evidence as negation-as-failure", () => {
    const alice = new Person("alice");
    const P = variable("P");
    const eatenApple = closedPredicate("eaten_apple", { person: Person });
    const doctor = predicate("doctor", { person: Person });
    const rule = {
      kind: "if",
      head: { sign: "+", atom: doctor({ person: P }) },
      body: not(eatenApple({ person: P })),
    } as const;

    const result = solveQueryAll([], [rule], doctor({ person: alice }));

    expect(result[0]?.value).toBe("true");
  });

  it("preserves closed-world conflicts through not", () => {
    const alice = new Person("alice");
    const P = variable("P");
    const eatenApple = closedPredicate("eaten_apple", { person: Person });
    const doctor = predicate("doctor", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: doctor({ person: P }) },
      body: not(eatenApple({ person: P })),
    } as const;

    const result = solveQueryAll(
      [
        { sign: "+", atom: eatenApple({ person: alice }) },
        { sign: "-", atom: eatenApple({ person: alice }) },
      ],
      [rule],
      doctor({ person: alice }),
    );

    expect(result[0]?.value).toBe("conflicted");
  });

  it("asserts when explicit undefined reaches primitive arithmetic", () => {
    const alice = new Person("alice");
    const Total = variable("Total");
    const eligible = predicate("eligible", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: eligible({ person: alice }) },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Exercises runtime rejection of an undefined arithmetic operand.
      body: letIn(Total, add(undefined as never, 1), gt(Total, 0)),
    } as const;

    expect(() => solveQueryAll([], [rule], eligible({ person: alice }))).toThrow(AssertionError);
  });

  it("asserts when an exists formula has non-variable quantifiers", () => {
    const alice = new Person("alice");
    const eligible = predicate("eligible", { person: Person });
    const reviewed = predicate("reviewed", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: eligible({ person: alice }) },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Exercises runtime rejection of a malformed exists variable.
      body: exists("not-a-variable" as never, reviewed({ person: alice })),
    } as const;

    expect(() => solveQueryAll([], [rule], eligible({ person: alice }))).toThrow(AssertionError);
  });

  it("asserts when a letIn binder is not a variable", () => {
    const alice = new Person("alice");
    const eligible = predicate("eligible", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: eligible({ person: alice }) },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Exercises runtime rejection of a malformed let target.
      body: letIn("not-a-variable" as never, 1, gt(1, 0)),
    } as const;

    expect(() => solveQueryAll([], [rule], eligible({ person: alice }))).toThrow(AssertionError);
  });

  it("asserts when a rule body has an unsupported non-formula shape", () => {
    const alice = new Person("alice");
    const eligible = predicate("eligible", { person: Person });
    const rule = {
      kind: "iff",
      head: { sign: "+", atom: eligible({ person: alice }) },
      body: "unsupported-body-shape",
    } as const;

    expect(() => solveQueryAll([], [rule], eligible({ person: alice }))).toThrow(AssertionError);
  });
});

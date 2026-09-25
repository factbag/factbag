import { describe, expect, it } from "vitest";
import { predicate } from "../dsl/predicate";
import { atomEquals, isAtomForPredicate, isAtomLike } from "./atom";

class Person {
  constructor(readonly id: string) {}
}

class Ship {
  constructor(readonly id: string) {}
}

describe("isAtomLike", () => {
  it("accepts atoms built from callable predicate declarations", () => {
    const known = predicate("known", { person: Person });

    expect(isAtomLike(known({ person: new Person("alice") }))).toBe(true);
  });

  it("rejects malformed atom-like objects", () => {
    expect(isAtomLike({ predicate: null, fields: {} })).toBe(false);
    expect(isAtomLike({ predicate: "known", fields: {} })).toBe(false);
    expect(isAtomLike({ predicate: { name: "known" }, fields: {} })).toBe(false);
    expect(
      isAtomLike({
        predicate: {
          name: "known",
          params: {},
          paramNames: [],
          world: "open",
        },
        fields: [],
      }),
    ).toBe(false);
  });
});

describe("atomEquals", () => {
  it("equates entities by type and id, not by object reference", () => {
    const known = predicate("known", { person: Person });

    expect(
      atomEquals(known({ person: new Person("alice") }), known({ person: new Person("alice") })),
    ).toBe(true);
  });

  it("keeps distinct ids distinct", () => {
    const known = predicate("known", { person: Person });

    expect(
      atomEquals(known({ person: new Person("alice") }), known({ person: new Person("bea") })),
    ).toBe(false);
  });

  it("never conflates entities of different types sharing an id", () => {
    const registered = predicate("registered", { subject: Person });
    const person = registered({ subject: new Person("mia") });
    const ship = {
      predicate: person.predicate,
      fields: { subject: new Ship("mia") },
    };

    expect(atomEquals(person, ship)).toBe(false);
  });

  it("equates dates by instant", () => {
    const filedOn = predicate("filed_on", { date: Date });

    expect(
      atomEquals(
        filedOn({ date: new Date("2026-03-12") }),
        filedOn({ date: new Date("2026-03-12") }),
      ),
    ).toBe(true);
    expect(
      atomEquals(
        filedOn({ date: new Date("2026-03-12") }),
        filedOn({ date: new Date("2026-03-13") }),
      ),
    ).toBe(false);
  });
});

describe("isAtomForPredicate", () => {
  it("matches an atom to its declaration by identity and field shape", () => {
    const registered = predicate("registered", { count: Number, subject: Person });
    const docked = predicate("docked", { subject: Ship });

    expect(
      isAtomForPredicate(registered({ count: 1, subject: new Person("mia") }), registered),
    ).toBe(true);
    // A different declaration is not a match, even sharing a field name.
    expect(isAtomForPredicate(docked({ subject: new Ship("mia") }), registered)).toBe(false);
    // The field shape must cover exactly the declared parameters.
    expect(isAtomForPredicate({ predicate: registered, fields: { count: 1 } }, registered)).toBe(
      false,
    );
  });
});

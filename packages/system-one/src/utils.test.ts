import { describe, expect, it } from "vitest";
import { enumeration, predicate } from "factbag/dsl";
import { encode, formatAtom } from "./utils";

class Person {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

describe("encode", () => {
  it("snapshots nested entities and dates without tagging ordinary records", () => {
    // Arrange
    const person = new Person("alice", "Alice");
    const date = new Date("2026-10-25T00:00:00Z");
    const value = { people: [person, person], period: { start: date }, active: true };

    // Act
    const encoded = encode(value);
    date.setUTCFullYear(2030);

    // Assert
    expect(encoded).toEqual({
      people: [
        { id: "alice", name: "Alice", type: "Person" },
        { id: "alice", name: "Alice", type: "Person" },
      ],
      period: { start: "2026-10-25T00:00:00.000Z" },
      active: true,
    });
    expect(person).not.toHaveProperty("type");
  });

  it("preserves JSON omission and null semantics", () => {
    // Arrange
    const value = { missing: undefined, items: [undefined, null], score: NaN };

    // Act / Assert
    expect(encode(value)).toEqual({ items: [null, null], score: null });
    expect(() => encode(undefined)).toThrow(TypeError);
  });

  it("rejects cyclic entities without recursively copying them forever", () => {
    // Arrange
    const person = { id: "alice", links: [] as unknown[] };
    person.links.push(person);

    // Act / Assert
    expect(() => encode(person)).toThrow(TypeError);
  });
});

describe("formatAtom", () => {
  it("labels entities and dates in declared field order without exposing identity keys", () => {
    // Arrange
    const day = new Date("2026-10-25T00:00:00Z");
    const attended = predicate("attended", { person: Person, day: enumeration(day) });
    const atom = attended({ day, person: new Person("alice", "Alice") });

    // Act / Assert
    expect(formatAtom(atom)).toBe("attended(alice, 2026-10-25T00:00:00.000Z)");
  });
});

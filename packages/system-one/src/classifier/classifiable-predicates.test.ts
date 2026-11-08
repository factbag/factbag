import { describe, expect, it } from "vitest";
import { enumeration, predicate } from "factbag/dsl";
import { KnowledgeBase, guard } from "factbag/kb";
import { classifiablePredicates } from "./classifiable-predicates";

class Person {
  constructor(readonly id: string) {}
}

describe("classifiablePredicates", () => {
  /** Whether a field has values yet is not an eligibility error. */
  it("starts each field with the values known before reading a passage", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const alice = new Person("Alice");
    kb.entities.add(alice);
    const paid = predicate(
      "paid",
      {
        payer: Person,
        memo: String,
        amount: Number,
        on: Date,
        cash: Boolean,
        kind: enumeration("fee"),
      },
      { description: "The payer paid the amount on the day." },
    );

    // Act
    const [eligible] = classifiablePredicates(guard(kb).permit("assert", paid));

    // Assert
    expect(eligible?.roles).toEqual({
      payer: [alice],
      memo: [],
      amount: [],
      on: [],
      cash: [false, true],
      kind: ["fee"],
    });
    expect(eligible?.roles["payer"]?.[0]).toBe(alice);
  });

  it("starts an entity field with no registered entities empty", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const met = predicate("met", { who: Person }, { description: "The person was met." });

    // Act
    const [eligible] = classifiablePredicates(guard(kb).permit("assert", met));

    // Assert
    expect(eligible?.roles).toEqual({ who: [] });
  });
});

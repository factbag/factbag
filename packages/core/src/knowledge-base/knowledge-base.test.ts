import { describe, expect, it } from "vitest";
import { predicate, variable } from "../dsl";
import { ExclusiveDefinitionProgrammerError } from "../exceptions/programmer-errors";
import { query } from "../query";
import { KnowledgeBase } from "./knowledge-base";

class Person {
  constructor(readonly id: string) {}
}

const P = variable("P");

describe("KnowledgeBase", () => {
  for (const operation of ["asserts", "denies"] as const) {
    for (const state of ["empty", "populated"] as const) {
      it.fails(`${operation} rejects variable-bearing evidence without changing the ${state} KB`, () => {
        // Arrange
        const kb = new KnowledgeBase();
        const status = predicate("status", { value: String });
        const existing = state === "populated" ? [kb.asserts(status({ value: "active" }))] : [];
        const pattern = status({ value: variable("Value") });

        // Act
        const admit = () => kb[operation](pattern);

        // Assert
        expect(admit).toThrow();
        expect(kb.literals()).toEqual(existing);
        if (state === "populated") {
          expect(query(kb, status({ value: "active" })).value).toBe("true");
        }
      });
    }

    it(`${operation} accepts grounded evidence and preserves its sign`, () => {
      // Arrange
      const kb = new KnowledgeBase();
      const status = predicate("status", { value: String });
      const atom = status({ value: "active" });

      // Act
      const literal = kb[operation](atom);

      // Assert
      expect(kb.literals()).toEqual([{ sign: operation === "asserts" ? "+" : "-", atom }]);
      expect(kb.literals()[0]).toBe(literal);
      expect(query(kb, atom).value).toBe(operation === "asserts" ? "true" : "false");
    });
  }

  it("throws immediately when an if rule is added after an iff definition", () => {
    const kb = new KnowledgeBase();
    const eligible = predicate("eligible_after_iff", { person: Person });
    const citizen = predicate("citizen_after_iff", { person: Person });
    const veteran = predicate("veteran_after_iff", { person: Person });

    kb.rule(eligible({ person: P })).iff(citizen({ person: P }));

    expect(() => kb.rule(eligible({ person: P })).if(veteran({ person: P }))).toThrow(
      ExclusiveDefinitionProgrammerError,
    );
    expect(kb.rules()).toHaveLength(1);
  });

  it("throws immediately when an iff definition is added after an if rule", () => {
    const kb = new KnowledgeBase();
    const eligible = predicate("eligible_before_iff", { person: Person });
    const citizen = predicate("citizen_before_iff", { person: Person });
    const veteran = predicate("veteran_before_iff", { person: Person });

    kb.rule(eligible({ person: P })).if(veteran({ person: P }));

    expect(() => kb.rule(eligible({ person: P })).iff(citizen({ person: P }))).toThrow(
      ExclusiveDefinitionProgrammerError,
    );
    expect(kb.rules()).toHaveLength(1);
  });

  it("throws immediately when a second iff definition is added", () => {
    const kb = new KnowledgeBase();
    const eligible = predicate("eligible_double_iff", { person: Person });
    const citizen = predicate("citizen_double_iff", { person: Person });
    const resident = predicate("resident_double_iff", { person: Person });

    kb.rule(eligible({ person: P })).iff(citizen({ person: P }));

    expect(() => kb.rule(eligible({ person: P })).iff(resident({ person: P }))).toThrow(
      ExclusiveDefinitionProgrammerError,
    );
    expect(kb.rules()).toHaveLength(1);
  });

  it("allows multiple if rules for the same predicate", () => {
    const kb = new KnowledgeBase();
    const eligible = predicate("eligible_multiple_if", { person: Person });
    const citizen = predicate("citizen_multiple_if", { person: Person });
    const veteran = predicate("veteran_multiple_if", { person: Person });

    kb.rule(eligible({ person: P })).if(citizen({ person: P }));
    kb.rule(eligible({ person: P })).if(veteran({ person: P }));

    expect(kb.rules()).toHaveLength(2);
  });
});

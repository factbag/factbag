import { describe, expect, it } from "vitest";
import { predicate, variable } from "../dsl";
import { ExclusiveDefinitionProgrammerError } from "../exceptions/programmer-errors";
import { KnowledgeBase } from "./knowledge-base";

class Person {
  constructor(readonly id: string) {}
}

const P = variable("P");

describe("KnowledgeBase", () => {
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

  it.fails("rejects distinct predicate declarations with the same display name", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const first = predicate("eligible", { person: Person });
    const second = predicate("eligible", { person: Person });
    kb.asserts(first({ person: alice }));

    // Act
    const addDuplicate = () => kb.asserts(second({ person: alice }));

    // Assert
    expect(addDuplicate).toThrow(/Predicate name "eligible" is already registered/u);
    expect(kb.literals()).toHaveLength(1);
  });
});

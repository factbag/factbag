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
  describe("accepted evidence snapshots", () => {
    for (const operation of ["asserts", "denies"] as const) {
      it(`${operation} snapshots caller-owned fields across forks`, () => {
        // Arrange
        const kb = new KnowledgeBase();
        const status = predicate("status", { value: String });
        const fields = { value: "active" };
        kb[operation](status(fields));
        const fork = kb.fork();

        // Act
        fields.value = "inactive";

        // Assert
        for (const store of [kb, fork]) {
          expect(query(store, status({ value: "active" })).value).toBe(
            operation === "asserts" ? "true" : "false",
          );
          expect(query(store, status({ value: "inactive" })).value).toBe("unknown");
        }
      });

      it(`${operation} snapshots provenance and nested annotations across forks`, () => {
        // Arrange
        const kb = new KnowledgeBase();
        const status = predicate("status", { value: String });
        const metadata = {
          source: "original",
          scores: { probability: 0.9 },
          annotations: { review: { status: "accepted" } },
        };
        const literal = kb[operation](status({ value: "active" }), metadata);
        const fork = kb.fork();

        // Act
        metadata.source = "replacement";
        metadata.scores.probability = 0.1;
        metadata.annotations.review.status = "changed";

        // Assert
        for (const stored of [literal, ...kb.literals(), ...fork.literals()]) {
          expect(stored.metadata).toEqual({
            source: "original",
            scores: { probability: 0.9 },
            annotations: { review: { status: "accepted" } },
          });
        }
      });

      it(`${operation} snapshots caller-owned dates across forks`, () => {
        // Arrange
        const kb = new KnowledgeBase();
        const recorded = predicate("recorded", { date: Date });
        const date = new Date("2026-01-01T00:00:00Z");
        kb[operation](recorded({ date }));
        const fork = kb.fork();

        // Act
        date.setUTCFullYear(2027);

        // Assert
        for (const store of [kb, fork]) {
          expect(query(store, recorded({ date: new Date("2026-01-01T00:00:00Z") })).value).toBe(
            operation === "asserts" ? "true" : "false",
          );
          expect(query(store, recorded({ date: new Date("2027-01-01T00:00:00Z") })).value).toBe(
            "unknown",
          );
        }
      });

      it(`${operation} retains the sign, provenance, and domain entity identity without mutation`, () => {
        // Arrange
        const kb = new KnowledgeBase();
        const alice = new Person("alice");
        const status = predicate("status", { person: Person, value: String });
        const atom = status({ person: alice, value: "active" });

        // Act
        const literal = kb[operation](atom, { source: "original" });
        const fork = kb.fork();

        // Assert
        expect(literal).toEqual({
          sign: operation === "asserts" ? "+" : "-",
          atom,
          metadata: { source: "original" },
        });
        for (const store of [kb, fork]) {
          expect(store.literals()).toEqual([literal]);
          expect(store.literals()[0]?.atom.fields["person"]).toBe(alice);
          expect(query(store, atom).value).toBe(operation === "asserts" ? "true" : "false");
        }
      });
    }
  });

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

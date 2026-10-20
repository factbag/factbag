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
      it.fails(`${operation} snapshots caller-owned fields across forks`, () => {
        const kb = new KnowledgeBase();
        const status = predicate("status", { value: String });
        const fields = { value: "active" };
        kb[operation](status(fields));
        const fork = kb.fork();

        fields.value = "inactive";

        for (const store of [kb, fork]) {
          expect(query(store, status({ value: "active" })).value).toBe(
            operation === "asserts" ? "true" : "false",
          );
          expect(query(store, status({ value: "inactive" })).value).toBe("unknown");
        }
      });

      it.fails(`${operation} snapshots provenance and nested annotations`, () => {
        const kb = new KnowledgeBase();
        const status = predicate("status", { value: String });
        const metadata = {
          source: "original",
          scores: { probability: 0.9 },
          annotations: { review: { status: "accepted" } },
        };
        const literal = kb[operation](status({ value: "active" }), metadata);

        metadata.source = "replacement";
        metadata.scores.probability = 0.1;
        metadata.annotations.review.status = "changed";

        expect(literal.metadata).toEqual({
          source: "original",
          scores: { probability: 0.9 },
          annotations: { review: { status: "accepted" } },
        });
      });

      it.fails(`${operation} snapshots caller-owned dates`, () => {
        const kb = new KnowledgeBase();
        const recorded = predicate("recorded", { date: Date });
        const date = new Date("2026-01-01T00:00:00Z");
        kb[operation](recorded({ date }));

        date.setUTCFullYear(2027);

        expect(query(kb, recorded({ date: new Date("2026-01-01T00:00:00Z") })).value).toBe(
          operation === "asserts" ? "true" : "false",
        );
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

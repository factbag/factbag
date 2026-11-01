import { describe, expect, it } from "vitest";
import { enumeration, predicate } from "@factbag/core/dsl";
import type { Entity, PredicateDeclaration, Scalar } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { resolveSettings } from "../settings";
import { relevanceModel } from "../testing/fake-model";
import type { Config } from "../types/config";
import { classifiablePredicates } from "./classifiable-predicates";
import { filterSymbols } from "./filter-symbols";

class Person {
  constructor(readonly id: string) {}
}
class Company {
  constructor(readonly id: string) {}
}

const people = ["p0", "p1", "p2", "p3", "p4"].map((id) => new Person(id));
const married = predicate(
  "married",
  { spouse: Person, partner: Person },
  { description: "The spouse is married to the partner." },
);
const active = predicate("active", { value: Boolean }, { description: "The status is active." });

/** Shortlist symbols for `predicates`, scoring each symbol with `score`. */
async function shortlist({
  predicates,
  score,
  config,
  entities = people,
}: {
  predicates: readonly PredicateDeclaration[];
  score: (value: Scalar | Entity) => number;
  config: Config;
  entities?: readonly Entity[];
}): Promise<readonly (Scalar | Entity)[]> {
  const kb = new KnowledgeBase();
  kb.entities.add(...entities);
  const corpus = new Corpus();
  const text = "p0 married p1.";
  corpus.add({ documentId: "record", text });
  return await filterSymbols({
    chunk: corpus.slice({ documentId: "record" }, { start: 0, end: text.length }),
    predicates: classifiablePredicates(guard(kb).permit("assert", ...predicates)),
    config: {
      ...resolveSettings(config),
      model: relevanceModel((subject) => ("value" in subject ? score(subject.value) : 0)),
    },
  });
}

describe("filterSymbols", () => {
  it("keeps every symbol when routing is off, however the model would score them", async () => {
    // Arrange
    const config = { routing: false, candidateProductCutoff: 0 };

    // Act
    const symbols = await shortlist({ predicates: [married], score: () => 0, config });

    // Assert
    expect(symbols).toEqual(people);
  });

  it("keeps symbols scored at or above the threshold", async () => {
    // Arrange
    const scores: Readonly<Record<string, number>> = { p0: 0.3, p1: 0.29, p2: 1 };
    const score = (value: Scalar | Entity) =>
      value instanceof Person ? (scores[value.id] ?? 0) : 0;

    // Act
    const symbols = await shortlist({
      predicates: [married],
      score,
      config: { routing: true, symbolThreshold: 0.3, candidateProductCutoff: 0 },
    });

    // Assert
    expect(symbols).toEqual([new Person("p0"), new Person("p2")]);
  });

  /** Filtering costs a request, so a predicate small enough to enumerate skips it. */
  it.each([
    { cutoff: 25, expected: people },
    { cutoff: 24, expected: [] },
  ])(
    "filters only when a predicate's 25 candidates exceed cutoff $cutoff",
    async ({ cutoff, expected }) => {
      // Arrange
      const config = { routing: true, candidateProductCutoff: cutoff };

      // Act
      const symbols = await shortlist({ predicates: [married], score: () => 0, config });

      // Assert
      expect(symbols).toEqual(expected);
    },
  );

  it("never filters a predicate whose roles are all Boolean", async () => {
    // Arrange
    const config = { routing: true, candidateProductCutoff: 0 };

    // Act
    const symbols = await shortlist({ predicates: [active], score: () => 0, config });

    // Assert
    expect(symbols).toEqual(expect.arrayContaining([false, true]));
    expect(symbols).toHaveLength(2);
  });

  /** A passage never mentions true or false, so dropping them would lose facts like f(x, false). */
  it("keeps both Boolean values while filtering other roles of the same predicate", async () => {
    // Arrange
    const paid = predicate(
      "paid",
      { amount: enumeration(10, 20), taxable: Boolean },
      { description: "The amount was paid with this taxable status." },
    );

    // Act
    const symbols = await shortlist({
      predicates: [paid],
      score: (value) => (value === 10 ? 1 : 0),
      config: { routing: true, candidateProductCutoff: 0 },
    });

    // Assert
    expect(symbols).toEqual(expect.arrayContaining([10, false, true]));
    expect(symbols).toHaveLength(3);
  });

  it("pools one shortlist across predicates and roles", async () => {
    // Arrange
    const employs = predicate(
      "employs",
      { employer: Company, employee: Person },
      { description: "The employer employs the employee." },
    );
    const acme = new Company("acme");

    // Act
    const symbols = await shortlist({
      predicates: [married, employs],
      entities: [...people, acme],
      score: (value) => (value === acme || (value instanceof Person && value.id === "p1") ? 1 : 0),
      config: { routing: true, candidateProductCutoff: 0 },
    });

    // Assert
    expect(symbols).toEqual(expect.arrayContaining([new Person("p1"), acme]));
    expect(symbols).toHaveLength(2);
  });

  /** Symbols are told apart by type and kind, not by their printed form. */
  it("judges same-looking symbols of different types separately", async () => {
    // Arrange
    const instant = "2026-10-25T00:00:00.000Z";
    const typed = predicate(
      "typed",
      {
        person: Person,
        company: Company,
        number: enumeration(10),
        text: enumeration("10", instant),
        date: enumeration(new Date(instant)),
      },
      { description: "These typed values are recorded together." },
    );
    const person = new Person("p0");
    const company = new Company("p0");

    // Act
    const symbols = await shortlist({
      predicates: [typed],
      entities: [person, company],
      // Only the later-seen look-alikes are relevant, so merging them with earlier ones would fail.
      score: (value) => (value === company || value === "10" || value instanceof Date ? 1 : 0),
      config: { routing: true, candidateProductCutoff: 0 },
    });

    // Assert
    expect(symbols).toEqual(expect.arrayContaining([company, "10", new Date(instant)]));
    expect(symbols).toHaveLength(3);
  });
});

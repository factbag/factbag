import { predicate } from "@factbag/core/dsl";
import type { PredicateDeclaration } from "@factbag/core/dsl";
import { Corpus, chunkers } from "@factbag/corpus";
import type { Chunk } from "@factbag/corpus";
import { describe, expect, it, vi } from "vitest";
import { createChunkSymbolExtractor } from "./index";
import type { SymbolExtractorConfig } from "./index";

class Person {
  constructor(readonly id: string) {}
}
class Location {
  constructor(readonly id: string) {}
}
const observation = predicate("observation", {
  who: Person,
  where: Location,
  amount: Number,
  year: Number,
  day: Date,
  label: String,
});
const person = (name: string): Person => new Person(name);

function chunks(...texts: readonly string[]): readonly Chunk[] {
  const corpus = new Corpus();
  return texts.flatMap((text, index) => {
    const document = corpus.add({ documentId: String(index), text });
    return [...corpus.chunk(document, chunkers.recursive({ size: 8_000 }))];
  });
}

function request(
  ...fields: readonly string[]
): ReadonlyMap<PredicateDeclaration, readonly string[]> {
  return new Map([[observation, fields]]);
}

describe("createChunkSymbolExtractor", () => {
  it("offers candidates by field type, not field name", async () => {
    // Arrange
    const extractor = createChunkSymbolExtractor(
      chunks("Alice paid $2,000.50 on Feb 3, 1992 for 1992–93."),
      { entities: [[Person, person]] },
    );
    // Act
    const answer = await extractor.query(request("who", "amount", "year", "day", "label"));
    // Assert
    const numbers = [3, 93, 1992, 1993, 2000.5];
    expect(answer.get(observation)).toEqual({
      who: [new Person("Alice")],
      amount: numbers,
      year: numbers,
      day: [new Date("1992-02-03T00:00:00Z")],
      label: ["Alice"],
    });
  });

  it("works without configuration, leaving entity fields to Jev's registered entities", async () => {
    // Arrange
    const extractor = createChunkSymbolExtractor(chunks("Alice in 1992"));
    // Act
    const answer = await extractor.query(request("who", "year", "label"));
    // Assert
    expect(answer.get(observation)).toEqual({ who: [], year: [1992], label: ["Alice"] });
  });

  it("offers aliases to fields of their value's type, keeps ambiguity, and masks names", async () => {
    // Arrange
    const state = new Location("state");
    const city = new Location("city");
    const extractor = createChunkSymbolExtractor(chunks("Alice NY Bob"), {
      entities: [[Person, person]],
      aliases: [
        { text: "NY", value: state },
        { text: "NY", value: city },
        { text: "NY", value: "New York" },
      ],
    });
    // Act
    const answer = await extractor.query(request("who", "where", "label"));
    // Assert
    expect(answer.get(observation)).toEqual({
      who: [new Person("Alice"), new Person("Bob")],
      where: [state, city],
      label: ["New York", "Alice", "Bob"],
    });
  });

  it("creates entities only when queried and reuses them", async () => {
    // Arrange
    const create = vi.fn(person);
    const extractor = createChunkSymbolExtractor(chunks("Alice in 1992"), {
      entities: [[Person, create]],
    });
    // Act / Assert
    await extractor.query(request("year"));
    expect(create).not.toHaveBeenCalled();
    const first = await extractor.query(request("who"));
    const second = await extractor.query(request("who"));
    expect(create).toHaveBeenCalledTimes(1);
    expect(second.get(observation)?.["who"]?.[0]).toBe(first.get(observation)?.["who"]?.[0]);
  });

  it("keeps results independent of query order", async () => {
    // Arrange
    const config: SymbolExtractorConfig = {
      entities: [[Person, person]],
      aliases: [{ text: "NY", value: new Location("ny") }],
    };
    const text = chunks("Alice NY Bob in 1992–93.");
    const first = createChunkSymbolExtractor(text, config);
    const second = createChunkSymbolExtractor(text, config);
    // Act
    await first.query(request("who"));
    await second.query(request("year", "where"));
    const all = request("who", "where", "year");
    // Assert
    expect(await first.query(all)).toEqual(await second.query(all));
  });

  it("returns fresh dates and deduplicates across chunks", async () => {
    // Arrange
    const extractor = createChunkSymbolExtractor(
      chunks("Feb 3, 1992", "1992-02-03; 2023-02-29; November 25th"),
    );
    // Act
    const first = await extractor.query(request("day"));
    const date = first.get(observation)?.["day"]?.[0];
    if (date instanceof Date) {
      date.setFullYear(2000);
    }
    const second = await extractor.query(request("day"));
    // Assert
    expect(second.get(observation)).toEqual({ day: [new Date("1992-02-03T00:00:00Z")] });
  });

  it("snapshots configuration at construction", async () => {
    // Arrange
    const aliases = [{ text: "NY", value: "New York" }];
    const extractor = createChunkSymbolExtractor(chunks("NY"), { aliases });
    // Act
    aliases.splice(0, 1);
    const answer = await extractor.query(request("label"));
    // Assert
    expect(answer.get(observation)).toEqual({ label: ["New York"] });
  });

  it("rejects invalid configuration at construction", () => {
    // Arrange
    const text = chunks("Alice");
    const empty: SymbolExtractorConfig = { aliases: [{ text: "", value: "x" }] };
    const repeated: SymbolExtractorConfig = {
      entities: [
        [Person, person],
        [Person, person],
      ],
    };
    // @ts-expect-error Scalar types cannot have entity factories.
    const scalar: SymbolExtractorConfig = { entities: [[String, String]] };
    // Act / Assert
    expect(() => createChunkSymbolExtractor(text, empty)).toThrow("Invalid alias");
    expect(() => createChunkSymbolExtractor(text, repeated)).toThrow("Invalid entity factory");
    expect(() => createChunkSymbolExtractor(text, scalar)).toThrow("Invalid entity factory");
  });

  it("answers empty requests and unknown fields", async () => {
    // Arrange
    const extractor = createChunkSymbolExtractor(chunks("1992 $500 Alice"));
    // Act / Assert
    expect(await extractor.query(new Map())).toEqual(new Map());
    expect(await extractor.query(request("absent"))).toEqual(
      new Map([[observation, { absent: [] }]]),
    );
  });
});

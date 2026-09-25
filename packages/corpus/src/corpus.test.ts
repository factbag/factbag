import { describe, expect, it, vi } from "vitest";
import { Corpus, chunkers } from "./index";
import type { Chunk, Chunker } from "./index";

function first(chunks: Iterable<Chunk>): Chunk {
  for (const chunk of chunks) {
    return chunk;
  }
  throw new Error("Expected a chunk");
}

describe("documents", () => {
  it("is idempotent regardless of metadata key order and keeps separate document identities", () => {
    const corpus = new Corpus();
    const a = corpus.add({ documentId: "a", text: "Text", metadata: { b: 2, a: 1 } });
    const again = corpus.add({ documentId: "a", text: "Text", metadata: { a: 1, b: 2 } });
    const b = corpus.add({ documentId: "b", text: "Text", metadata: { a: 1, b: 2 } });
    expect(again).toBe(a);
    expect(b).not.toBe(a);
    expect(corpus.documents()).toEqual([a, b]);
    expect(corpus.document("a")).toBe(a);
  });

  it("rejects different content for an existing document, keeping evidence anchored", () => {
    const corpus = new Corpus();
    const original = corpus.add({ documentId: "a", text: "Alice is licensed." });
    const chunk = first(corpus.chunk(original, chunkers.recursive({ size: 100 })));
    expect(() => corpus.add({ documentId: "a", text: "Alice is not licensed." })).toThrow(
      "different content",
    );
    expect(() => corpus.add({ documentId: "a", text: original.text, title: "Correction" })).toThrow(
      "different content",
    );
    expect(corpus.document("a")).toBe(original);
    expect(corpus.resolve(chunk.id)).toEqual({ chunk, document: original });
  });

  it("snapshots the metadata record while preserving caller-owned native values", () => {
    class Person {
      name = "Alice";
    }
    const person = new Person();
    const predicate = () => person;
    const corpus = new Corpus<{ person: Person; predicate: typeof predicate; tags: string[] }>();
    const input = {
      documentId: "a",
      text: "Text",
      source: { uri: "file:///a" },
      metadata: { person, predicate, tags: ["original"] },
    };
    const document = corpus.add(input);
    input.metadata.person = new Person();
    person.name = "Bob";
    input.source.uri = "file:///b";
    expect(document.metadata.person).toBe(person);
    expect(document.metadata.predicate).toBe(predicate);
    expect(document.metadata.person?.name).toBe("Bob");
    expect(document.source?.uri).toBe("file:///a");
    expect(Object.isFrozen(person)).toBe(false);
    expect(Object.isFrozen(document.metadata)).toBe(true);
    const view = corpus.filter(({ metadata }) => metadata.person === person);
    expect(view.documents()).toEqual([document]);
    expect(view.resolve("a#0-4").document.metadata.predicate).toBe(predicate);
    expect(Object.isFrozen(document)).toBe(true);
  });

  it("validates a batch, including content conflicts, before inserting anything", () => {
    const corpus = new Corpus();
    expect(() =>
      corpus.add([
        { documentId: "valid", text: "Text" },
        { documentId: " ", text: "Invalid" },
      ]),
    ).toThrow("documentId");
    expect(() =>
      corpus.add([
        { documentId: "valid", text: "Text" },
        { documentId: "valid", text: "Changed" },
      ]),
    ).toThrow("different content");
    expect(corpus.documents()).toEqual([]);
  });

  it("compares native metadata values by identity instead of JSON serialization", () => {
    const corpus = new Corpus();
    const fn = () => "same";
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    const input = { documentId: "native", text: "Text", metadata: { fn, cycle, n: 1n } };
    const document = corpus.add(input);
    expect(corpus.add({ ...input, metadata: { n: 1n, cycle, fn } })).toBe(document);
    expect(() =>
      corpus.add({ ...input, metadata: { ...input.metadata, fn: () => "same" } }),
    ).toThrow("different content");
  });
});

describe("source ranges", () => {
  it("shares IDs for identical ranges, whichever call produced them", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "a", text: "0123456789abcdefghij" });
    const chunked = first(corpus.chunk(document, chunkers.recursive({ size: 3 })));
    const sliced = corpus.slice(document, { start: 0, end: 3 });
    expect(chunked).toEqual(sliced);
    expect(sliced.text).toBe("012");
    expect(corpus.resolve(sliced.id).document).toBe(document);
  });

  it("validates ranges as consumed and keeps earlier chunks resolvable if a later range fails", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "a", text: "abcd" });
    const chunker: Chunker = {
      name: "invalid",
      split: () => [
        { start: 0, end: 2 },
        { start: 2, end: 8 },
      ],
    };
    const chunks = corpus.chunk(document, chunker)[Symbol.iterator]();
    const initial = chunks.next();
    if (initial.done === true) {
      throw new Error("Expected the first valid chunk");
    }
    expect(initial.value.text).toBe("ab");
    expect(() => chunks.next()).toThrow("Range");
    expect(corpus.resolve(initial.value.id).chunk).toEqual(initial.value);
    expect(() => [
      ...corpus.chunk(document, {
        name: "reversed",
        split: () => [
          { start: 2, end: 4 },
          { start: 0, end: 2 },
        ],
      }),
    ]).toThrow("source order");
  });

  it("starts splitting on demand and closes the source iterator when consumption stops", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "a", text: "first | second" });
    const visited = vi.fn();
    const closed = vi.fn();
    const splitter = vi.fn(function* () {
      try {
        visited();
        yield { start: 0, end: 5 };
        visited();
        yield { start: 8, end: 14 };
      } finally {
        closed();
      }
    });
    const chunks = corpus.chunk(document, {
      name: "custom",
      split: splitter,
    });
    expect(splitter).not.toHaveBeenCalled();
    const consumed = first(chunks);
    expect(consumed.text).toBe("first");
    expect(visited).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(corpus.resolve(consumed.id).chunk).toEqual(consumed);
  });

  it("rejects empty, fractional, out-of-range and broken-grapheme selections", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "unicode", text: "A👨‍👩‍👧‍👦e\u0301Z" });
    for (const range of [
      { start: 0, end: 0 },
      { start: -1, end: 1 },
      { start: 0.5, end: 1 },
      { start: 0, end: 100 },
      { start: 1, end: 2 },
      { start: 12, end: 13 },
    ]) {
      expect(() => corpus.slice(document, range)).toThrow("Range");
    }
  });

  it("fails clearly on missing references", () => {
    const corpus = new Corpus();
    corpus.add({ documentId: "a", text: "A" });
    expect(() => corpus.resolve("missing")).toThrow("Invalid chunk ID");
    expect(() => corpus.document("missing")).toThrow("Unknown document");
    expect(() => corpus.slice({ documentId: "missing" }, { start: 0, end: 1 })).toThrow(
      "Unknown document",
    );
  });
});

describe("chunk IDs", () => {
  it("encode the document and range, so any valid pointer resolves without prior chunking", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "a", text: "Alice is licensed." });
    expect(corpus.slice(document, { start: 0, end: 5 }).id).toBe("a#0-5");
    expect(corpus.resolve("a#9-17")).toEqual({
      chunk: { id: "a#9-17", documentId: "a", range: { start: 9, end: 17 }, text: "licensed" },
      document,
    });
  });

  it("round-trip document IDs containing separators and non-ASCII characters", () => {
    const corpus = new Corpus();
    const document = corpus.add({ documentId: "memo#2-draft/é", text: "Text" });
    const chunk = corpus.slice(document, { start: 0, end: 4 });
    expect(chunk.id).toBe("memo%232-draft%2F%C3%A9#0-4");
    expect(corpus.resolve(chunk.id)).toEqual({ chunk, document });
  });

  it("reject malformed, non-canonical and out-of-range pointers", () => {
    const corpus = new Corpus();
    corpus.add({ documentId: "a", text: "A👨‍👩‍👧‍👦" });
    for (const id of ["a", "a#1", "a#1-x", "#0-1", "a#01-2", "%zz#0-1", "%61#0-1", "a#0-1#0-1"]) {
      expect(() => corpus.resolve(id)).toThrow("Invalid chunk ID");
    }
    expect(() => corpus.resolve("missing#0-1")).toThrow("Unknown document");
    expect(() => corpus.resolve("a#0-100")).toThrow("Range");
    expect(() => corpus.resolve("a#0-2")).toThrow("Range");
  });
});

describe("filtered views", () => {
  function tagged() {
    const corpus = new Corpus();
    const [prose, record] = corpus.add([
      { documentId: "memo", text: "Alice is licensed." },
      { documentId: "record", text: '{"licensed":true}', metadata: { kind: "structured" } },
    ]);
    if (prose === undefined || record === undefined) {
      throw new Error("Missing documents");
    }
    const view = corpus.filter((document) => document.metadata["kind"] !== "structured");
    return { corpus, view, prose, record };
  }

  it("lists and reads only matching documents while the base corpus keeps all of them", () => {
    const { corpus, view, prose, record } = tagged();
    expect(view.documents()).toEqual([prose]);
    expect(corpus.documents()).toEqual([prose, record]);
    expect(view.document("memo")).toBe(prose);
    expect(() => view.document("record")).toThrow("excluded");
    expect(() => view.slice(record, { start: 0, end: 1 })).toThrow("excluded");
    expect(() => view.chunk(record, chunkers.recursive({ size: 10 }))).toThrow("excluded");
  });

  it("evaluates the filter on read, including documents added later through any handle", () => {
    const { corpus, view } = tagged();
    const later = corpus.add({ documentId: "later", text: "Bob is licensed." });
    const viaView = view.add({
      documentId: "hidden",
      text: "{}",
      metadata: { kind: "structured" },
    });
    expect(view.documents().map(({ documentId }) => documentId)).toEqual(["memo", "later"]);
    expect(view.document("later")).toBe(later);
    expect(corpus.document("hidden")).toBe(viaView);
    expect(() => view.add({ documentId: "memo", text: "Changed." })).toThrow("different content");
  });

  it("composes filters, and evidence resolves from any handle", () => {
    const { corpus, view, prose } = tagged();
    const memoOnly = view.filter((document) => document.documentId === "memo");
    corpus.add({ documentId: "other", text: "Carol is licensed." });
    expect(memoOnly.documents()).toEqual([prose]);
    const chunk = first(memoOnly.chunk(prose, chunkers.recursive({ size: 100 })));
    expect(corpus.resolve(chunk.id)).toEqual({ chunk, document: prose });
    const record = corpus.slice(corpus.document("record"), { start: 0, end: 1 });
    expect(memoOnly.resolve(record.id).document.documentId).toBe("record");
  });
});

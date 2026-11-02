import { describe, expect, it, vi } from "vitest";
import { enumeration, predicate } from "@factbag/core/dsl";
import type { Entity, PredicateDeclaration, Scalar } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import type { Chunk } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import type { GuardedKB } from "@factbag/guards";
import { UnsupportedPredicateError } from "@factbag/core/exceptions";
import type { SystemOneRequest } from "../provider";
import { classifier, mockClient } from "../testing/provider";
import type { Job } from "../types/run";
import type { ChunkSymbolExtractor, SymbolAnswer } from "./types";

const admission = { minimumProbability: 0.3, ambiguityMargin: 0.05 };
class Person {
  constructor(readonly id: string) {}
}
class Company {
  constructor(readonly id: string) {}
}

const valid = predicate("valid", {}, { description: "The record is valid." });

function answer(ASSERT = 0.95, DENY = 0.03, IRRELEVANT = 0.02) {
  return {
    type: "choice" as const,
    choice: "ASSERT" as const,
    confidence: 0.8,
    probabilities: { ASSERT, DENY, IRRELEVANT },
  };
}

/** A model that answers every classification with `result` and finds everything relevant. */
function clientWith(result: unknown = answer()) {
  return mockClient(({ questions }) => ({
    model: "test",
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        question.type === "noul" ? { type: "noul", noul: 1 } : result,
      ]),
    ),
  }));
}

function setup() {
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  corpus.add({ documentId: "first", text: "This record is valid." });
  return { kb, corpus, access: guard(kb).permit("assert", valid).permit("deny", valid) };
}

function nextJob(run: Iterator<Job>): Job {
  const next = run.next();
  if (next.done === true) {
    throw new Error("Expected a classification job");
  }
  return next.value;
}

/** The document each written literal came from, in write order. */
function sourceDocuments(run: { kb: KnowledgeBase }, corpus: Corpus): string[] {
  return run.kb
    .literals()
    .map(({ metadata }) => corpus.resolve(metadata?.source ?? "").document.documentId);
}

describe("classifier construction", () => {
  /** Hand-built enum domains bypass enumeration()'s checks, so the classifier repeats them. */
  it.each([
    ...[
      { type: String, sample: "Harbor" },
      { type: Number, sample: 1 },
      { type: Date, sample: new Date(0) },
    ].map(({ type, sample }) => ({
      reason: `an open-ended ${type.name} field, even with recorded values`,
      field: "value" as string | undefined,
      declare: (kb: KnowledgeBase) => {
        const fact = predicate("open_ended", { value: type }, { description: "A value." });
        kb.asserts(fact({ value: sample }));
        return fact;
      },
    })),
    ...[
      { name: "an empty", values: [] },
      { name: "a mixed-kind", values: [1, "1"] },
      { name: "a NaN", values: [Number.NaN] },
      { name: "an invalid-date", values: [new Date(Number.NaN)] },
      { name: "a duplicate-number", values: [10, 10] },
      { name: "a duplicate-instant", values: [new Date(0), new Date(0)] },
    ].map(({ name, values }) => ({
      reason: `${name} enum domain`,
      field: "value" as string | undefined,
      declare: () =>
        predicate(
          "status",
          { value: { kind: "enum", values } },
          { description: "The status applies." },
        ),
    })),
    {
      reason: "a missing description",
      field: undefined,
      declare: () => predicate("unnamed", {}),
    },
    {
      reason: "an entity type with no registered entities",
      field: "company",
      declare: () =>
        predicate("involved", { company: Company }, { description: "The company is involved." }),
    },
  ])("rejects $reason before chunking or asking anything", ({ field, declare }) => {
    // Arrange: the unsupported predicate comes from the table.
    const { kb, corpus } = setup();
    const fact = declare(kb);
    const client = clientWith();
    const chunk = vi.spyOn(corpus, "chunk");

    // Act
    const construct = () =>
      classifier({ corpus, input: guard(kb).permit("assert", fact), config: { client } });

    // Assert
    expect(construct).toThrow(UnsupportedPredicateError);
    expect(construct).toThrow(expect.objectContaining({ predicate: fact, field }));
    expect(chunk).not.toHaveBeenCalled();
    expect(client.transport).not.toHaveBeenCalled();
  });

  it("validates every writable predicate, but ignores query-only and blocked ones", () => {
    // Arrange
    const { kb, corpus } = setup();
    const unsupported = predicate("unsupported", { free: String });
    const access = guard(kb).permit("assert", valid, unsupported);
    const restricted = access.block("assert", unsupported).permit("query", unsupported);

    // Act
    const writable = () => classifier({ corpus, input: access });
    const jobs = [...classifier({ corpus, input: restricted })];

    // Assert
    expect(writable).toThrow(UnsupportedPredicateError);
    expect(jobs).toHaveLength(1);
  });

  it("treats a bare KB as permitting all known predicates, while explicit guards stay default-deny", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const derived = predicate("derived", {}, { description: "The derived fact holds." });
    kb.rule(derived({})).iff(valid({}));
    const client = clientWith();

    // Act
    const bare = classifier({ corpus, input: kb, config: { client, ...admission } });
    await Promise.all([...bare].map(async (job) => await job.execute()));
    const unguarded = [...classifier({ corpus, input: guard(kb), config: { client } })];
    const denyOnly = [
      ...classifier({ corpus, input: guard(kb).permit("deny", valid), config: { client } }),
    ];

    // Assert
    expect(bare.kb.literals().map(({ atom }) => atom.predicate)).toEqual([derived, valid]);
    expect(unguarded).toEqual([]);
    expect(denyOnly).toHaveLength(1);
  });
});

describe("classifier admission", () => {
  it.each([
    { probabilities: [0.6, 0.3, 0.1], config: {}, signs: ["+"] },
    { probabilities: [0.3, 0.6, 0.1], config: {}, signs: ["-"] },
    { probabilities: [0.49, 0.48, 0.03], config: {}, signs: ["+"] },
    { probabilities: [0.45, 0.15, 0.4], config: {}, signs: ["+"] },
    { probabilities: [0.38, 0.3, 0.32], config: {}, signs: [] },
    { probabilities: [0.5, 0.5, 0], config: {}, signs: ["+", "-"] },
    { probabilities: [0.5, 0, 0.5], config: {}, signs: [] },
    { probabilities: [0.55, 0.4, 0.05], config: { minimumProbability: 0.5 }, signs: ["+"] },
    { probabilities: [0.55, 0.4, 0.05], config: { ambiguityMargin: 0.2 }, signs: ["+", "-"] },
    { probabilities: [0.45, 0.4, 0.15], config: { minimumProbability: 0.8 }, signs: [] },
    { probabilities: [0.49, 0.48, 0.03], config: admission, signs: ["+", "-"] },
  ])("admits $signs for $probabilities with $config", async ({ probabilities, config, signs }) => {
    // Arrange: the distribution and admission settings come from the table.
    const { corpus, access } = setup();
    const [assert, deny, irrelevant] = probabilities;
    const run = classifier({
      corpus,
      input: access,
      config: { client: clientWith(answer(assert, deny, irrelevant)), ...config },
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(run.kb.literals().map(({ sign }) => sign)).toEqual(signs);
  });

  it.each([
    {
      admitted: "both signs",
      answer: answer(0.49, 0.48, 0.03),
      permissions: "assert only",
      signs: ["+"],
    },
    {
      admitted: "both signs",
      answer: answer(0.49, 0.48, 0.03),
      permissions: "deny only",
      signs: ["-"],
    },
    {
      admitted: "both signs",
      answer: answer(0.49, 0.48, 0.03),
      permissions: "both, deny blocked",
      signs: ["+"],
    },
    {
      admitted: "an assertion",
      answer: answer(0.95, 0.03, 0.02),
      permissions: "deny only",
      signs: [],
    },
  ])(
    "writes only permitted signs when $admitted are admitted and the guard allows $permissions",
    async ({ answer: result, permissions, signs }) => {
      // Arrange: the answer and permissions come from the table.
      const { kb, corpus } = setup();
      const access: Record<string, GuardedKB> = {
        "assert only": guard(kb).permit("assert", valid),
        "deny only": guard(kb).permit("deny", valid),
        "both, deny blocked": guard(kb).permit("*", valid).block("deny", valid),
      };
      const input = access[permissions];
      if (input === undefined) {
        throw new Error(`Unknown permissions: ${permissions}`);
      }
      const run = classifier({
        corpus,
        input,
        config: { client: clientWith(result), ...admission },
      });

      // Act
      await nextJob(run).execute();

      // Assert
      expect(run.kb.literals().map(({ sign }) => sign)).toEqual(signs);
    },
  );
});

describe("classifier candidates", () => {
  it("asks about every combination of entities, Booleans, and enum values", async () => {
    // Arrange
    const { kb, corpus } = setup();
    class Owner {
      constructor(readonly id: string) {}
    }
    kb.entities.add(new Company("a"), new Company("b"), new Owner("x"), new Owner("y"));
    const relation = predicate(
      "relation",
      {
        company: Company,
        owner: Owner,
        active: Boolean,
        status: enumeration("direct", "indirect"),
      },
      { description: "The described relation holds." },
    );
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", relation),
      config: { client: clientWith() },
    });

    // Act
    await nextJob(run).execute();

    // Assert
    const fields = run.kb.literals().map(({ atom }) => atom.fields);
    expect(fields).toHaveLength(2 * 2 * 2 * 2);
    expect(new Set(fields.map(({ active }) => active))).toEqual(new Set([false, true]));
    expect(new Set(fields.map(({ status }) => status))).toEqual(new Set(["direct", "indirect"]));
  });

  it("does not ask about the same entity in two fields", async () => {
    // Arrange
    const kb = new KnowledgeBase();
    const alice = new Person("alice");
    const bob = new Person("bob");
    kb.entities.add(alice, bob);
    const owns = predicate(
      "owns",
      { owner: Person, holding: Person },
      { description: "The owner holds the other party." },
    );
    const corpus = new Corpus();
    corpus.add({ documentId: "d", text: "Alice holds Bob." });
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", owns),
      config: { client: clientWith() },
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(
      run.kb.literals().map(({ atom }) => [atom.fields["owner"], atom.fields["holding"]]),
    ).toEqual([
      [alice, bob],
      [bob, alice],
    ]);
  });
});

describe("classifier jobs", () => {
  it("chunks each document only when its job is requested, and asks nothing until a job runs", async () => {
    // Arrange
    const { corpus, access } = setup();
    corpus.add({ documentId: "second", text: "Another valid record." });
    const chunk = vi.spyOn(corpus, "chunk");
    const client = clientWith();

    // Act
    const run = classifier({ corpus, input: access, config: { client } });
    const chunkedAtConstruction = chunk.mock.calls.length;
    const job = nextJob(run);
    const chunkedForFirstJob = chunk.mock.calls.length;
    const askedBeforeRunning = client.transport.mock.calls.length;
    await job.execute();

    // Assert
    expect(chunkedAtConstruction).toBe(0);
    expect(chunkedForFirstJob).toBe(1);
    expect(askedBeforeRunning).toBe(0);
    expect(Object.keys(job)).toEqual(["execute"]);
    expect(chunk).toHaveBeenCalledTimes(1);
  });

  it("snapshots the KB's records and entities at construction", async () => {
    // Arrange
    const { kb, corpus, access } = setup();
    const original = kb.denies(valid({}), { source: "old" });
    const a = new Company("a");
    kb.entities.add(a);
    const run = classifier({ corpus, input: access, config: { client: clientWith() } });

    // Act
    kb.retract(original);
    kb.entities.add(new Company("b"));
    await nextJob(run).execute();

    // Assert
    expect(run.kb.literals()[0]).toBe(original);
    expect(run.kb.entities.all()).toEqual([a]);
    expect(run.kb.literals()).toHaveLength(2);
    expect(kb.literals()).toEqual([]);
  });

  /**
   * A chunk's evidence is written all at once, so a failure anywhere in it leaves nothing
   * behind and the same job can simply run again.
   */
  it.each([
    { stage: "the first request", routing: false, fails: () => true },
    {
      stage: "a later batch of the same predicate",
      routing: false,
      fails: ({ state }: SystemOneRequest) => JSON.stringify(state).includes('"value":69'),
    },
    {
      stage: "another predicate's request",
      routing: false,
      fails: ({ questions }: SystemOneRequest) =>
        JSON.stringify(questions).includes('"name":"valid"'),
    },
    {
      stage: "a relevance request",
      routing: true,
      fails: ({ questions }: SystemOneRequest) =>
        Object.values(questions).some(({ type }) => type === "noul"),
    },
  ])("writes nothing when $stage fails, and the job can be retried", async ({ routing, fails }) => {
    // Arrange: which request fails, once, comes from the table.
    const { kb, corpus } = setup();
    const many = predicate(
      "many",
      { value: enumeration(0, ...Array.from({ length: 69 }, (_, i) => i + 1)) },
      { description: "The value is recorded." },
    );
    const client = clientWith();
    const respond = client.transport.getMockImplementation();
    let failed = false;
    client.transport.mockImplementation((request) => {
      if (!failed && fails(request)) {
        failed = true;
        throw new Error("late failure");
      }
      return respond?.(request);
    });
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", many, valid),
      config: { client, routing },
    });
    const job = nextJob(run);

    // Act
    const first = job.execute();

    // Assert
    await expect(first).rejects.toThrow("late failure");
    expect(run.kb.literals()).toEqual([]);
    await job.execute();
    expect(run.kb.literals()).toHaveLength(70 + 1);
    expect(kb.literals()).toEqual([]);
  });

  it("lets the consumer run jobs in parallel, writing each as it completes", async () => {
    // Arrange
    const { corpus, access } = setup();
    corpus.add({ documentId: "second", text: "Second." });
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    const client = clientWith();
    client.transport
      .mockImplementationOnce(async () => await first.promise)
      .mockImplementationOnce(async () => await second.promise);
    const run = classifier({ corpus, input: access, config: { client } });
    const firstResult = nextJob(run).execute();
    const secondResult = nextJob(run).execute();
    await vi.waitFor(() => expect(client.transport).toHaveBeenCalledTimes(2));
    const response = {
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: { candidate_0: answer() },
    };

    // Act
    second.resolve(response);
    await secondResult;
    const afterSecond = sourceDocuments(run, corpus);
    first.resolve(response);
    await firstResult;

    // Assert
    expect(afterSecond).toEqual(["second"]);
    expect(sourceDocuments(run, corpus)).toEqual(["second", "first"]);
  });
});

type Requests = ReadonlyMap<PredicateDeclaration, readonly string[]>;

/**
 * An extractor factory answering every requested field from `offer`, given the chunks it
 * was built over and the field. It records the chunks of each build and every query.
 */
function extractor(
  offer: (
    chunks: readonly Chunk[],
    declaration: PredicateDeclaration,
    name: string,
  ) => readonly (Scalar | Entity)[],
) {
  const queries: Requests[] = [];
  const create = vi.fn((chunks: readonly Chunk[]): ChunkSymbolExtractor => ({
    query: (requests) => {
      queries.push(requests);
      return new Map(
        [...requests].map(([declaration, fields]) => [
          declaration,
          Object.fromEntries(fields.map((name) => [name, offer(chunks, declaration, name)])),
        ]),
      );
    },
  }));
  return { create, queries };
}

describe("classifier createChunkSymbolExtractor", () => {
  it("queries each job's chunk for the open fields of its predicates and classifies the values offered", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const paid = predicate(
      "paid",
      { payee: String, amount: Number, on: Date, cash: Boolean, kind: enumeration("fee") },
      { description: "The payee was paid the amount on the day." },
    );
    const day = new Date("2017-02-03T00:00:00Z");
    const offered: Readonly<Record<string, readonly (Scalar | Entity)[]>> = {
      payee: ["Harbor"],
      amount: [500],
      on: [day],
    };
    const { create, queries } = extractor((_, __, name) => offered[name] ?? []);
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", paid, valid),
      config: { client: clientWith() },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(create.mock.calls.map(([chunks]) => chunks.map(({ text }) => text))).toEqual([
      ["This record is valid."],
    ]);
    expect(queries.map((requests) => [...requests])).toEqual([[[paid, ["payee", "amount", "on"]]]]);
    expect(
      run.kb
        .literals()
        .filter(({ atom }) => atom.predicate === paid)
        .map(({ atom }) => atom.fields),
    ).toEqual([
      { payee: "Harbor", amount: 500, on: day, cash: false, kind: "fee" },
      { payee: "Harbor", amount: 500, on: day, cash: true, kind: "fee" },
    ]);
  });

  /** Years and amounts are both numbers; the extractor, not the type, tells them apart. */
  it("gives each field the values answered for it, even fields of the same type", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const earned = predicate(
      "earned",
      { year: Number, amount: Number },
      { description: "The amount was earned in the year." },
    );
    const { create } = extractor((_, __, name) => (name === "year" ? [2017] : [33_200]));
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", earned),
      config: { client: clientWith() },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(run.kb.literals().map(({ atom }) => atom.fields)).toEqual([
      { year: 2017, amount: 33_200 },
    ]);
  });

  it("adds extracted entities to registered ones, and registers them as one entity per type and id", async () => {
    // Arrange
    const kb = new KnowledgeBase();
    const alice = new Person("Alice");
    kb.entities.add(alice);
    const married = predicate(
      "married",
      { spouse: Person, other: Person },
      { description: "The two people are married." },
    );
    const corpus = new Corpus();
    corpus.add({ documentId: "first", text: "Alice married Bob." });
    corpus.add({ documentId: "second", text: "Bob is married." });
    const { create } = extractor(() => [new Person("Bob")]);
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", married),
      config: { client: clientWith() },
      createChunkSymbolExtractor: create,
    });

    // Act
    await Promise.all([...run].map(async (job) => await job.execute()));

    // Assert
    expect(run.kb.entities.ids(Person)).toEqual(["Alice", "Bob"]);
    expect(run.kb.entities.get(Person, "Alice")).toBe(alice);
    expect(sourceDocuments(run, corpus).toSorted()).toEqual(["first", "first", "second", "second"]);
    expect(kb.entities.ids(Person)).toEqual(["Alice"]);
  });

  /** Extracted values are guesses until judged, so only those in evidence persist. */
  it("registers only extracted entities that written evidence mentions", async () => {
    // Arrange
    const kb = new KnowledgeBase();
    const present = predicate(
      "present",
      { who: Person },
      { description: "The person was present." },
    );
    const corpus = new Corpus();
    corpus.add({ documentId: "first", text: "Alice came; Bob did not; Harbor is a company." });
    /** Candidates follow the offered order: Alice is asserted, Bob denied, Harbor irrelevant. */
    const judged: Readonly<Record<string, ReturnType<typeof answer>>> = {
      candidate_0: answer(),
      candidate_1: answer(0.03, 0.95, 0.02),
      candidate_2: answer(0.02, 0.03, 0.95),
    };
    const client = mockClient(({ questions }) => ({
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => [
          id,
          question.type === "noul" ? { type: "noul", noul: 1 } : judged[id],
        ]),
      ),
    }));
    const { create } = extractor(() => [
      new Person("Alice"),
      new Person("Bob"),
      new Person("Harbor"),
    ]);
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", present).permit("deny", present),
      config: { client },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(run.kb.literals().map(({ sign, atom }) => [sign, atom.fields["who"]])).toEqual([
      ["+", new Person("Alice")],
      ["-", new Person("Bob")],
    ]);
    expect(run.kb.entities.ids(Person)).toEqual(["Alice", "Bob"]);
  });

  it("asks nothing about a predicate when the chunk offers no values for one of its fields", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const born = predicate("born", { on: Date }, { description: "Someone was born on the day." });
    const client = clientWith();
    const { create } = extractor(() => []);
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", born, valid),
      config: { client },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(JSON.stringify(client.requests)).not.toContain('"name":"born"');
    expect(run.kb.literals().map(({ atom }) => atom.predicate)).toEqual([valid]);
  });

  /** Extraction may be costly, so predicates routing drops are never queried. */
  it("queries only the predicates relevance routing retains", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const born = predicate("born", { on: Date }, { description: "Someone was born on the day." });
    const died = predicate("died", { on: Date }, { description: "Someone died on the day." });
    const client = mockClient(({ questions }) => ({
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => [
          id,
          question.type === "noul"
            ? { type: "noul", noul: JSON.stringify(question).includes('"name":"died"') ? 0 : 1 }
            : answer(),
        ]),
      ),
    }));
    const { create, queries } = extractor(() => [new Date(0)]);
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", born, died),
      config: { client, routing: true },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(queries.map((requests) => [...requests.keys()])).toEqual([[born]]);
  });

  it("builds no extractor when no retained predicate has open fields", async () => {
    // Arrange
    const { corpus, access } = setup();
    const { create } = extractor(() => []);
    const run = classifier({
      corpus,
      input: access,
      config: { client: clientWith() },
      createChunkSymbolExtractor: create,
    });

    // Act
    await nextJob(run).execute();

    // Assert
    expect(create).not.toHaveBeenCalled();
    expect(run.kb.literals()).toHaveLength(1);
  });

  it("accepts open-ended and unregistered entity fields at construction only with an extractor", () => {
    // Arrange
    const { kb, corpus } = setup();
    const owns = predicate(
      "owns",
      { company: Company, since: Date },
      { description: "The company has been owned since the day." },
    );
    const input = guard(kb).permit("assert", owns);
    const { create } = extractor(() => []);

    // Act
    const without = () => classifier({ corpus, input });
    const withExtractor = () => classifier({ corpus, input, createChunkSymbolExtractor: create });

    // Assert
    expect(without).toThrow(UnsupportedPredicateError);
    expect(withExtractor).not.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    {
      reason: "an omitted predicate",
      answer: (): SymbolAnswer => new Map(),
    },
    {
      reason: "an unrequested predicate",
      answer: (earned: PredicateDeclaration): SymbolAnswer =>
        new Map([
          [earned, { year: [2017] }],
          [valid, {}],
        ]),
    },
    {
      reason: "an omitted field",
      answer: (earned: PredicateDeclaration): SymbolAnswer => new Map([[earned, {}]]),
    },
    {
      reason: "an unrequested field",
      answer: (earned: PredicateDeclaration): SymbolAnswer =>
        new Map([[earned, { year: [2017], amount: [1] }]]),
    },
    {
      reason: "a value of another type",
      answer: (earned: PredicateDeclaration): SymbolAnswer =>
        new Map([[earned, { year: ["2017"] }]]),
    },
    {
      reason: "a NaN",
      answer: (earned: PredicateDeclaration): SymbolAnswer =>
        new Map([[earned, { year: [Number.NaN] }]]),
    },
  ])("rejects the job and writes nothing for $reason", async ({ answer: respond }) => {
    // Arrange: the extractor's faulty answer comes from the table.
    const { kb, corpus } = setup();
    const earned = predicate("earned", { year: Number }, { description: "Earned in the year." });
    const client = clientWith();
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", earned),
      config: { client },
      createChunkSymbolExtractor: () => ({ query: () => respond(earned) }),
    });

    // Act
    const job = nextJob(run).execute();

    // Assert
    await expect(job).rejects.toThrow(TypeError);
    expect(client.transport).not.toHaveBeenCalled();
    expect(run.kb.literals()).toEqual([]);
  });

  it.each([
    { reason: "an invalid date", value: (): Scalar | Entity => new Date(Number.NaN) },
    { reason: "an entity of another type", value: (): Scalar | Entity => new Company("Harbor") },
  ])("rejects the job for $reason in a field", async ({ value }) => {
    // Arrange: the faulty value comes from the table.
    const { kb, corpus } = setup();
    const met = predicate(
      "met",
      { person: Person, on: Date },
      { description: "The person was met on the day." },
    );
    const run = classifier({
      corpus,
      input: guard(kb).permit("assert", met),
      config: { client: clientWith() },
      createChunkSymbolExtractor: () => ({
        query: () => new Map([[met, { person: [value()], on: [value()] }]]),
      }),
    });

    // Act
    const job = nextJob(run).execute();

    // Assert
    await expect(job).rejects.toThrow(TypeError);
    expect(run.kb.literals()).toEqual([]);
  });
});

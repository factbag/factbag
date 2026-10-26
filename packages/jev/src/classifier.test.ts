import { describe, expect, it, vi } from "vitest";
import { enumeration, predicate } from "@factbag/core/dsl";
import type { EnumType } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { classifier } from "./classifier";
import type { ClassifierClient } from "./client";
import { UnsupportedPredicateError } from "./errors";
import type { ClassificationJob } from "./jobs";

const admission = { minimumProbability: 0.3, ambiguityMargin: 0.05 };
class Person {
  constructor(readonly id: string) {}
}

const valid = predicate("valid", {}, { description: "The record is valid." });
type Response = Awaited<ReturnType<ClassifierClient["systemOne"]>>;

function answer(ASSERT = 0.95, DENY = 0.03, IRRELEVANT = 0.02) {
  return {
    type: "choice" as const,
    choice: "ASSERT" as const,
    confidence: 0.8,
    probabilities: { ASSERT, DENY, IRRELEVANT },
  };
}

function clientWith(result: Response["answers"][string] = answer()) {
  return {
    systemOne: vi.fn<ClassifierClient["systemOne"]>(
      async (request) =>
        await Promise.resolve({
          model: "test",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: Object.fromEntries(Object.keys(request.questions).map((id) => [id, result])),
        }),
    ),
  };
}

function setup() {
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  corpus.add({ documentId: "first", text: "This record is valid." });
  return { kb, corpus, access: guard(kb).permit("assert", valid).permit("deny", valid) };
}

function nextJob(run: Iterator<ClassificationJob>): ClassificationJob {
  const next = run.next();
  if (next.done === true) {
    throw new Error("Expected a classification job");
  }
  return next.value;
}

describe("classifier registration", () => {
  it("accepts omitted or empty options without creating a client or making requests", () => {
    const { corpus, access } = setup();
    const transport = vi.spyOn(TypeSafeClient.prototype, "systemOne");
    try {
      expect([...classifier(corpus, access)]).toHaveLength(1);
      expect([...classifier(corpus, access, {})]).toHaveLength(1);
      expect(transport).not.toHaveBeenCalled();
    } finally {
      transport.mockRestore();
    }
  });

  it.each([
    { probabilities: [0.6, 0.3, 0.1], signs: ["+"] },
    { probabilities: [0.3, 0.6, 0.1], signs: ["-"] },
    { probabilities: [0.49, 0.48, 0.03], signs: ["+"] },
    { probabilities: [0.45, 0.15, 0.4], signs: ["+"] },
    { probabilities: [0.38, 0.3, 0.32], signs: [] },
    { probabilities: [0.5, 0.5, 0], signs: ["+", "-"] },
    { probabilities: [0.5, 0, 0.5], signs: [] },
  ])(
    "applies default admission to $probabilities with only a client supplied",
    async ({ probabilities, signs }) => {
      const { corpus, access } = setup();
      const [positive, negative, irrelevant] = probabilities;
      const run = classifier(corpus, access.permit("deny", valid), {
        client: clientWith(answer(positive, negative, irrelevant)),
      });
      await nextJob(run).execute();
      expect(run.kb.literals().map((literal) => literal.sign)).toEqual(signs);
    },
  );

  it("captures an explicit admission policy before jobs execute", async () => {
    const { corpus, access } = setup();
    const policy = { minimumProbability: 0.8, ambiguityMargin: 0 };
    const run = classifier(corpus, access, {
      client: clientWith(answer(0.7, 0.2, 0.1)),
      admission: policy,
    });
    policy.minimumProbability = 0.5;
    await nextJob(run).execute();
    expect(run.kb.literals()).toEqual([]);
  });

  it.each([
    { minimumProbability: 0, ambiguityMargin: 0 },
    { minimumProbability: 0.5, ambiguityMargin: -1 },
  ])("still rejects invalid explicit admission: %j", (policy) => {
    const { corpus, access } = setup();
    expect(() => classifier(corpus, access, { admission: policy })).toThrow();
  });

  it("splits a predicate with many candidates across requests", async () => {
    const kb = new KnowledgeBase();
    const people = Array.from({ length: 10 }, (_, index) => new Person(`person-${index}`));
    kb.entities.add(...people);
    const owns = predicate(
      "owns",
      { owner: Person, holding: Person },
      { description: "The owner holds the other party." },
    );
    const corpus = new Corpus();
    corpus.add({ documentId: "d", text: "A holds B." });
    const client = clientWith();
    // 10 people give 90 distinct pairs, more than one request may carry.
    const run = classifier(corpus, guard(kb).permit("assert", owns), { client });

    const jobs = [...run];
    const results = await Promise.all(jobs.map(async (job) => await job.execute()));

    expect(jobs).toHaveLength(2);
    expect(results.map(({ assessments }) => assessments.length)).toEqual([64, 26]);
    expect(jobs.every(({ source }) => source === jobs[0]?.source)).toBe(true);
    const asked = results.flatMap(({ assessments }) => assessments.map(({ atom }) => atom));
    expect(new Set(asked).size).toBe(90);
  });

  it("does not ask about the same entity in two fields", async () => {
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
    const client = clientWith();
    const run = classifier(corpus, guard(kb).permit("assert", owns), { client });

    const result = await nextJob(run).execute();

    // Two parties give four combinations; the two self-pairs are not asked about.
    expect(result.assessments).toHaveLength(2);
    expect(
      result.assessments.map(({ atom }) => [atom.fields["owner"], atom.fields["holding"]]),
    ).toEqual([
      [alice, bob],
      [bob, alice],
    ]);
  });

  it("accepts two-decimal distributions that miss 1 by rounding", async () => {
    const { corpus, access } = setup();
    // Jev rounds each probability to two decimals, so three of them can sum to 0.99.
    const rounded = {
      type: "choice" as const,
      choice: "IRRELEVANT" as const,
      confidence: 0.72,
      probabilities: { ASSERT: 0.02, DENY: 0.16, IRRELEVANT: 0.81 },
    };
    const run = classifier(corpus, access, { client: clientWith(rounded) });

    const result = await nextJob(run).execute();

    expect(result.assessments[0]?.answer.probabilities.IRRELEVANT).toBe(0.81);
    expect(result.assessments[0]?.literals).toEqual([]);
  });

  it("still rejects a distribution that is not close to 1", async () => {
    const { corpus, access } = setup();
    const run = classifier(corpus, access, {
      client: clientWith(answer(0.7, 0.2, 0.2)),
    });

    await expect(nextJob(run).execute()).rejects.toThrow("Invalid classifier distribution");
  });

  it("exports exactly one name from each entry point", async () => {
    expect(Object.keys(await import("./classifier"))).toEqual(["classifier"]);
    expect(Object.keys(await import("./errors"))).toEqual(["UnsupportedPredicateError"]);
    expect(Object.keys(await import("./resolve"))).toEqual(["resolver"]);
  });

  it.each([String, Number, Date])(
    "rejects open-ended %s synchronously, even when the KB has values",
    (type) => {
      const { kb, corpus } = setup();
      const fact = predicate("open_ended", { value: type }, { description: "A value." });
      const client = clientWith();
      const chunk = vi.spyOn(corpus, "chunk");
      expect(() =>
        classifier(corpus, guard(kb).permit("assert", fact), {
          client,
          admission,
        }),
      ).toThrow(UnsupportedPredicateError);
      expect(client.systemOne).not.toHaveBeenCalled();
      expect(chunk).not.toHaveBeenCalled();
    },
  );

  it("provides predicate and field diagnostics without guessing matching scalar values", () => {
    const { kb, corpus } = setup();
    const fact = predicate("name", { name: String }, { description: "The legal name." });
    kb.asserts(fact({ name: "Harbor" }));
    try {
      classifier(corpus, kb, { client: clientWith(), admission });
      throw new Error("Expected registration failure");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedPredicateError);
      if (error instanceof UnsupportedPredicateError) {
        expect(error.predicate).toBe(fact);
        expect(error.field).toBe("name");
      }
    }
  });

  it("validates all exposed predicates before any work, but ignores query-only and blocked tools", () => {
    const { kb, corpus } = setup();
    const unsupported = predicate("unsupported", { free: String });
    const client = clientWith();
    const access = guard(kb).permit("assert", valid, unsupported);
    expect(() => classifier(corpus, access, { client, admission })).toThrow(
      UnsupportedPredicateError,
    );
    const restricted = access.block("assert", unsupported).permit("query", unsupported);
    expect([...classifier(corpus, restricted, { client, admission })]).toHaveLength(1);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("rejects missing descriptions and missing entity domains during construction", () => {
    const { kb, corpus } = setup();
    const unnamed = predicate("unnamed", {});
    class Company {
      constructor(readonly id: string) {}
    }
    const involved = predicate(
      "involved",
      { company: Company },
      { description: "The company is involved." },
    );
    expect(() =>
      classifier(corpus, guard(kb).permit("assert", unnamed), { client: clientWith(), admission }),
    ).toThrow(UnsupportedPredicateError);
    expect(() =>
      classifier(corpus, guard(kb).permit("assert", involved), { client: clientWith(), admission }),
    ).toThrow(UnsupportedPredicateError);
  });

  /** Hand-built domains bypass enumeration()'s checks, so the classifier repeats them. */
  it.each([
    { name: "empty", values: [] },
    { name: "mixed-kind", values: [1, "1"] },
    { name: "NaN", values: [Number.NaN] },
    { name: "invalid-date", values: [new Date(Number.NaN)] },
    { name: "duplicate-instant", values: [new Date(0), new Date(0)] },
  ])("rejects a malformed $name enum domain during construction", ({ values }) => {
    // Arrange
    const { kb, corpus } = setup();
    const domain = { kind: "enum", values } as EnumType;
    const fact = predicate("status", { value: domain }, { description: "The status applies." });
    const client = clientWith();
    // Act / Assert
    expect(() =>
      classifier(corpus, guard(kb).permit("assert", fact), { client, admission }),
    ).toThrow(UnsupportedPredicateError);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("normalizes bare KBs to all known predicates, while explicit guards remain default-deny", () => {
    const { kb, corpus } = setup();
    const derived = predicate("derived", {}, { description: "The derived fact holds." });
    kb.rule(derived({})).iff(valid({}));
    const client = clientWith();
    expect([...classifier(corpus, kb, { client, admission })].map((job) => job.predicate)).toEqual([
      derived,
      valid,
    ]);
    expect([...classifier(corpus, guard(kb), { client, admission })]).toEqual([]);
    expect([
      ...classifier(corpus, guard(kb).permit("deny", valid), { client, admission }),
    ]).toHaveLength(1);
  });
});

describe("lazy jobs", () => {
  it("uses the real SDK transport contract with three-way Choice questions", async () => {
    const { corpus, access } = setup();
    const transport = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== "string") {
        throw new Error("Expected a JSON request body");
      }
      // No chunk ID, document ID or range reaches the model.
      for (const key of ["documentId", "range", "start", "end"]) {
        expect(init.body).not.toContain(`"${key}":`);
      }
      expect(JSON.parse(init.body)).toMatchObject({
        state: {
          document: { text: "This record is valid." },
          candidates: [{ id: "candidate_0", fields: {} }],
        },
        questions: {
          candidate_0: {
            type: "choice",
          },
        },
      });
      return await Promise.resolve(
        Response.json({
          model: "test-model",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: { candidate_0: answer() },
        }),
      );
    });
    const client = new TypeSafeClient({ apiKey: "test-only", fetch: transport });
    const run = classifier(corpus, access, { client, admission });
    expect(transport).not.toHaveBeenCalled();
    await nextJob(run).execute();
    expect(run.kb.literals()).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("creates chunks lazily and makes requests only on execute", async () => {
    const { kb, corpus, access } = setup();
    corpus.add({ documentId: "second", text: "Another valid record." });
    const chunk = vi.spyOn(corpus, "chunk");
    const client = clientWith();
    const run = classifier(corpus, access, { client, admission });
    expect(run.kb).not.toBe(kb);
    expect(chunk).not.toHaveBeenCalled();
    const job = nextJob(run);
    expect(chunk).toHaveBeenCalledTimes(1);
    expect(client.systemOne).not.toHaveBeenCalled();
    const result = await job.execute();
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    expect(result.assessments[0]?.atom).toEqual(valid({}));
    expect(run.kb.literals()).toHaveLength(1);
    expect(kb.literals()).toEqual([]);
    expect(chunk).toHaveBeenCalledTimes(1);
    nextJob(run);
    expect(chunk).toHaveBeenCalledTimes(2);
  });

  it("fans out entity relationships, Boolean values, and explicit enums without exclusivity", async () => {
    const { kb, corpus } = setup();
    class Company {
      constructor(readonly id: string) {}
    }
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
    const client = clientWith();
    const run = classifier(corpus, guard(kb).permit("assert", relation), { client, admission });
    const result = await nextJob(run).execute();
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    expect(
      Object.values(client.systemOne.mock.calls[0]?.[0].questions ?? {}).map(
        (question) => question.type,
      ),
    ).toEqual(Array.from({ length: 16 }, () => "choice"));
    expect(result.assessments).toHaveLength(16);
    expect(run.kb.literals()).toHaveLength(16);
    expect(new Set(result.assessments.map(({ atom }) => atom.fields["active"]))).toEqual(
      new Set([false, true]),
    );
    expect(new Set(result.assessments.map(({ atom }) => atom.fields["status"]))).toEqual(
      new Set(["direct", "indirect"]),
    );
  });

  it("classifies number and Date enumerations, sending ISO dates and retaining Date evidence", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const day = new Date("2026-10-25T00:00:00Z");
    const days = enumeration(day);
    const paid = predicate(
      "paid",
      { amount: enumeration(10, 20), start: days, end: days },
      { description: "The amount was paid over the period from start to end." },
    );
    const client = clientWith();
    const run = classifier(corpus, guard(kb).permit("assert", paid), { client, admission });
    // Act
    const result = await nextJob(run).execute();
    // Assert
    expect(client.systemOne.mock.calls[0]?.[0].state).toMatchObject({
      candidates: [
        {
          id: "candidate_0",
          fields: {
            amount: 10,
            start: "2026-10-25T00:00:00.000Z",
            end: "2026-10-25T00:00:00.000Z",
          },
        },
        {
          id: "candidate_1",
          fields: {
            amount: 20,
            start: "2026-10-25T00:00:00.000Z",
            end: "2026-10-25T00:00:00.000Z",
          },
        },
      ],
    });
    expect(result.assessments.map(({ atom }) => atom.fields["amount"])).toEqual([10, 20]);
    for (const { atom } of result.assessments) {
      expect(atom.fields["start"]).toBeInstanceOf(Date);
      expect(atom.fields["start"]).toEqual(new Date("2026-10-25T00:00:00Z"));
      expect(atom.fields["end"]).toEqual(new Date("2026-10-25T00:00:00Z"));
    }
    expect(run.kb.literals()).toHaveLength(2);
    expect(query(run.kb, paid({ amount: 20, start: day, end: day })).value).toBe("true");
  });

  it("sends a JSON snapshot of entity properties while retaining the original evidence entity", async () => {
    const { kb, corpus } = setup();
    class Company {
      readonly aliases = ["Harbor"];
      readonly address = { country: "ZA" };
      readonly incorporated = new Date("2020-01-01T00:00:00Z");

      constructor(
        readonly id: string,
        public tradingName: string,
      ) {}
    }
    const company = new Company("company-42", "Harbor Components");
    kb.entities.add(company);
    const fact = predicate(
      "active",
      { company: Company },
      { description: "The company is active." },
    );
    const client = clientWith();
    const run = classifier(corpus, guard(kb).permit("assert", fact), { client, admission });
    company.tradingName = "Changed";
    company.aliases.push("Another name");
    company.address.country = "GB";

    const result = await nextJob(run).execute();
    expect(client.systemOne.mock.calls[0]?.[0].state).toMatchObject({
      candidates: [
        {
          id: "candidate_0",
          fields: {
            company: {
              type: "Company",
              id: "company-42",
              tradingName: "Harbor Components",
              aliases: ["Harbor"],
              address: { country: "ZA" },
              incorporated: "2020-01-01T00:00:00.000Z",
            },
          },
        },
      ],
    });
    expect(result.assessments[0]?.atom.fields["company"]).toBe(company);
    expect(run.kb.literals()[0]?.atom.fields["company"]).toBe(company);
  });

  it("automatically bounds a large document and preserves its source ranges", () => {
    const { access } = setup();
    const corpus = new Corpus();
    const text = "A".repeat(17_000);
    corpus.add({ documentId: "long", text });
    const client = clientWith();
    const run = classifier(corpus, access, { client, admission });
    const chunks = [...run].map((job) => corpus.resolve(job.source).chunk);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.range.start).toBe(0);
    expect(chunks.at(-1)?.range.end).toBe(text.length);
    for (const [index, chunk] of chunks.entries()) {
      expect(chunk.text.length).toBeLessThanOrEqual(8_000);
      expect(chunk.text).toBe(text.slice(chunk.range.start, chunk.range.end));
      const previous = chunks[index - 1];
      if (previous !== undefined) {
        expect(chunk.range.start).toBeLessThanOrEqual(previous.range.end);
        expect(chunk.range.start).toBeGreaterThan(previous.range.start);
      }
    }
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("chunks documents only as their jobs are requested", () => {
    const { access } = setup();
    const corpus = new Corpus();
    corpus.add({ documentId: "lazy-source", text: "A".repeat(17_000) });
    const chunk = vi.spyOn(corpus, "chunk");
    const client = clientWith();
    const run = classifier(corpus, access, { client, admission });
    expect(chunk).not.toHaveBeenCalled();
    const job = nextJob(run);
    expect(chunk).toHaveBeenCalledTimes(1);
    expect(corpus.resolve(job.source).chunk.range.start).toBe(0);
    run.return?.();
    expect(run.next().done).toBe(true);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("shares one request for assert/deny, preserves ambiguity and respects blocked polarities", async () => {
    const { corpus, access } = setup();
    const client = clientWith(answer(0.49, 0.48, 0.03));
    const run = classifier(corpus, access, { client, admission });
    const result = await nextJob(run).execute();
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    expect(run.next().done).toBe(true);
    expect(result.assessments[0]?.literals.map(({ sign }) => sign)).toEqual(["+", "-"]);
    expect(query(run.kb, valid({})).value).toBe("conflicted");
    const restricted = classifier(corpus, access.block("deny", valid), { client, admission });
    const restrictedResult = await nextJob(restricted).execute();
    expect(restricted.kb.literals().map(({ sign }) => sign)).toEqual(["+"]);
    expect(restrictedResult.assessments[0]?.answer.probabilities.DENY).toBe(0.48);
  });

  it.each([
    { result: answer(0.01, 0.01, 0.98), minimumProbability: 0.3 },
    { result: answer(0.45, 0.4, 0.15), minimumProbability: 0.8 },
  ])(
    "returns assessments even when no evidence is admitted",
    async ({ result, minimumProbability }) => {
      const { corpus, access } = setup();
      const run = classifier(corpus, access, {
        client: clientWith(result),
        admission: { ...admission, minimumProbability },
      });
      const assessment = await nextJob(run).execute();
      expect(assessment.assessments).toHaveLength(1);
      expect(assessment.assessments[0]?.literals).toEqual([]);
      expect(run.kb.literals()).toEqual([]);
    },
  );

  it("does not turn an unsupported assertion into an allowed denial", async () => {
    const { kb, corpus } = setup();
    const run = classifier(corpus, guard(kb).permit("deny", valid), {
      client: clientWith(),
      admission,
    });
    await nextJob(run).execute();
    expect(run.kb.literals()).toEqual([]);
  });

  it("propagates request errors unchanged and leaves the consumer free to retry the job", async () => {
    const { corpus, access } = setup();
    const client = clientWith();
    const failure = new Error("transport failed");
    client.systemOne.mockRejectedValueOnce(failure);
    const run = classifier(corpus, access, { client, admission });
    const job = nextJob(run);
    await expect(job.execute()).rejects.toBe(failure);
    expect(run.kb.literals()).toEqual([]);
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    await job.execute();
    expect(client.systemOne).toHaveBeenCalledTimes(2);
    expect(run.kb.literals()).toHaveLength(1);
  });

  it("keeps the iterator usable after a job fails and preserves earlier successful evidence", async () => {
    const { corpus, access } = setup();
    corpus.add({ documentId: "second", text: "Second." });
    corpus.add({ documentId: "third", text: "Third." });
    const client = clientWith();
    const run = classifier(corpus, access, { client, admission });
    await nextJob(run).execute();
    client.systemOne.mockRejectedValueOnce(new Error("failure"));
    await expect(nextJob(run).execute()).rejects.toThrow("failure");
    expect(run.kb.literals()).toHaveLength(1);
    await nextJob(run).execute();
    expect(run.kb.literals()).toHaveLength(2);
  });

  it("allows consumer-controlled parallel requests and applies them in completion order", async () => {
    const { corpus, access } = setup();
    corpus.add({ documentId: "second", text: "Second." });
    const first = Promise.withResolvers<Response>();
    const second = Promise.withResolvers<Response>();
    const client = clientWith();
    client.systemOne
      .mockImplementationOnce(async () => await first.promise)
      .mockImplementationOnce(async () => await second.promise);
    const run = classifier(corpus, access, { client, admission });
    const firstJob = nextJob(run);
    const secondJob = nextJob(run);
    const firstResult = firstJob.execute();
    const secondResult = secondJob.execute();
    expect(client.systemOne).toHaveBeenCalledTimes(2);
    const response: Response = {
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: { candidate_0: answer() },
    };
    second.resolve(response);
    await secondResult;
    expect(run.kb.literals()[0]?.metadata?.source).toBe(secondJob.source);
    first.resolve(response);
    await firstResult;
    expect(run.kb.literals().map(({ metadata }) => metadata?.source)).toEqual([
      secondJob.source,
      firstJob.source,
    ]);
  });

  it("takes independent storage and entity-domain snapshots without duplicating existing records", async () => {
    const { kb, corpus, access } = setup();
    const original = kb.denies(valid({}), { source: "old" });
    class Company {
      constructor(readonly id: string) {}
    }
    const a = new Company("a");
    kb.entities.add(a);
    const run = classifier(corpus, access, { client: clientWith(), admission });
    kb.retract(original);
    kb.entities.add(new Company("b"));
    expect(run.kb.literals()[0]).toBe(original);
    expect(run.kb.entities.all()).toEqual([a]);
    await nextJob(run).execute();
    expect(kb.literals()).toEqual([]);
    expect(run.kb.literals()).toHaveLength(2);
  });

  it.each([
    { candidate_0: answer() },
    { candidate_0: answer(), candidate_1: answer(0.9, 0.9, 0.9) },
    { candidate_0: answer(), candidate_1: answer(Number.NaN, 0, 1) },
    { candidate_0: answer(), candidate_1: answer(-0.1, 0.1, 1) },
  ])("rejects incomplete or invalid batches before writing any evidence", async (answers) => {
    const { kb, corpus } = setup();
    const fact = predicate(
      "status",
      { value: enumeration("a", "b") },
      { description: "The status applies." },
    );
    const client = clientWith();
    client.systemOne.mockResolvedValueOnce({
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers,
    });
    const run = classifier(corpus, guard(kb).permit("assert", fact), { client, admission });
    await expect(nextJob(run).execute()).rejects.toThrow(/Invalid/u);
    expect(run.kb.literals()).toEqual([]);
  });

  it("reads the documents present at construction", () => {
    const { corpus, access } = setup();
    const run = classifier(corpus, access, { client: clientWith(), admission });
    corpus.add({ documentId: "later", text: "This later record is valid." });
    expect([...run].map((job) => corpus.resolve(job.source).document.documentId)).toEqual([
      "first",
    ]);
  });

  it("preserves source, selected choice, full scores and separate SDK confidence", async () => {
    const { corpus, access } = setup();
    const run = classifier(corpus, access, { client: clientWith(), admission });
    const job = nextJob(run);
    await job.execute();
    expect(run.kb.literals()[0]?.metadata).toEqual({
      source: job.source,
      scores: { probability: 0.95 },
      annotations: {
        jev: {
          optionId: "candidate_0",
          outcome: "ASSERT",
          choice: "ASSERT",
          confidence: 0.8,
          probabilities: { ASSERT: 0.95, DENY: 0.03, IRRELEVANT: 0.02 },
        },
      },
    });
    expect(corpus.resolve(job.source).chunk.text).toBe("This record is valid.");
  });
});

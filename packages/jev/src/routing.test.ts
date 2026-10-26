import { describe, expect, it, vi } from "vitest";
import { enumeration, predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { NoulQuestion } from "@typesafe-ai/sdk";
import type { ClassifierClient } from "./classifier";
import { classifier } from "./classifier";
import type { RoutingClient, RoutedChunk } from "./classifier";

class Person {
  constructor(readonly id: string) {}
}
const married = predicate(
  "married",
  { spouse: Person, partner: Person },
  { description: "The spouse is married to the partner." },
);
const valid = predicate("valid", {}, { description: "The record is valid." });
const active = predicate(
  "active",
  { value: Boolean },
  { description: "The active status has this value." },
);

function routing(score: (question: NoulQuestion) => number = () => 0.9) {
  return {
    systemOne: vi.fn<RoutingClient["systemOne"]>(
      async ({ questions }) =>
        await Promise.resolve({
          model: "mock",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: Object.fromEntries(
            Object.entries(questions).map(([id, question]) => [
              id,
              { type: "noul" as const, noul: score(question) },
            ]),
          ),
        }),
    ),
  };
}
function classification(deny = false) {
  return {
    systemOne: vi.fn<ClassifierClient["systemOne"]>(
      async ({ questions }) =>
        await Promise.resolve({
          model: "mock",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: Object.fromEntries(
            Object.keys(questions).map((id) => [
              id,
              {
                type: "choice" as const,
                choice: deny ? ("DENY" as const) : ("ASSERT" as const),
                confidence: 0.9,
                probabilities: {
                  ASSERT: deny ? 0.02 : 0.96,
                  DENY: deny ? 0.96 : 0.02,
                  IRRELEVANT: 0.02,
                },
              },
            ]),
          ),
        }),
    ),
  };
}
function setup(people = 5) {
  const kb = new KnowledgeBase();
  kb.entities.add(...Array.from({ length: people }, (_, i) => new Person(`p${i}`)));
  const corpus = new Corpus();
  corpus.add({ documentId: "record", text: "p0 is not married to p1. This record is valid." });
  return { kb, corpus, access: guard(kb).permit("assert", married, valid).permit("deny", married) };
}
function first(run: Iterable<RoutedChunk>): RoutedChunk {
  const chunk = [...run][0];
  if (chunk === undefined) {
    throw new Error("Missing chunk");
  }
  return chunk;
}
async function route(chunk: RoutedChunk) {
  await Promise.all(chunk.relevance.map(async (job) => await job.execute()));
  await Promise.all(chunk.participants().map(async (job) => await job.execute()));
}

/** A JSON object out of a request, which may carry assets, as a record of unknowns. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A non-array object indexes by string.
  return value as Record<string, unknown>;
}

describe("classifier", () => {
  it.each([String, Number, Date])("rejects open-ended %s fields with routing off or on", (type) => {
    // Arrange
    const { kb, corpus } = setup();
    const open = predicate("open", { value: type }, { description: "The value is recorded." });
    const access = guard(kb).permit("assert", open);
    // Act
    const exhaustive = () => classifier(corpus, access);
    const routed = () => classifier(corpus, access, { routing: {} });
    // Assert
    expect(exhaustive).toThrow(/unsupported open-ended domain/u);
    expect(routed).toThrow(/unsupported open-ended domain/u);
  });

  it.each([
    { name: "empty", values: [] },
    { name: "mixed", values: [10, "20"] },
    { name: "duplicate numbers", values: [10, 10] },
    { name: "NaN", values: [NaN] },
    { name: "invalid date", values: [new Date(NaN)] },
    { name: "duplicate dates", values: [new Date("2026-10-25"), new Date("2026-10-25")] },
  ])("rejects a malformed $name enumeration before remote work", ({ values }) => {
    // Arrange
    const { kb, corpus } = setup();
    const malformed = predicate(
      "malformed",
      { value: { kind: "enum", values } },
      {
        description: "The value is recorded.",
      },
    );
    const access = guard(kb).permit("assert", malformed);
    const client = classification();
    // Act
    const exhaustive = () => classifier(corpus, access, { client });
    const routed = () => classifier(corpus, access, { client, routing: {} });
    // Assert
    expect(exhaustive).toThrow(/Invalid enum domain/u);
    expect(routed).toThrow(/Invalid enum domain/u);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "classifies typed numeric and date enumerations with routing %s",
    async (enabled) => {
      // Arrange
      const { kb, corpus } = setup();
      const dates = enumeration(new Date("2026-10-25T00:00:00Z"));
      const paid = predicate(
        "paid",
        {
          amount: enumeration(10, 20),
          start: dates,
          end: dates,
        },
        { description: "This amount was paid for this period." },
      );
      const access = guard(kb).permit("assert", paid);
      const client = classification();
      const routingClient = routing();

      // Act
      const run = enabled
        ? classifier(corpus, access, {
            client,
            routing: { client: routingClient, candidateProductCutoff: 0 },
          })
        : classifier(corpus, access, { client });
      const results = (
        await Promise.all(
          [...run].map(async (item) => {
            if ("relevance" in item) {
              await route(item);
              return await Promise.all(
                item.classification().map(async (job) => await job.execute()),
              );
            }
            return [await item.execute()];
          }),
        )
      ).flat();

      // Assert
      expect(
        results.flatMap(({ assessments }) => assessments.map(({ atom }) => atom.fields)),
      ).toEqual([
        {
          amount: 10,
          start: new Date("2026-10-25T00:00:00Z"),
          end: new Date("2026-10-25T00:00:00Z"),
        },
        {
          amount: 20,
          start: new Date("2026-10-25T00:00:00Z"),
          end: new Date("2026-10-25T00:00:00Z"),
        },
      ]);
      expect(client.systemOne.mock.calls[0]?.[0].state).toMatchObject({
        candidates: [
          {
            fields: {
              amount: 10,
              start: "2026-10-25T00:00:00.000Z",
              end: "2026-10-25T00:00:00.000Z",
            },
          },
          {
            fields: {
              amount: 20,
              start: "2026-10-25T00:00:00.000Z",
              end: "2026-10-25T00:00:00.000Z",
            },
          },
        ],
      });
      expect(run.kb.literals()).toHaveLength(2);
      expect(kb.literals()).toEqual([]);
      if (enabled) {
        expect(routingClient.systemOne.mock.calls[1]?.[0].questions).toMatchObject({
          routing_0: { instructions: { role: "amount", value: 10 } },
          routing_1: { instructions: { role: "amount", value: 20 } },
          routing_2: { instructions: { role: "start", value: "2026-10-25T00:00:00.000Z" } },
          routing_3: { instructions: { role: "end", value: "2026-10-25T00:00:00.000Z" } },
        });
      }
    },
  );

  it.each([0, 0.3, 1])(
    "retains answers at the inclusive routing threshold %s",
    async (threshold) => {
      // Arrange
      const { corpus, access } = setup();
      const chunk = first(
        classifier(corpus, access, {
          routing: {
            client: routing(() => threshold),
            relevanceThreshold: threshold,
            participantThreshold: threshold,
            candidateProductCutoff: 0,
          },
          client: classification(),
        }),
      );

      // Act
      await route(chunk);
      const results = await Promise.all(
        chunk.classification().map(async (job) => await job.execute()),
      );

      // Assert
      expect(results.map(({ assessments }) => assessments.length)).toEqual([20, 1]);
      expect(chunk.inspect().decisions.every(({ retained }) => retained)).toBe(true);
      expect(chunk.inspect().participants.questions).toBe(10);
    },
  );

  it.each([
    { relevanceThreshold: NaN },
    { relevanceThreshold: Infinity },
    { relevanceThreshold: -0.1 },
    { relevanceThreshold: 1.1 },
    { participantThreshold: NaN },
    { participantThreshold: Infinity },
    { participantThreshold: -0.1 },
    { participantThreshold: 1.1 },
    { candidateProductCutoff: -1 },
    { candidateProductCutoff: 0.5 },
    { candidateProductCutoff: Infinity },
    { candidateProductCutoff: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid routing settings %j before iteration", (settings) => {
    // Arrange
    const { corpus, access } = setup();
    // Act
    const construct = () => classifier(corpus, access, { routing: settings });
    // Assert
    expect(construct).toThrow();
  });

  it("bypasses participant filtering at the inclusive raw-product cutoff", async () => {
    // Arrange
    const { corpus, access } = setup();
    const chunk = first(
      classifier(corpus, access, {
        routing: { client: routing(), candidateProductCutoff: 25 },
      }),
    );
    // Act
    await route(chunk);
    chunk.classification();
    // Assert
    expect(chunk.participants()).toEqual([]);
    expect(chunk.inspect().candidates[0]).toMatchObject({
      initialProduct: 25,
      retainedProduct: 25,
      classificationCandidates: 20,
      bypass: "small-product",
    });
  });

  it("retains multiple predicates and negative, role-directed evidence without early writes", async () => {
    // Arrange
    const { kb, corpus, access } = setup();
    const routingClient = routing((question) => {
      const instructions = record(question.instructions);
      expect(instructions["task"]).toMatch(/negative evidence/u);
      const role = instructions["role"];
      if (role === undefined) {
        return 0.9;
      }
      return record(instructions["value"])["id"] === (role === "spouse" ? "p0" : "p1") ? 0.9 : 0.1;
    });
    const client = classification(true);
    // Act
    const run = classifier(corpus, access, { client, routing: { client: routingClient } });
    const chunk = first(run);
    expect(routingClient.systemOne).not.toHaveBeenCalled();
    expect(() => chunk.participants()).toThrow(/relevance/u);
    await Promise.all(chunk.relevance.map(async (job) => await job.execute()));
    expect(chunk.participants()).toHaveLength(1);
    expect(() => chunk.classification()).toThrow(/participants/u);
    await Promise.all(chunk.participants().map(async (job) => await job.execute()));
    expect(run.kb.literals()).toEqual([]);
    expect(chunk.classification()).toBe(chunk.classification());
    const assessments = await Promise.all(
      chunk.classification().map(async (job) => await job.execute()),
    );
    // Assert
    expect(assessments[0]?.assessments.map(({ atom }) => atom.fields)).toEqual([
      { spouse: new Person("p0"), partner: new Person("p1") },
    ]);
    // Denying valid is forbidden.
    expect(run.kb.literals()).toHaveLength(1);
    expect(run.kb.literals()[0]).toMatchObject({ sign: "-", metadata: { source: chunk.source } });
    expect(corpus.resolve(chunk.source).chunk.text).toContain("not married");
    expect(kb.literals()).toEqual([]);
    expect(chunk.inspect()).toMatchObject({
      relevance: { requests: 1, questions: 2 },
      participants: { requests: 1, questions: 10 },
      classification: { requests: 2, questions: 2 },
      candidates: [
        { initialProduct: 25, retainedProduct: 1, classificationCandidates: 1 },
        { bypass: "zero-argument" },
      ],
    });
  });

  it("bypasses zero arguments, Boolean-only schemas, and small products", async () => {
    // Arrange
    const { kb, corpus } = setup(2);
    const run = classifier(corpus, guard(kb).permit("assert", valid, active, married), {
      routing: { client: routing() },
      client: classification(),
    });
    const chunk = first(run);
    // Act
    await route(chunk);
    expect(chunk.participants()).toEqual([]);
    const results = await Promise.all(
      chunk.classification().map(async (job) => await job.execute()),
    );
    // Assert
    expect(results.map((result) => result.assessments.length)).toEqual([1, 2, 2]);
    expect(chunk.inspect().candidates.map((count) => count.bypass)).toEqual([
      "zero-argument",
      "boolean-only",
      "small-product",
    ]);
  });

  it("filters numeric enum values per role but leaves mixed Boolean values exhaustive", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const paid = predicate(
      "paid",
      { amount: enumeration(10, 20), taxable: Boolean },
      { description: "This amount was paid with this taxable status." },
    );
    const routingClient = routing((q) =>
      JSON.stringify(q.instructions).includes('"value":20') ? 0.1 : 0.9,
    );
    const run = classifier(corpus, guard(kb).permit("assert", paid), {
      routing: { client: routingClient, candidateProductCutoff: 0 },
      client: classification(),
    });
    const chunk = first(run);
    // Act
    await route(chunk);
    const [job] = chunk.classification();
    const result = await job?.execute();
    // Assert
    expect(result?.assessments.map(({ atom }) => atom.fields)).toEqual([
      { amount: 10, taxable: false },
      { amount: 10, taxable: true },
    ]);
    expect(chunk.inspect().participants.questions).toBe(2);
  });

  it("bypasses Boolean-only filtering even at cutoff zero", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const chunk = first(
      classifier(corpus, guard(kb).permit("assert", active), {
        routing: { client: routing(), candidateProductCutoff: 0 },
      }),
    );
    // Act
    await route(chunk);
    // Assert
    expect(chunk.participants()).toEqual([]);
    expect(chunk.inspect().candidates[0]?.bypass).toBe("boolean-only");
  });

  it("snapshots enum candidates and batches work; final failures write nothing", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const values = Array.from({ length: 70 }, (_, index) => index);
    const amount = predicate(
      "amount",
      { value: enumeration(0, ...values.slice(1)) },
      { description: "This amount is paid." },
    );
    const client = classification();
    const routingClient = routing();
    const run = classifier(corpus, guard(kb).permit("assert", amount), {
      client,
      routing: { client: routingClient, candidateProductCutoff: 0 },
    });
    // Act
    values.push(70);
    corpus.add({ documentId: "later", text: "Not part of this run." });
    const chunks = [...run];
    expect(chunks).toHaveLength(1);
    const chunk = chunks[0];
    if (chunk === undefined) {
      throw new Error("Missing chunk");
    }
    await route(chunk);
    expect(chunk.participants().map((job) => job.questionCount)).toEqual([64, 6]);
    const jobs = chunk.classification();
    expect(jobs).toHaveLength(2);
    client.systemOne.mockResolvedValueOnce({
      model: "mock",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: {},
    });
    await expect(jobs[0]?.execute()).rejects.toThrow();
    expect(run.kb.literals()).toEqual([]);
    await Promise.all(jobs.map(async (job) => await job.execute()));
    // Assert
    expect(run.kb.literals()).toHaveLength(70);
    expect(kb.literals()).toEqual([]);
    expect(chunk.inspect().classification).toEqual({ requests: 3, questions: 134 });
  });

  it("prunes irrelevant predicates and empty role domains without classification requests", async () => {
    // Arrange
    const { corpus, access } = setup();
    const routingClient = routing((q) =>
      JSON.stringify(q.instructions).includes('"role":') ? 0 : 0.9,
    );
    const client = classification();
    const chunk = first(
      classifier(corpus, access.block("assert", valid), {
        routing: { client: routingClient },
        client,
      }),
    );
    // Act
    await route(chunk);
    expect(chunk.classification()).toEqual([]);
    expect(chunk.inspect().candidates[0]).toMatchObject({
      retainedProduct: 0,
      classificationCandidates: 0,
    });
    const irrelevant = first(
      classifier(corpus, access, { routing: { client: routing(() => 0) }, client }),
    );
    await route(irrelevant);
    // Assert
    expect(irrelevant.classification()).toEqual([]);
    expect(irrelevant.inspect().candidates.map(({ bypass }) => bypass)).toEqual([
      "irrelevant",
      "irrelevant",
    ]);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("propagates failures, validates whole batches, and permits explicit retries", async () => {
    // Arrange
    const { corpus, access } = setup();
    const routingClient = routing();
    const failure = new Error("offline");
    routingClient.systemOne.mockRejectedValueOnce(failure);
    routingClient.systemOne.mockResolvedValueOnce({
      model: "mock",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: { routing_0: { type: "noul", noul: 0.9 } },
    });
    const run = classifier(corpus, access, {
      routing: { client: routingClient },
      client: classification(),
    });
    const chunk = first(run);
    const job = chunk.relevance[0];
    // Act
    await expect(job?.execute()).rejects.toBe(failure);
    await expect(job?.execute()).rejects.toThrow(/routing answer/u);
    expect(chunk.inspect().decisions).toEqual([]);
    expect(() => chunk.participants()).toThrow();
    await Promise.all([job?.execute(), job?.execute()]);
    await job?.execute();
    expect(routingClient.systemOne).toHaveBeenCalledTimes(3);
    expect(chunk.inspect().relevance.requests).toBe(3);
    routingClient.systemOne.mockRejectedValueOnce(failure);
    await expect(chunk.participants()[0]?.execute()).rejects.toBe(failure);
    expect(() => chunk.classification()).toThrow();
    expect(run.kb.literals()).toEqual([]);
    await route(chunk);
    // Assert
    expect(chunk.classification()).toHaveLength(2);
  });

  it.each([NaN, Infinity, -0.1, 1.1])(
    "rejects invalid routing probability %s",
    async (probability) => {
      // Arrange
      const { corpus, access } = setup();
      const chunk = first(
        classifier(corpus, access, { routing: { client: routing(() => probability) } }),
      );
      // Act / Assert
      await expect(chunk.relevance[0]?.execute()).rejects.toThrow(/routing answer/u);
    },
  );

  it("enforces default-deny, blocked/query-only predicates and final admission independently", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const unsupported = predicate("unsupported", { amount: Number });
    // Act
    expect([...classifier(corpus, guard(kb), { routing: {} })]).toEqual([]);
    const run = classifier(
      corpus,
      guard(kb)
        .permit("assert", valid, unsupported)
        .block("assert", unsupported)
        .permit("query", unsupported),
      {
        routing: { client: routing(() => 0.4), relevanceThreshold: 0.3 },
        client: classification(),
        admission: { minimumProbability: 0.99, ambiguityMargin: 0 },
      },
    );
    const chunk = first(run);
    await route(chunk);
    expect(chunk.inspect().decisions.map((d) => d.predicate)).toEqual([valid]);
    await chunk.classification()[0]?.execute();
    // Assert
    expect(run.kb.literals()).toEqual([]);
    expect(() =>
      classifier(corpus, guard(kb).permit("assert", unsupported), { routing: {} }),
    ).toThrow();
    expect(() => classifier(corpus, kb, { routing: { candidateProductCutoff: -1 } })).toThrow();
    expect(() => classifier(corpus, kb, { routing: { relevanceThreshold: NaN } })).toThrow();
  });

  it("batches independent SDK noul questions and preserves caller-controlled parallelism", async () => {
    // Arrange
    const { kb, corpus } = setup();
    const predicates = Array.from({ length: 65 }, (_, i) =>
      predicate(`p${i}`, {}, { description: `Predicate ${i}` }),
    );
    const responses: (() => void)[] = [];
    const transport = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== "string") {
        throw new Error("Expected JSON request");
      }
      const body: unknown = JSON.parse(init.body);
      expect(body).toMatchObject({
        state: { document: { text: "p0 is not married to p1. This record is valid." } },
      });
      if (
        typeof body !== "object" ||
        body === null ||
        !("questions" in body) ||
        typeof body.questions !== "object" ||
        body.questions === null
      ) {
        throw new Error("Invalid body");
      }
      const entries: [string, unknown][] = Object.entries(body.questions);
      expect(
        entries.every(
          ([, q]) => typeof q === "object" && q !== null && "type" in q && q.type === "noul",
        ),
      ).toBe(true);
      await new Promise<void>((resolve) => {
        responses.push(resolve);
      });
      return Response.json({
        model: "mock",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(entries.map(([id]) => [id, { type: "noul", noul: 0.9 }])),
      });
    });
    const chunk = first(
      classifier(corpus, guard(kb).permit("assert", ...predicates), {
        // Uncompressed bodies, so the transport can read the JSON of a 64-question request.
        routing: {
          client: new TypeSafeClient({ apiKey: "test", fetch: transport, compression: false }),
        },
      }),
    );
    expect(chunk.relevance.map((job) => job.questionCount)).toEqual([64, 1]);
    // Act
    const pending = chunk.relevance.map(async (job) => await job.execute());
    await vi.waitFor(() => expect(responses).toHaveLength(2));
    responses[1]?.();
    await pending[1];
    expect(() => chunk.participants()).toThrow();
    responses[0]?.();
    await Promise.all(pending);
    // Assert
    expect(chunk.participants()).toEqual([]);
  });
});

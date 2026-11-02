import { describe, expect, it } from "vitest";
import { enumeration, predicate } from "@factbag/core/dsl";
import type { Transport } from "../provider";
import { mockClient } from "../testing/provider";
import { systemOneModel } from "./model";

class Person {
  constructor(readonly id: string) {}
}

const valid = predicate("valid", {}, { description: "The record is valid." });
const limits = { name: "test", batchSize: 64, maxBatchSize: Infinity };

/** The model over `client`, batching 64 questions with no hard limit unless overridden. */
function over(client: Transport, overrides: Partial<typeof limits> = {}) {
  return systemOneModel({ ...limits, ...overrides, transport: () => client });
}

/** A model that scores each question with `score`, given the question as JSON text. */
function noulClient(score: (question: string) => number | undefined) {
  return mockClient(({ questions }) => ({
    model: "mock",
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        { type: "noul", noul: score(JSON.stringify(question)) },
      ]),
    ),
  }));
}

describe("systemOneModel", () => {
  it("pairs each subject with its relevance, in order, beyond one request's capacity", async () => {
    // Arrange
    const people = Array.from({ length: 150 }, (_, index) => new Person(`p${index}`));
    const client = noulClient((question) => Number(/"id":"p(\d+)"/u.exec(question)?.[1]) / 1000);
    const model = over(client);

    // Act
    const answers = await model.relevance({
      text: "Everyone is mentioned.",
      subjects: people.map((value) => ({ value })),
    });

    // Assert
    expect(answers.map(({ subject }) => subject.value)).toEqual(people);
    expect(answers.map(({ relevance }) => relevance)).toEqual(
      people.map((_, index) => index / 1000),
    );
  });

  it("judges predicate and symbol subjects in the same call", async () => {
    // Arrange
    const client = noulClient((question) => (question.includes('"valid"') ? 0.8 : 0.2));
    const model = over(client);

    // Act
    const answers = await model.relevance({
      text: "The record is valid.",
      subjects: [{ declaration: valid }, { value: new Person("p0") }],
    });

    // Assert
    expect(answers.map(({ relevance }) => relevance)).toEqual([0.8, 0.2]);
  });

  it("asks nothing when there is nothing to judge", async () => {
    // Arrange
    const client = noulClient(() => 1);
    const model = over(client);

    // Act
    const results = await Promise.all([
      model.relevance({ text: "Text.", subjects: [] }),
      model.classify({ text: "Text.", predicate: valid, candidates: [] }),
      model.adjudicate({ atom: valid({}), passages: [] }),
    ]);

    // Assert
    expect(results).toEqual([[], [], []]);
    expect(client.transport).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, -0.1, 1.1, undefined])(
    "rejects a relevance answer of %s",
    async (relevance) => {
      // Arrange
      const client = noulClient(() => relevance);
      const model = over(client);

      // Act
      const answers = model.relevance({ text: "Text.", subjects: [{ declaration: valid }] });

      // Assert
      await expect(answers).rejects.toThrow(/routing answer/u);
    },
  );

  it("pairs each candidate with the model's distribution and keeps its choice and confidence", async () => {
    // Arrange
    const client = mockClient(() => ({
      model: "mock",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: {
        candidate_0: {
          type: "choice",
          choice: "DENY",
          confidence: 0.7,
          probabilities: { ASSERT: 0.1, DENY: 0.8, IRRELEVANT: 0.1 },
        },
      },
    }));
    const model = over(client);
    const candidate = valid({});

    // Act
    const [answer] = await model.classify({
      text: "The record is not valid.",
      predicate: valid,
      candidates: [candidate],
    });

    // Assert
    expect(answer?.candidate).toBe(candidate);
    expect(answer?.judgement.probabilities).toEqual({ ASSERT: 0.1, DENY: 0.8, IRRELEVANT: 0.1 });
    expect(answer?.judgement.details).toMatchObject({ choice: "DENY", confidence: 0.7 });
  });

  it("builds no client until something is asked", async () => {
    // Arrange
    let built = 0;
    const client = noulClient(() => 1);
    const model = systemOneModel({
      ...limits,
      transport: () => {
        built++;
        return client;
      },
    });

    // Act
    const before = built;
    await model.relevance({ text: "Text.", subjects: [{ declaration: valid }] });

    // Assert
    expect(before).toBe(0);
    expect(built).toBeGreaterThan(0);
  });

  it("sends each candidate's fields with ISO dates and entities' properties as they are when asked", async () => {
    // Arrange
    class Company {
      readonly address = { country: "ZA" };
      constructor(
        readonly id: string,
        public tradingName: string,
      ) {}
    }
    const day = new Date("2026-10-25T00:00:00Z");
    const company = new Company("company-42", "Harbor Components");
    const filed = predicate(
      "filed",
      { company: Company, on: enumeration(day) },
      { description: "The company filed on this day." },
    );
    const client = choiceClient(() => choice());
    const model = over(client);
    company.tradingName = "Changed";
    company.address.country = "GB";

    // Act
    await model.classify({
      text: "Harbor filed.",
      predicate: filed,
      candidates: [filed({ company, on: day })],
    });

    // Assert
    expect(client.requests[0]?.state).toMatchObject({
      candidate_facts: [
        {
          fields: {
            company: {
              type: "Company",
              id: "company-42",
              tradingName: "Changed",
              address: { country: "GB" },
            },
            on: "2026-10-25T00:00:00.000Z",
          },
        },
      ],
    });
  });

  /** Models round each probability to two decimals, so a valid distribution can sum to 0.99. */
  it("accepts a distribution that misses 1 only by rounding", async () => {
    // Arrange
    const client = choiceClient(() => choice({ ASSERT: 0.02, DENY: 0.16, IRRELEVANT: 0.81 }));
    const model = over(client);

    // Act
    const answers = await model.classify({
      text: "Text.",
      predicate: valid,
      candidates: [valid({})],
    });

    // Assert
    expect(answers[0]?.judgement.probabilities).toEqual({
      ASSERT: 0.02,
      DENY: 0.16,
      IRRELEVANT: 0.81,
    });
  });

  it.each([
    { name: "a missing answer", answer: undefined },
    { name: "an answer of another type", answer: { type: "noul", noul: 0.5 } },
    {
      name: "missing probabilities",
      answer: { type: "choice", choice: "ASSERT", confidence: 0.9 },
    },
    {
      name: "a distribution far from 1",
      answer: choice({ ASSERT: 0.7, DENY: 0.2, IRRELEVANT: 0.2 }),
    },
    { name: "a probability above 1", answer: choice({ ASSERT: 1.1, DENY: 0, IRRELEVANT: 0 }) },
    { name: "a negative probability", answer: choice({ ASSERT: -0.1, DENY: 0.1, IRRELEVANT: 1 }) },
    { name: "a choice outside the labels", answer: { ...choice(), choice: "MAYBE" } },
    { name: "an invalid confidence", answer: { ...choice(), confidence: 2 } },
  ])("rejects a classification with $name", async ({ answer }) => {
    // Arrange
    const client = choiceClient(() => answer);
    const model = over(client);

    // Act
    const answers = model.classify({ text: "Text.", predicate: valid, candidates: [valid({})] });

    // Assert
    await expect(answers).rejects.toThrow("Invalid choice answer from test");
  });

  it("splits work into requests of the configured batch size", async () => {
    // Arrange
    const people = Array.from({ length: 10 }, (_, index) => new Person(`p${index}`));
    const client = noulClient(() => 0.5);
    const model = over(client, { batchSize: 4 });

    // Act
    const answers = await model.relevance({
      text: "Everyone is mentioned.",
      subjects: people.map((value) => ({ value })),
    });

    // Assert
    expect(client.requests.map(({ questions }) => Object.keys(questions).length)).toEqual([
      4, 4, 2,
    ]);
    expect(answers.map(({ subject }) => subject.value)).toEqual(people);
  });

  it("refuses, without asking, an adjudication larger than the provider allows", async () => {
    // Arrange
    const client = choiceClient(() => choice({ KEEP: 0.9, RETRACT: 0.1 }));
    const model = over(client, { batchSize: 2, maxBatchSize: 2 });
    const passages = ["One.", "Two.", "Three."].map((text) => ({ text }));

    // Act
    const answers = model.adjudicate({ atom: valid({}), passages });

    // Assert
    await expect(answers).rejects.toThrow(/test accepts at most 2/u);
    expect(client.transport).not.toHaveBeenCalled();
  });

  it("pairs each passage with its verdict, sending only the passages' text", async () => {
    // Arrange
    const passages = [
      { id: "chunk-removal", text: "2012: removed." },
      { id: "chunk-designation", text: "2022: designated again." },
    ];
    const client = choiceClient((id) =>
      choice(
        id.endsWith("0") ? { KEEP: 0.1, RETRACT: 0.9 } : { KEEP: 0.9, RETRACT: 0.1 },
        id.endsWith("0") ? "RETRACT" : "KEEP",
      ),
    );
    const model = over(client);

    // Act
    const answers = await model.adjudicate({ atom: valid({}), passages });

    // Assert
    expect(answers.map(({ passage, judgement }) => [passage, judgement.probabilities])).toEqual([
      [passages[0], { KEEP: 0.1, RETRACT: 0.9 }],
      [passages[1], { KEEP: 0.9, RETRACT: 0.1 }],
    ]);
    expect(JSON.stringify(client.requests)).not.toContain("chunk-");
    expect(client.requests[0]?.state).toMatchObject({
      documents: [{ text: "2012: removed." }, { text: "2022: designated again." }],
    });
  });
});

/** A Choice answer; defaults to a confident assertion. */
function choice(
  probabilities: Readonly<Record<string, number>> = { ASSERT: 0.95, DENY: 0.03, IRRELEVANT: 0.02 },
  selected = Object.keys(probabilities)[0],
) {
  return { type: "choice", choice: selected, confidence: 0.8, probabilities };
}

/** A model that answers each question with `answer(questionId)`. */
function choiceClient(answer: (id: string) => unknown) {
  return mockClient(({ questions }) => ({
    model: "mock",
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(Object.keys(questions).map((id) => [id, answer(id)])),
  }));
}

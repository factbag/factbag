import { describe, expect, it } from "vitest";
import { predicate, query } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { mockClient, resolver } from "./testing/provider";

class Person {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

const sanctioned = predicate(
  "sanctioned",
  { person: Person },
  { description: "The person is currently designated." },
);

function standing(RETRACT: number) {
  return {
    type: "choice" as const,
    choice: RETRACT > 0.5 ? ("RETRACT" as const) : ("KEEP" as const),
    confidence: 0.9,
    probabilities: { KEEP: 1 - RETRACT, RETRACT },
  };
}

/** Answers each passage's question in order; a single answer applies to every passage. */
function clientWith(...answers: readonly unknown[]) {
  return mockClient((request) => ({
    model: "test",
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(
      Object.keys(request.questions).map((id, index) => [id, answers[index] ?? answers[0]]),
    ),
  }));
}

/** A person with a 2012 removal and a 2022 redesignation, read as conflicting evidence. */
function setup() {
  const kb = new KnowledgeBase();
  const volkov = new Person("volkov", "Dmitry Volkov");
  kb.entities.add(volkov);
  const corpus = new Corpus();
  const [removal, redesignation] = corpus.add([
    { documentId: "removal", text: "2012: Dmitry Volkov is removed from the SDN list." },
    { documentId: "redesignation", text: "2022: Dmitry Volkov is designated again." },
  ]);
  if (removal === undefined || redesignation === undefined) {
    throw new Error("Expected both documents");
  }
  const whole = (document: typeof removal) =>
    corpus.slice(document, { start: 0, end: document.text.length });
  const atom = sanctioned({ person: volkov });
  const denied = kb.denies(atom, { source: whole(removal).id });
  const asserted = kb.asserts(atom, { source: whole(redesignation).id });
  return { kb, corpus, volkov, atom, denied, asserted, removal, redesignation, whole };
}

async function settle(run: ReturnType<typeof resolver>) {
  await Promise.all([...run].map(async (job) => await job.execute()));
  return { kb: run.kb };
}

describe("resolver", () => {
  it("makes no requests until a job executes, with one job per contradiction", () => {
    const { kb, corpus } = setup();
    const client = clientWith(standing(0.9));

    const jobs = [...resolver(corpus, kb, { client })];

    expect(client.transport).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(1);
    expect(Object.keys(jobs[0] ?? {})).toEqual(["execute"]);
  });

  /** Answers are given per passage: the 2012 removal first, then the 2022 redesignation. */
  it.each([
    {
      outcome: "the superseded removal is retracted",
      answers: [0.9, 0.1],
      config: {},
      value: "true",
      kept: ["asserted"],
    },
    {
      outcome: "every passage stands",
      answers: [0.1],
      config: {},
      value: "conflicted",
      kept: ["denied", "asserted"],
    },
    {
      outcome: "a leading retraction below the minimum is ignored",
      answers: [0.55],
      config: { minimumProbability: 0.6 },
      value: "conflicted",
      kept: ["denied", "asserted"],
    },
    {
      outcome: "every passage is superseded",
      answers: [0.9],
      config: {},
      value: "unknown",
      kept: [],
    },
    {
      outcome: "a retraction within the ambiguity margin is ignored",
      answers: [0.6, 0.1],
      config: { minimumProbability: 0.5, ambiguityMargin: 0.3 },
      value: "conflicted",
      kept: ["denied", "asserted"],
    },
    {
      outcome: "a retraction beyond the default margin applies",
      answers: [0.6, 0.1],
      config: {},
      value: "true",
      kept: ["asserted"],
    },
  ])("settles a contradiction when $outcome", async ({ answers, config, value, kept }) => {
    // Arrange: the per-passage answers and settings come from the table.
    const { kb, corpus, atom, denied, asserted } = setup();
    const evidence: Record<string, unknown> = { denied, asserted };
    const client = clientWith(...answers.map((retract) => standing(retract)));

    // Act
    const { kb: resolved } = await settle(resolver(corpus, kb, { client, ...config }));

    // Assert
    expect(query(resolved, atom).value).toBe(value);
    expect(resolved.literals()).toEqual(kept.map((name) => evidence[name]));
    expect(kb.literals()).toEqual([denied, asserted]);
  });

  it("resolves contradictory evidence attached to separate instances of the same entity", async () => {
    // Arrange
    const { kb, corpus, denied, asserted, atom } = setup();
    kb.retract(denied);
    kb.denies(sanctioned({ person: new Person("volkov", "Dmitry Volkov") }), denied.metadata);
    const client = clientWith(standing(0.1), standing(0.9));

    // Act
    const { kb: resolved } = await settle(resolver(corpus, kb, { client }));

    // Assert
    expect(client.transport).toHaveBeenCalledOnce();
    expect(resolved.literals()).toEqual([asserted]);
    expect(query(resolved, atom).value).toBe("true");
  });

  it.each([
    {
      problem: "conflicting evidence has no source",
      message: "Cannot resolve sanctioned(ural): evidence without a source",
      add: (kb: KnowledgeBase, corpus: Corpus) => {
        // Volkov's contradiction is resolvable; Ural's is not, so no job is created for either.
        const ural = new Person("ural", "Ural Capital");
        kb.entities.add(ural);
        kb.asserts(sanctioned({ person: ural }), {
          source: corpus.slice({ documentId: "removal" }, { start: 0, end: 4 }).id,
        });
        kb.denies(sanctioned({ person: ural }));
      },
    },
    {
      problem: "a source is not a chunk ID",
      message: "Invalid chunk ID: registry",
      add: (kb: KnowledgeBase) => {
        kb.asserts(sanctioned({ person: new Person("volkov", "Dmitry Volkov") }), {
          source: "registry",
        });
      },
    },
  ])("throws during construction, before asking anything, when $problem", ({ add, message }) => {
    // Arrange: the unresolvable evidence comes from the table.
    const { kb, corpus } = setup();
    add(kb, corpus);
    const client = clientWith(standing(0.9));

    // Act
    const construct = () => resolver(corpus, kb, { client });

    // Assert
    expect(construct).toThrow(message);
    expect(client.transport).not.toHaveBeenCalled();
  });

  it("treats equal atoms as one proposition and ignores evidence without a contradiction", async () => {
    const kb = new KnowledgeBase();
    const volkov = new Person("volkov", "Dmitry Volkov");
    const ural = new Person("ural", "Ural Capital");
    kb.entities.add(volkov, ural);
    const corpus = new Corpus();
    const [document] = corpus.add([{ documentId: "d", text: "Volkov is listed. Ural is too." }]);
    if (document === undefined) {
      throw new Error("Expected a document");
    }
    const first = corpus.slice(document, { start: 0, end: 17 }).id;
    const second = corpus.slice(document, { start: 18, end: 30 }).id;
    kb.asserts(sanctioned({ person: volkov }), { source: first });
    kb.denies(sanctioned({ person: volkov }), { source: second });
    kb.asserts(sanctioned({ person: ural }), { source: second });
    const client = clientWith(standing(0.9), standing(0.1));

    const { kb: resolved } = await settle(resolver(corpus, kb, { client }));

    expect(client.transport).toHaveBeenCalledOnce();
    expect(query(resolved, sanctioned({ person: volkov })).value).toBe("false");
    expect(query(resolved, sanctioned({ person: ural })).value).toBe("true");
  });

  it("makes no requests for a knowledge base without contradictions", async () => {
    const { corpus } = setup();
    const client = clientWith(standing(0.9));

    const { kb: resolved } = await settle(resolver(corpus, new KnowledgeBase(), { client }));

    expect(resolved.literals()).toEqual([]);
    expect(client.transport).not.toHaveBeenCalled();
  });

  it("rejects an invalid judgement without retracting anything", async () => {
    // Arrange
    const { kb, corpus, denied, asserted } = setup();
    const run = resolver(corpus, kb, { client: clientWith({ type: "choice" }) });

    // Act
    const settled = settle(run);

    // Assert
    await expect(settled).rejects.toThrow("Invalid choice answer from test");
    expect(run.kb.literals()).toEqual([denied, asserted]);
  });

  it("settles a job once, but lets a failed job be retried", async () => {
    const { kb, corpus, atom } = setup();
    const client = clientWith(standing(0.9), standing(0.1));
    client.transport.mockRejectedValueOnce(new Error("network down"));
    const run = resolver(corpus, kb, { client });
    const [job] = [...run];
    if (job === undefined) {
      throw new Error("Expected a job");
    }

    await expect(job.execute()).rejects.toThrow("network down");
    expect(query(run.kb, atom).value).toBe("conflicted");
    await expect(job.execute()).resolves.toBeUndefined();
    await expect(job.execute()).rejects.toThrow(
      "The contradiction for sanctioned(volkov) is already settled",
    );
    expect(query(run.kb, atom).value).toBe("true");
  });
});

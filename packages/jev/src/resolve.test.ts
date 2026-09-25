import { describe, expect, it, vi } from "vitest";
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import type { AdjudicatorClient } from "./client";
import { resolver } from "./resolve";

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
  return {
    systemOne: vi.fn<AdjudicatorClient["systemOne"]>(
      async (request) =>
        await Promise.resolve({
          model: "test",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: Object.fromEntries(
            Object.keys(request.questions).map((id, index) => [
              id,
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tests also feed malformed answers.
              (answers[index] ?? answers[0]) as ReturnType<typeof standing>,
            ]),
          ),
        }),
    ),
  };
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
  const resolutions = [];
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Sequential, to keep assertions simple.
    resolutions.push(await job.execute());
  }
  return { kb: run.kb, resolutions };
}

describe("resolver", () => {
  it("makes no requests until a job executes, with one job per contradiction", () => {
    const { kb, corpus, atom, removal, redesignation } = setup();
    const client = clientWith(standing(0.9));

    const jobs = [...resolver(corpus, kb, { client })];

    expect(client.systemOne).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.atom).toBe(atom);
    expect(jobs[0]?.passages.map(({ documentId }) => documentId)).toEqual([
      removal.documentId,
      redesignation.documentId,
    ]);
  });

  it("retracts the superseded passage's evidence and keeps the rest", async () => {
    const { kb, corpus, atom, denied, asserted, removal, redesignation, whole } = setup();
    // The 2012 removal is superseded; the 2022 redesignation stands.
    const client = clientWith(standing(0.9), standing(0.1));

    const { kb: resolved, resolutions } = await settle(resolver(corpus, kb, { client }));

    expect(query(kb, atom).value).toBe("conflicted");
    expect(query(resolved, atom).value).toBe("true");
    expect(resolved.literals()).toEqual([asserted]);
    expect(resolutions).toEqual([
      {
        atom,
        judgments: [
          {
            passage: whole(removal),
            standing: "RETRACT",
            answer: standing(0.9),
            retracted: [denied],
          },
          {
            passage: whole(redesignation),
            standing: "KEEP",
            answer: standing(0.1),
            retracted: [],
          },
        ],
        kept: [asserted],
        retracted: [denied],
      },
    ]);
  });

  it("asks one question per passage, sending only the passages' text", async () => {
    const { kb, corpus, removal, redesignation } = setup();
    const client = clientWith(standing(0.1));

    await settle(resolver(corpus, kb, { client }));

    expect(client.systemOne).toHaveBeenCalledOnce();
    const [request] = client.systemOne.mock.calls[0] ?? [];
    // No chunk IDs, document IDs or ranges reach the model.
    expect(request?.state).toEqual({
      documents: [{ text: removal.text }, { text: redesignation.text }],
      candidate: { fields: { person: { id: "volkov", name: "Dmitry Volkov", type: "Person" } } },
    });
    expect(Object.keys(request?.questions ?? {})).toEqual(["passage_0", "passage_1"]);
    expect(request?.questions["passage_1"]?.instructions).toMatchObject({
      predicate: {
        name: "sanctioned",
        metadata: { description: "The person is currently designated." },
      },
    });
    expect(Object.keys(request?.questions["passage_1"]?.criteria ?? {})).toEqual([
      "KEEP",
      "RETRACT",
    ]);
  });

  it.each([
    { name: "every passage stands", retract: 0.1 },
    { name: "a retraction below the minimum probability", retract: 0.45 },
  ])("keeps all the evidence when $name", async ({ retract }) => {
    const { kb, corpus, atom, denied, asserted } = setup();

    const { kb: resolved, resolutions } = await settle(
      resolver(corpus, kb, { client: clientWith(standing(retract)) }),
    );

    expect(query(resolved, atom).value).toBe("conflicted");
    expect(resolutions[0]).toMatchObject({ kept: [denied, asserted], retracted: [] });
  });

  it("leaves the fact unknown when every passage is superseded", async () => {
    const { kb, corpus, atom, denied, asserted } = setup();

    const { kb: resolved, resolutions } = await settle(
      resolver(corpus, kb, { client: clientWith(standing(0.9)) }),
    );

    expect(query(resolved, atom).value).toBe("unknown");
    expect(resolutions[0]).toMatchObject({ kept: [], retracted: [denied, asserted] });
  });

  it("requires a retraction to lead by more than the ambiguity margin", async () => {
    const { kb, corpus, atom } = setup();
    const client = clientWith(standing(0.6), standing(0.1));

    const strict = await settle(
      resolver(corpus, kb, {
        client,
        admission: { minimumProbability: 0.5, ambiguityMargin: 0.3 },
      }),
    );
    const lenient = await settle(resolver(corpus, kb, { client }));

    expect(query(strict.kb, atom).value).toBe("conflicted");
    expect(query(lenient.kb, atom).value).toBe("true");
  });

  it("throws during construction when conflicting evidence has no source", () => {
    // Volkov's contradiction is resolvable; Ural's is not, so no job is created for either.
    const { kb, corpus } = setup();
    const ural = new Person("ural", "Ural Capital");
    kb.entities.add(ural);
    kb.asserts(sanctioned({ person: ural }), {
      source: corpus.slice({ documentId: "removal" }, { start: 0, end: 4 }).id,
    });
    kb.denies(sanctioned({ person: ural }));
    const client = clientWith(standing(0.9));

    expect(() => resolver(corpus, kb, { client })).toThrow(
      "Cannot resolve sanctioned(ural): evidence without a source",
    );
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("propagates corpus errors during construction for sources that are not chunk IDs", () => {
    const { kb, corpus, atom } = setup();
    kb.asserts(atom, { source: "registry" });
    const client = clientWith(standing(0.9));

    expect(() => resolver(corpus, kb, { client })).toThrow("Invalid chunk ID: registry");
    expect(client.systemOne).not.toHaveBeenCalled();
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

    expect(client.systemOne).toHaveBeenCalledOnce();
    expect(query(resolved, sanctioned({ person: volkov })).value).toBe("false");
    expect(query(resolved, sanctioned({ person: ural })).value).toBe("true");
  });

  it("makes no requests for a knowledge base without contradictions", async () => {
    const { corpus } = setup();
    const client = clientWith(standing(0.9));

    const { resolutions } = await settle(resolver(corpus, new KnowledgeBase(), { client }));

    expect(resolutions).toEqual([]);
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("rejects invalid or missing judgments", async () => {
    const { kb, corpus } = setup();
    await expect(
      settle(resolver(corpus, kb, { client: clientWith({ type: "choice" }) })),
    ).rejects.toThrow("Invalid or missing standing judgment");
    await expect(
      settle(
        resolver(corpus, kb, {
          client: clientWith({
            type: "choice",
            choice: "KEEP",
            confidence: 0.9,
            probabilities: { KEEP: 0.9, RETRACT: 0.5 },
          }),
        }),
      ),
    ).rejects.toThrow("Invalid standing distribution");
  });

  it("settles a job once, but lets a failed job be retried", async () => {
    const { kb, corpus, atom } = setup();
    const systemOne = vi
      .fn<AdjudicatorClient["systemOne"]>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({
        model: "test",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: { passage_0: standing(0.9), passage_1: standing(0.1) },
      });
    const run = resolver(corpus, kb, { client: { systemOne } });
    const [job] = [...run];
    if (job === undefined) {
      throw new Error("Expected a job");
    }

    await expect(job.execute()).rejects.toThrow("network down");
    expect(query(run.kb, atom).value).toBe("conflicted");
    await expect(job.execute()).resolves.toMatchObject({ retracted: [{ sign: "-" }] });
    await expect(job.execute()).rejects.toThrow(
      "The contradiction for sanctioned(volkov) is already settled",
    );
    expect(query(run.kb, atom).value).toBe("true");
  });
});

import { describe, expect, it, vi } from "vitest";
import { and, closedPredicate, or, variable } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import type { AnyLiteral } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import type { RecheckClient } from "./client";
import { evidenceBehind, recheck } from "./recheck";
import type { EvidenceChoice } from "./types";

class Person {
  constructor(readonly id: string) {}
}

const parent_of = closedPredicate(
  "parent_of",
  { parent: Person, child: Person },
  { description: "The first is the mother or father of the second." },
);
const grandparent_of = closedPredicate(
  "grandparent_of",
  { grandparent: Person, grandchild: Person },
  { description: "The first is a grandparent of the second." },
);
const sibling_of = closedPredicate(
  "sibling_of",
  { a: Person, b: Person },
  { description: "The two are siblings." },
);
const uncle_of = closedPredicate(
  "uncle_of",
  { uncle: Person, nibling: Person },
  { description: "The first is an uncle or aunt of the second." },
);
/** Two stated relationships over one ordered pair that the kinship rules do not allow together. */
const incompatible = closedPredicate("incompatible", { a: Person, b: Person });

const A = variable("A");
const B = variable("B");

function reading(ASSERT: number, IRRELEVANT = 1 - ASSERT, DENY = 0): EvidenceChoice {
  const choice =
    ASSERT >= Math.max(DENY, IRRELEVANT) ? "ASSERT" : DENY >= IRRELEVANT ? "DENY" : "IRRELEVANT";
  return { type: "choice", choice, confidence: 0.9, probabilities: { ASSERT, DENY, IRRELEVANT } };
}

type Answer = EvidenceChoice | ((call: number) => EvidenceChoice);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The predicate a request's questions are about, read structurally. */
function predicateNameOf(questions: unknown): string {
  if (!isRecord(questions)) {
    return "";
  }
  const [first] = Object.values(questions);
  if (!isRecord(first) || !isRecord(first["instructions"])) {
    return "";
  }
  const predicate = first["instructions"]["predicate"];
  return isRecord(predicate) ? String(predicate["name"]) : "";
}

/** The entity ids of each candidate in a request's state, joined with a dash. */
function candidateIdsOf(state: unknown): readonly string[] {
  if (!isRecord(state) || !Array.isArray(state["candidates"])) {
    return [];
  }
  return state["candidates"].map((candidate: unknown) =>
    isRecord(candidate) && isRecord(candidate["fields"])
      ? Object.values(candidate["fields"])
          .map((field) => (isRecord(field) ? String(field["id"]) : String(field)))
          .join("-")
      : "",
  );
}

/** The passage text a request carries, or undefined when it carries several documents. */
function documentTextOf(state: unknown): string | undefined {
  if (!isRecord(state) || "documents" in state || !isRecord(state["document"])) {
    return undefined;
  }
  const text = state["document"]["text"];
  return typeof text === "string" ? text : undefined;
}

/**
 * Answers by predicate and candidate index: `answers.parent_of[0]` is the first parent_of
 * candidate's rereading. A function answers by call count, for stateful fakes.
 */
function clientWith(answers: Readonly<Record<string, readonly Answer[]>>) {
  let calls = 0;
  const systemOne = vi.fn<RecheckClient["systemOne"]>(async (request) => {
    calls += 1;
    const byIndex = answers[predicateNameOf(request.questions)] ?? [];
    return await Promise.resolve({
      model: "test",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id, index) => {
          const given = byIndex[index] ?? byIndex[0] ?? reading(0.9);
          return [id, typeof given === "function" ? given(calls) : given];
        }),
      ),
    });
  });
  return { systemOne };
}

/**
 * "Molly, Jeanna's grandmother, had great ideas": the classifier read both a grandparent
 * and, wrongly, a parent fact from the sentence, and a sibling fact from the same passage.
 */
function setup() {
  const kb = new KnowledgeBase();
  const molly = new Person("Molly");
  const jeanna = new Person("Jeanna");
  const james = new Person("James");
  kb.entities.add(molly, jeanna, james);
  const corpus = new Corpus();
  const [doc] = corpus.add([
    {
      documentId: "story",
      text: "James's daughter Jeanna is planning a party. Molly, Jeanna's grandmother, had great ideas. James and his brother Sam came too.",
    },
  ]);
  if (doc === undefined) {
    throw new Error("Expected the document");
  }
  const passage = corpus.slice(doc, { start: 0, end: doc.text.length });
  const source = passage.id;
  const grand = kb.asserts(grandparent_of({ grandparent: molly, grandchild: jeanna }), {
    source,
    scores: { probability: 0.9 },
    annotations: { jev: { outcome: "ASSERT" } },
  });
  const parent = kb.asserts(parent_of({ parent: molly, child: jeanna }), {
    source,
    scores: { probability: 0.45 },
  });
  const sibling = kb.asserts(sibling_of({ a: james, b: molly }), { source });
  const jamesParent = kb.asserts(parent_of({ parent: james, child: jeanna }), { source });
  kb.rule(incompatible({ a: A, b: B })).iff(
    and(parent_of({ parent: A, child: B }), grandparent_of({ grandparent: A, grandchild: B })),
  );
  return { kb, corpus, passage, molly, jeanna, james, grand, parent, sibling, jamesParent };
}

describe("recheck", () => {
  it("derives the violation and traces it to the two stated facts, not the passage's others", () => {
    const { kb, molly, jeanna, grand, parent } = setup();
    const judgment = query(kb, incompatible({ a: molly, b: jeanna }));
    expect(judgment.value).toBe("true");
    expect(evidenceBehind(judgment)).toEqual([parent, grand]);
  });

  it("retracts only the fact the rereading no longer supports and keeps the rest of the passage", async () => {
    const { kb, corpus, passage, molly, jeanna, grand, parent, sibling, jamesParent } = setup();
    // Reread: the grandparent fact is stated, the parent fact is not.
    const client = clientWith({
      parent_of: [reading(0.1, 0.85, 0.05)],
      grandparent_of: [reading(0.95)],
    });

    const result = await recheck(corpus, kb, [incompatible({ a: A, b: B })], { client });

    expect(client.systemOne).toHaveBeenCalledTimes(2);
    expect(result.retracted).toEqual([parent]);
    expect(result.unresolved).toEqual([]);
    expect(result.kb.literals()).toEqual([grand, sibling, jamesParent]);
    // The input is untouched, and the survivors keep their metadata.
    expect(kb.literals()).toHaveLength(4);
    expect(grand.metadata?.scores).toEqual({ probability: 0.9 });
    expect(query(result.kb, incompatible({ a: molly, b: jeanna })).value).toBe("false");
    expect(query(result.kb, parent_of({ parent: molly, child: jeanna })).value).toBe("false");
    expect(query(result.kb, grandparent_of({ grandparent: molly, grandchild: jeanna })).value).toBe(
      "true",
    );
    const [round] = result.rounds;
    expect(round?.violations).toHaveLength(1);
    expect(
      round?.violations[0]?.verdicts.map(({ literal, standing, passage: at }) => [
        literal,
        standing,
        at.id,
      ]),
    ).toEqual([
      [parent, "RETRACT", passage.id],
      [grand, "KEEP", passage.id],
    ]);
    expect(round?.violations[0]?.verdicts[0]?.answer.probabilities).toEqual({
      ASSERT: 0.1,
      DENY: 0.05,
      IRRELEVANT: 0.85,
    });
  });

  it("asks only about the facts behind the violation, each atom once, against its own passage", async () => {
    const { kb, corpus } = setup();
    const client = clientWith({ parent_of: [reading(0.1)], grandparent_of: [reading(0.95)] });

    await recheck(corpus, kb, [incompatible({ a: A, b: B })], { client });

    const requests = client.systemOne.mock.calls.map(([request]) => request);
    const candidates = requests.flatMap((request) => candidateIdsOf(request.state));
    expect(candidates.sort()).toEqual(["Molly-Jeanna", "Molly-Jeanna"]);
    for (const request of requests) {
      expect(documentTextOf(request.state)).toContain("Molly, Jeanna's grandmother");
    }
  });

  it("makes no request and changes nothing when no violation is derived", async () => {
    const { kb, corpus, parent } = setup();
    kb.retract(parent);
    const client = clientWith({});

    const result = await recheck(corpus, kb, [incompatible({ a: A, b: B })], { client });

    expect(client.systemOne).not.toHaveBeenCalled();
    expect(result.rounds).toEqual([]);
    expect(result.retracted).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.kb.literals()).toEqual(kb.literals());
  });

  it("leaves a conflict open when the rereading confirms every fact, without looping", async () => {
    const { kb, corpus, molly, jeanna } = setup();
    const client = clientWith({ parent_of: [reading(0.8)], grandparent_of: [reading(0.9)] });

    const result = await recheck(corpus, kb, [incompatible({ a: A, b: B })], {
      client,
      maxRounds: 5,
    });

    expect(client.systemOne).toHaveBeenCalledTimes(2);
    expect(result.rounds).toHaveLength(1);
    expect(result.retracted).toEqual([]);
    expect(result.unresolved).toEqual([incompatible({ a: molly, b: jeanna })]);
    expect(result.kb.literals()).toEqual(kb.literals());
  });

  it("stops at maxRounds and reports what is still derived", async () => {
    const { kb, corpus, molly, jeanna, grand, parent } = setup();
    // A second way to the same violation, through an uncle fact over the same pair.
    const uncle = kb.asserts(uncle_of({ uncle: molly, nibling: jeanna }), {
      source: grand.metadata?.source ?? "",
    });
    const twice = closedPredicate("twice", { a: Person, b: Person });
    kb.rule(twice({ a: A, b: B })).iff(
      or(
        and(parent_of({ parent: A, child: B }), grandparent_of({ grandparent: A, grandchild: B })),
        and(uncle_of({ uncle: A, nibling: B }), grandparent_of({ grandparent: A, grandchild: B })),
      ),
    );
    // The parent fact falls on the first rereading; the uncle fact only on a later one.
    const client = () =>
      clientWith({
        parent_of: [reading(0.1)],
        grandparent_of: [reading(0.95)],
        uncle_of: [(call) => (call <= 3 ? reading(0.8) : reading(0.1))],
      });

    const one = await recheck(corpus, kb, [twice({ a: A, b: B })], {
      client: client(),
      maxRounds: 1,
    });
    expect(one.rounds).toHaveLength(1);
    expect(one.retracted).toEqual([parent]);
    expect(one.unresolved).toEqual([twice({ a: molly, b: jeanna })]);
    expect(one.kb.literals()).toContain(uncle);

    const two = await recheck(corpus, kb, [twice({ a: A, b: B })], {
      client: client(),
      maxRounds: 2,
    });
    expect(two.rounds).toHaveLength(2);
    expect(two.retracted).toEqual([parent, uncle]);
    expect(two.unresolved).toEqual([]);
  });

  it("refuses evidence without a source", async () => {
    const { kb, corpus, molly, jeanna, parent } = setup();
    kb.retract(parent);
    kb.asserts(parent_of({ parent: molly, child: jeanna }));

    await expect(
      recheck(corpus, kb, [incompatible({ a: A, b: B })], { client: clientWith({}) }),
    ).rejects.toThrow("evidence without a source");
  });

  it("rejects a non-positive round bound", async () => {
    const { kb, corpus } = setup();
    await expect(
      recheck(corpus, kb, [incompatible({ a: A, b: B })], { client: clientWith({}), maxRounds: 0 }),
    ).rejects.toThrow("maxRounds");
  });
});

describe("evidenceBehind", () => {
  it("follows only the alternatives that held", () => {
    const { kb, molly, jeanna, grand, parent } = setup();
    const uncle = kb.asserts(uncle_of({ uncle: molly, nibling: jeanna }), { source: "s" });
    const either = closedPredicate("either", { a: Person, b: Person });
    kb.rule(either({ a: A, b: B })).iff(
      or(
        and(parent_of({ parent: A, child: B }), grandparent_of({ grandparent: A, grandchild: B })),
        and(uncle_of({ uncle: A, nibling: B }), sibling_of({ a: A, b: B })),
      ),
    );
    const found: readonly AnyLiteral[] = evidenceBehind(query(kb, either({ a: molly, b: jeanna })));
    expect(found).toEqual([parent, grand]);
    expect(found).not.toContain(uncle);
  });
});

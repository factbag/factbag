import { describe, expect, it } from "vitest";
import { predicate } from "factbag/dsl";
import type { PredicateDeclaration } from "factbag/dsl";
import type { Chunk } from "factbag/corpus";
import { createChunkSymbolExtractor } from "./index";
import type { SymbolExtractorConfig } from "./index";

class Person {
  constructor(readonly id: string) {}
}
class Place {
  constructor(readonly id: string) {}
}

const paid = predicate(
  "paid",
  { payer: Person, memo: String, amount: Number, on: Date },
  {
    description: "The payer paid the amount on the date.",
    parameters: { amount: "Dollars paid." },
  },
);
const visited = predicate("visited", { visitor: Person, place: Place });

function chunk(text: string, id = "c0"): Chunk {
  return { documentId: "d", id, range: { start: 0, end: text.length }, text };
}

/** A Workers AI binding that records each request and answers from `respond`. */
function fakeBinding(respond: (inputs: Record<string, unknown>) => unknown) {
  const calls: { model: string; inputs: Record<string, unknown> }[] = [];
  const binding: NonNullable<SymbolExtractorConfig["binding"]> = {
    run: async (model, inputs) => {
      calls.push({ model, inputs });
      return await Promise.resolve(respond(inputs));
    },
  };
  return { binding, calls };
}

function answers(...values: unknown[]) {
  return {
    answers: Object.fromEntries(
      values.map((value, index) => [`f${index}`, { type: "list", value }]),
    ),
  };
}

describe("createChunkSymbolExtractor", () => {
  it("asks Clairic for each requested field and offers the values read for it", async () => {
    // Arrange
    const { binding, calls } = fakeBinding(() =>
      answers(["Alice Moore"], ["audit fee"], [1250.5, 2017], ["2024-03-03"], ["Bob"]),
    );
    const extractor = createChunkSymbolExtractor([chunk("Alice Moore paid $1,250.50.")], {
      binding,
      referenceDate: "2024-06-01",
      entities: [[Person, (name) => new Person(name)]],
    });

    // Act
    const answer = await extractor.query(
      new Map<PredicateDeclaration, readonly string[]>([
        [paid, ["payer", "memo", "amount", "on"]],
        [visited, ["visitor", "place"]],
      ]),
    );

    // Assert
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe("@cf/cloudflare/clairic");
    expect(calls[0]?.inputs).toMatchObject({
      state: "Alice Moore paid $1,250.50.",
      reference_date: "2024-06-01",
      fields: {
        f0: { type: "list", items: "text" },
        f1: { type: "list", items: "text" },
        f2: { type: "list", items: "number", decimals: 6 },
        f3: { type: "list", items: "date" },
        f4: { type: "list", items: "text" },
      },
    });
    /** Instructions carry the predicate's description and the field's own. */
    const sent = JSON.stringify(calls[0]?.inputs["fields"]);
    expect(sent).toContain("The payer paid the amount on the date.");
    expect(sent).toContain("Dollars paid.");
    /** Place has no factory, so its field is never sent. */
    expect(calls[0]?.inputs).not.toHaveProperty(["fields", "f5"]);
    expect(answer.get(paid)).toEqual({
      payer: [new Person("Alice Moore")],
      memo: ["audit fee"],
      amount: [1250.5, 2017],
      on: [new Date("2024-03-03T00:00:00Z")],
    });
    expect(answer.get(visited)).toEqual({ visitor: [new Person("Bob")], place: [] });
  });

  it("unions values across chunks without duplicates, skipping items it cannot read", async () => {
    // Arrange
    const replies = [
      answers([10, 20], ["2024-02-30", "2024-01-01"], null),
      answers([20, Number.NaN, "30"], ["2024-01-01"], ["  ", "fee"]),
    ];
    const { binding } = fakeBinding(() => replies.shift());
    const extractor = createChunkSymbolExtractor(
      [chunk("first", "c0"), chunk("   ", "blank"), chunk("second", "c1")],
      { binding },
    );

    // Act
    const answer = await extractor.query(new Map([[paid, ["amount", "on", "memo"]]]));

    // Assert
    expect(answer.get(paid)).toEqual({
      amount: [10, 20],
      on: [new Date("2024-01-01T00:00:00Z")],
      memo: ["fee"],
    });
  });

  /** Answers come back keyed per request, so each batch's keys must map to its own fields. */
  it("splits a query into requests of at most batchSize fields", async () => {
    // Arrange
    const read: Record<string, unknown[]> = {
      payer: ["Alice"],
      memo: ["fee"],
      amount: [2000],
      on: ["2015-01-01"],
    };
    // Each request's fields, in key order, name the field they ask about.
    const asked = (inputs: Record<string, unknown>): string[] =>
      [...JSON.stringify(inputs["fields"]).matchAll(/fill \\"(\w+)\\"/gu)].map(
        ([, field]) => field ?? "",
      );
    const { binding, calls } = fakeBinding((inputs) =>
      answers(...asked(inputs).map((field) => read[field])),
    );
    const extractor = createChunkSymbolExtractor([chunk("Alice paid a $2,000 fee.")], {
      binding,
      batchSize: 3,
      entities: [[Person, (name) => new Person(name)]],
    });

    // Act
    const answer = await extractor.query(new Map([[paid, ["payer", "memo", "amount", "on"]]]));

    // Assert
    expect(calls.map(({ inputs }) => asked(inputs))).toEqual([["payer", "memo", "amount"], ["on"]]);
    expect(answer.get(paid)).toEqual({
      payer: [new Person("Alice")],
      memo: ["fee"],
      amount: [2000],
      on: [new Date("2015-01-01T00:00:00Z")],
    });
  });

  it.each([0, 1.5, Number.NaN])("rejects a batchSize of %s at construction", (batchSize) => {
    // Act
    const create = () => createChunkSymbolExtractor([], { batchSize });

    // Assert
    expect(create).toThrow(RangeError);
  });

  it("sends nothing when no requested field can be asked about", async () => {
    // Arrange
    const { binding, calls } = fakeBinding(() => answers());
    const extractor = createChunkSymbolExtractor([chunk("Bob went to Paris.")], { binding });

    // Act
    const answer = await extractor.query(new Map([[visited, ["visitor", "place"]]]));

    // Assert
    expect(calls).toHaveLength(0);
    expect(answer.get(visited)).toEqual({ visitor: [], place: [] });
  });

  it.each([
    { reason: "no answers", reply: {} },
    { reason: "an omitted field", reply: { answers: {} } },
    { reason: "a value that is not a list", reply: { answers: { f0: { value: "fee" } } } },
  ])("rejects the query for $reason", async ({ reply }) => {
    // Arrange
    const { binding } = fakeBinding(() => reply);
    const extractor = createChunkSymbolExtractor([chunk("A fee.")], { binding });

    // Act
    const query = extractor.query(new Map([[paid, ["memo"]]]));

    // Assert
    await expect(query).rejects.toThrow(/Clairic/u);
  });

  it("posts to the account's REST endpoint and unwraps Cloudflare's envelope", async () => {
    // Arrange
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ url: url instanceof Request ? url.url : url.toString(), init });
      return await Promise.resolve(
        Response.json({ success: true, result: answers(["fee"]), errors: [] }),
      );
    };
    const extractor = createChunkSymbolExtractor([chunk("A fee.")], {
      accountId: "acct",
      apiToken: "token",
      fetch,
    });

    // Act
    const answer = await extractor.query(new Map([[paid, ["memo"]]]));

    // Assert
    expect(requests[0]?.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clairic",
    );
    expect(new Headers(requests[0]?.init?.headers).get("authorization")).toBe("Bearer token");
    expect(answer.get(paid)).toEqual({ memo: ["fee"] });
  });

  it("rejects the query when Workers AI rejects the request", async () => {
    // Arrange
    const fetch: typeof globalThis.fetch = async () =>
      await Promise.resolve(new Response("quota exceeded", { status: 429 }));
    const extractor = createChunkSymbolExtractor([chunk("A fee.")], {
      accountId: "acct",
      apiToken: "token",
      fetch,
    });

    // Act
    const query = extractor.query(new Map([[paid, ["memo"]]]));

    // Assert
    await expect(query).rejects.toThrow("429: quota exceeded");
  });

  it("rejects an entity factory for a scalar type at construction", () => {
    // Arrange
    const config: SymbolExtractorConfig = {
      // @ts-expect-error -- Untyped callers can pass a scalar type.
      entities: [[String, (name: string) => new Person(name)]],
    };

    // Act
    const create = () => createChunkSymbolExtractor([], config);

    // Assert
    expect(create).toThrow(TypeError);
  });
});

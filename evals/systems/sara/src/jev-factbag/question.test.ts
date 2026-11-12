import { TypeSafeClient } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { readQuestion } from "./question";
import { provisionFor } from "../statute";
import { Person } from "../statute/schema";
import { fakeClairic } from "./testing";

const alice = new Person("Alice");
const bob = new Person("Bob");

type Read = Readonly<Partial<Record<"person" | "year" | "amount", readonly unknown[]>>>;

/** A Jev endpoint that answers every choice question with `choice`. */
function choosing(choice: string): TypeSafeClient {
  const fetch: typeof globalThis.fetch = async () =>
    await Promise.resolve(
      Response.json({
        model: "fixture",
        answers: {
          reading: { type: "choice", choice, confidence: 1, probabilities: { [choice]: 1 } },
        },
        usage: { input_tokens: 10, output_tokens: 0 },
      }),
    );
  return new TypeSafeClient({
    apiKey: "test",
    fetch,
    compression: false,
    retry: { maxRetries: 0 },
  });
}

async function read(question: string, values: Read, client = choosing("option_1")) {
  const provision = provisionFor(question);
  if (provision === undefined) {
    throw new Error(`No provision for ${question}`);
  }
  const clairic = fakeClairic(({ relation, field }) =>
    relation === "asked"
      ? (Object.entries(values).find(([name]) => name === field)?.[1] ?? [])
      : [],
  );
  const reading = await readQuestion(question, provision, [alice, bob], { client, clairic });
  return {
    atom:
      reading.atom === undefined
        ? undefined
        : { predicate: reading.atom.predicate.name, fields: reading.atom.fields },
    reason: reading.reason,
    requests: reading.requests,
  };
}

describe("readQuestion", () => {
  /** Clairic may read names the case never mentions; they fill no role. */
  it("fills roles only with people the case text names", async () => {
    // Arrange
    const question = "Does section 7703(a)(2) apply to Alice in 2017?";

    // Act
    const reading = await read(question, { person: ["Alice", "Charlie"], year: [2017] });

    // Assert
    expect(reading).toEqual({
      atom: { predicate: "s7703_a_2", fields: { taxpayer: alice, year: 2017 } },
      reason: undefined,
      requests: 0,
    });
  });

  it("reads the year and amount Clairic reads as such", async () => {
    // Arrange
    const question = "Under section 151(a), can Alice claim an exemption of $4,000 for 2017?";

    // Act
    const reading = await read(question, { person: ["Alice"], year: [2017], amount: [4000] });

    // Assert
    expect(reading.atom).toEqual({
      predicate: "s151_a",
      fields: { taxpayer: alice, year: 2017, amount: 4000 },
    });
    expect(reading.requests).toBe(0);
  });

  /** A yes-or-no question about a provision with a valued form offers both readings. */
  it("asks Jev to choose between several readings", async () => {
    // Arrange
    const question = "Under section 63(c)(5), is Alice's basic standard deduction $500 in 2017?";

    // Act
    const reading = await read(
      question,
      { person: ["Alice"], year: [2017], amount: [500] },
      choosing("option_2"),
    );

    // Assert
    expect(reading.atom).toEqual({
      predicate: "s63_c_5_amount",
      fields: { taxpayer: alice, year: 2017, amount: 500 },
    });
    expect(reading.requests).toBe(1);
  });

  it("reads no question that names no calendar year", async () => {
    // Arrange
    const question = "Does section 7703(a)(2) apply to Alice?";

    // Act
    const reading = await read(question, { person: ["Alice"], year: [7703] });

    // Assert
    expect(reading).toEqual({ atom: undefined, reason: "no year named", requests: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { ground } from "./ground";
import { renderFields } from "../statute/record";
import { MeteredClient } from "./meter";
import { fakeClairic } from "./testing";

type Question = { type: string; instructions: { predicate?: { name: string } } };
type Wire = {
  state: { candidate_facts?: { fields: Record<string, unknown> }[] };
  questions: Record<string, Question>;
};

/**
 * A TypeSafe endpoint that keeps every predicate and value through routing and asserts
 * only the candidate facts `holds` accepts, so the test controls what the text "says".
 */
function endpoint(holds: (predicate: string, fields: Record<string, unknown>) => boolean) {
  const answer = ({ state }: Wire, question: Question) => {
    if (question.type === "noul") {
      return { type: "noul", noul: 1 };
    }
    const index = Number(/candidate_facts\[(\d+)\]/u.exec(JSON.stringify(question))?.[1]);
    const fields = state.candidate_facts?.[index]?.fields ?? {};
    const yes = holds(question.instructions.predicate?.name ?? "", fields);
    return {
      type: "choice",
      choice: yes ? "ASSERT" : "IRRELEVANT",
      confidence: 1,
      probabilities: { ASSERT: yes ? 1 : 0, DENY: 0, IRRELEVANT: yes ? 0 : 1 },
    };
  };
  const fetch: typeof globalThis.fetch = async (_, init) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The SDK sends the request as uncompressed JSON.
    const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Wire;
    const answers = Object.fromEntries(
      Object.entries(request.questions).map(([key, question]) => [key, answer(request, question)]),
    );
    return await Promise.resolve(
      Response.json({ model: "fixture", answers, usage: { input_tokens: 10, output_tokens: 0 } }),
    );
  };
  return new MeteredClient({ apiKey: "test", fetch, compression: false, retry: { maxRetries: 0 } });
}

function id(value: unknown): unknown {
  return typeof value === "object" && value !== null && "id" in value ? value.id : value;
}

describe("ground", () => {
  /** The case's people and dates reach the classifier only through Clairic. */
  it("admits the facts Jev asserts over the people and dates Clairic reads", async () => {
    // Arrange
    const text = "Alice and Bob got married on Feb 3rd, 1992. Charlie is Alice's brother.";
    const usage = { requests: 0, inputTokens: 0 };
    const clairic = fakeClairic(
      ({ items }) =>
        items === "text" ? ["Alice", "Bob", "Charlie"] : items === "date" ? ["1992-02-03"] : [],
      usage,
    );
    const client = endpoint(
      (predicate, fields) =>
        predicate === "married_on" &&
        id(fields["person"]) === "Alice" &&
        id(fields["spouse"]) === "Bob" &&
        String(fields["wedding_date"]).startsWith("1992-02-03"),
    );

    // Act
    const grounding = await ground(text, { client, clairic });

    // Assert
    expect(grounding.people.map((person) => person.id)).toEqual(["Alice", "Bob", "Charlie"]);
    expect(
      grounding.literals.map((literal) => [
        literal.sign,
        literal.atom.predicate.name,
        renderFields(literal.atom.fields),
      ]),
    ).toEqual([
      ["+", "married_on", { person: "Alice", spouse: "Bob", wedding_date: "1992-02-03" }],
    ]);
    expect(client.requests).toBeGreaterThan(0);
    expect(client.inputTokens).toBe(client.requests * 10);
    expect(usage.requests).toBeGreaterThan(0);
    expect(usage.inputTokens).toBe(usage.requests * 100);
  });
});

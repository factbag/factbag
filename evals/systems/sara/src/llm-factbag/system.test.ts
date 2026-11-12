import { describe, expect, it } from "vitest";
import { llmSystem } from "./system";
import { scripted } from "../models/conversation-testing";

const text = "Alice and Bob got married on Feb 3rd, 1992.";
const question = "Section 7703(a)(1) applies to Alice and Bob for the year 2015.";
const input = { text, question, statute: undefined };

/** A call of the one tool the model is given, running `operation` on `name` with `args`. */
const run = (operation: string, name: string, args: Readonly<Record<string, unknown>>) =>
  ["knowledge_base", { operation, name, arguments: JSON.stringify(args) }] as const;

const people = [run("add", "person", { id: "Alice" }), run("add", "person", { id: "Bob" })];
const marriage = run("assert", "married_on", {
  person: "Alice",
  spouse: "Bob",
  wedding_date: "1992-02-03",
  justification: "Stated.",
});
const asks = (year: number) =>
  run("query", "s7703_a_1", { taxpayer: "Alice", spouse: "Bob", year });

describe("llmSystem", () => {
  /** The answer must be the statute's, from the facts the model recorded, not the model's text. */
  it("answers with what the statute makes of the model's query over the facts it asserted", async () => {
    // Arrange
    const { connection } = scripted([...people, marriage], [asks(2015)]);

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBe("Entailment");
    expect(solution.detail).toMatchObject({
      people: ["Alice", "Bob"],
      facts: [
        {
          sign: "+",
          predicate: "married_on",
          fields: { person: "Alice", spouse: "Bob", wedding_date: "1992-02-03" },
        },
      ],
      atom: { predicate: "s7703_a_1", fields: { taxpayer: "Alice", spouse: "Bob", year: "2015" } },
      value: "true",
      turns: 2,
      outputTokens: 20,
    });
    expect(solution.usage).toEqual([
      { model: "fixture", requests: 2, inputTokens: 200, usd: (200 * 1 + 20 * 10) / 1_000_000 },
    ]);
  });

  /** Told the value, a model could revise its facts until the statute agreed with it. */
  it("ends the conversation at the first query, without telling the model its value", async () => {
    // Arrange
    const { connection, sent } = scripted([...people, marriage], [asks(1991), asks(2015)], "Done.");

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBe("Contradiction");
    expect(sent).toHaveLength(2);
  });

  it("leaves a case unanswered when the model never queries", async () => {
    // Arrange
    const { connection } = scripted([...people, marriage], "They were married in 2015.");

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBeUndefined();
    expect(solution.detail).toMatchObject({ unread: "no query", turns: 2 });
  });

  /** A person must be registered first; the model has to be told so it can retry. */
  it("returns a mistaken tool call to the model as an error and counts it", async () => {
    // Arrange
    const { connection, sent } = scripted([marriage], "Stopping.");

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(sent[1]?.at(-1)).toMatchObject({
      role: "tool",
      content: "Error: Unknown Person id for person: Alice",
    });
    expect(solution.detail).toMatchObject({ facts: [], toolErrors: 1 });
  });

  /** A reader that missed a fact can see from the explanation what the answer rested on. */
  it("tells a checked query's value and explanation, and answers with the last query", async () => {
    // Arrange
    const { connection, sent } = scripted(people, [asks(2015)], [marriage], [asks(2015)], "Done.");

    // Act
    const solution = await llmSystem(connection, "checked").solve(input);

    // Assert
    const told = String(sent[2]?.at(-1)?.["content"]);
    expect(told).toContain('"value":"false"');
    expect(told).toContain('"explanation":{"claim":"s7703_a_1(');
    expect(solution.answer).toBe("Entailment");
    expect(solution.detail).toMatchObject({ value: "true", queries: 2, turns: 5 });
  });

  /** A fact both asserted and denied leaves the statute's answer conflicted until one record goes. */
  it("has the model judge the records of a contradiction and asks the statute again", async () => {
    // Arrange
    const denial = run("deny", "married_on", {
      person: "Alice",
      spouse: "Bob",
      wedding_date: "1992-02-03",
      justification: "Misread.",
    });
    const verdict = ["judge", { record_1: "KEEP", record_2: "RETRACT" }] as const;
    const { connection, sent } = scripted([...people, marriage, denial], [asks(2015)], [verdict]);

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(String(sent[2]?.at(-1)?.["content"])).toContain(
      "Records:\n" +
        "record_1: asserts the fact. The reader's reason: Stated.\n" +
        "record_2: denies the fact. The reader's reason: Misread.",
    );
    expect(solution.answer).toBe("Entailment");
    expect(solution.detail).toMatchObject({
      facts: [{ sign: "+", predicate: "married_on" }],
      value: "true",
      contradictions: 1,
      retracted: 1,
    });
    expect(solution.usage).toHaveLength(2);
  });

  /** Keeping is the default, as it is for Jev: an answer that is no verdict changes nothing. */
  it("keeps every record of a contradiction the model does not judge", async () => {
    // Arrange
    const denial = run("deny", "married_on", {
      person: "Alice",
      spouse: "Bob",
      wedding_date: "1992-02-03",
      justification: "Misread.",
    });
    const { connection } = scripted([...people, marriage, denial], [asks(2015)], "Unsure.");

    // Act
    const solution = await llmSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBeUndefined();
    expect(solution.detail).toMatchObject({ value: "conflicted", contradictions: 1, retracted: 0 });
  });

  it("asks nothing of the model for a provision the statute does not cover", async () => {
    // Arrange
    const { connection, sent } = scripted("unused");

    // Act
    const solution = await llmSystem(connection).solve({
      ...input,
      question: "Section 9999(z) applies to Alice.",
    });

    // Assert
    expect(solution).toEqual({ answer: undefined, usage: [] });
    expect(sent).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { llmDirectSystem } from "./system";
import { scripted } from "../models/conversation-testing";

const input = {
  text: "Alice and Bob got married on Feb 3rd, 1992.",
  question: "Section 7703(a)(1) applies to Alice and Bob for the year 2015.",
  statute: "§7703. Determination of marital status",
};

describe("llmDirectSystem", () => {
  /** Reasoning may name both labels before settling; the final one is the verdict. */
  it("answers with the last label the model's reply names", async () => {
    // Arrange
    const { connection, sent } = scripted(
      "It might look like a Contradiction, but they were married.\nEntailment",
    );

    // Act
    const solution = await llmDirectSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBe("Entailment");
    expect(solution.usage).toEqual([
      { model: "fixture", requests: 1, inputTokens: 100, usd: (100 * 1 + 10 * 10) / 1_000_000 },
    ]);
    expect(String(sent[0]?.[1]?.["content"])).toContain(input.statute);
  });

  it("leaves a case unanswered when the reply names no label", async () => {
    // Arrange
    const { connection } = scripted("I cannot tell.");

    // Act
    const solution = await llmDirectSystem(connection).solve(input);

    // Assert
    expect(solution.answer).toBeUndefined();
  });

  it("asks nothing of the model when the data lacks the cited section", async () => {
    // Arrange
    const { connection, sent } = scripted("Entailment");

    // Act
    const solution = await llmDirectSystem(connection).solve({ ...input, statute: undefined });

    // Assert
    expect(solution).toEqual({ answer: undefined, usage: [] });
    expect(sent).toHaveLength(0);
  });
});

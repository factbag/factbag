import { describe, expect, it } from "vitest";
import { summarise } from "./metrics";

describe("summarise", () => {
  it("counts an unanswered case as wrong and brackets the accuracy", () => {
    // Arrange
    const outcomes = [
      { id: "1", gold: "Entailment", predicted: "Entailment" },
      { id: "2", gold: "Contradiction", predicted: "Entailment" },
      { id: "3", gold: "Entailment", predicted: undefined },
      { id: "4", gold: "Contradiction", predicted: "Contradiction" },
    ];

    // Act
    const summary = summarise(outcomes);

    // Assert
    expect(summary).toMatchObject({ cases: 4, correct: 2, unanswered: 1, accuracy: 0.5 });
    const [low, high] = summary.interval;
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(0.5);
    expect(high).toBeGreaterThanOrEqual(0.5);
    expect(high).toBeLessThanOrEqual(1);
  });

  it("gives the same interval for the same outcomes", () => {
    // Arrange
    const outcomes = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      gold: "yes",
      predicted: index % 3 === 0 ? "no" : "yes",
    }));

    // Act
    const first = summarise(outcomes);
    const second = summarise(outcomes);

    // Assert: the bootstrap is seeded, so results files are reproducible.
    expect(first.interval).toEqual(second.interval);
    expect(first.accuracy).toBeCloseTo(13 / 20);
  });

  it("summarises no cases as zero accuracy with an empty interval", () => {
    // Act
    const summary = summarise([]);

    // Assert
    expect(summary).toEqual({ cases: 0, correct: 0, unanswered: 0, accuracy: 0, interval: [0, 0] });
  });
});

import { describe, it } from "vitest";
import { expectFindings } from "../testing/helpers";

describe("aliases", () => {
  it("matches literal aliases at word boundaries with exact case", () => {
    // Arrange
    const phrases = ["NY", "A+B"];
    // Act / Assert
    expectFindings(
      "aliases",
      "NY NYU ny A+B NY",
      [
        { value: "NY", mentions: ["NY", "NY"] },
        { value: "A+B", mentions: ["A+B"] },
      ],
      phrases,
    );
  });

  it("does not match inside Unicode words", () => {
    // Arrange
    const phrases = ["NY"];
    // Act / Assert
    expectFindings("aliases", "éNY NYé NY_ NY2", [], phrases);
  });
});

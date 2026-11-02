import { describe, it } from "vitest";
import { expectFindings } from "../testing/helpers";

describe("names", () => {
  it("removes possessives without inventing pronoun referents", () => {
    // Arrange
    const text = "Alice's spouse met Bob. He left with her.";
    // Act / Assert
    expectFindings("names", text, [
      { value: "Alice", mentions: ["Alice"] },
      { value: "Bob", mentions: ["Bob"] },
    ]);
  });

  it("preserves multiword names and trailing Roman numerals", () => {
    // Arrange
    const text = "The Walter Brown Family Trust II met Émile. III applies.";
    // Act / Assert
    expectFindings("names", text, [
      { value: "Walter Brown Family Trust II", mentions: ["Walter Brown Family Trust II"] },
      { value: "Émile", mentions: ["Émile"] },
    ]);
  });

  it("does not join names across configured aliases or include date words", () => {
    // Arrange
    const text = "Alice NY Bob on Feb 3, 1992.";
    // Act / Assert
    expectFindings(
      "names",
      text,
      [
        { value: "Alice", mentions: ["Alice"] },
        { value: "Bob", mentions: ["Bob"] },
      ],
      ["NY"],
    );
  });

  it("merges repeated names while preserving each mention", () => {
    // Arrange
    const text = "Alice met Alice.";
    // Act / Assert
    expectFindings("names", text, [{ value: "Alice", mentions: ["Alice", "Alice"] }]);
  });
});

import { describe, expect, it } from "vitest";
import { names } from "./names";

describe("names", () => {
  it("reads each capitalised word as a name once, in order of first appearance", () => {
    // Arrange
    const text = "Alice and Bob got married. Alice died in 2014; Bob married Charlie.";

    // Act
    const found = names(text);

    // Assert
    expect(found.people).toEqual(["Alice", "Bob", "Charlie"]);
    expect(found.spans.map((span) => span.value)).toEqual([
      "Alice",
      "Bob",
      "Alice",
      "Bob",
      "Charlie",
    ]);
    expect(found.spans.map((span) => text.slice(span.start, span.end))).toEqual(
      found.spans.map((span) => span.value),
    );
  });

  it("joins adjacent capitalised words into one name, with a roman numeral at its end", () => {
    // Arrange
    const text = "The Walter Brown Family Trust II paid Alice. II applies here. Alice, Bob came.";

    // Act
    const found = names(text);

    // Assert: a numeral on its own starts no name, and punctuation keeps names apart.
    expect(found.people).toEqual(["Walter Brown Family Trust II", "Alice", "Bob"]);
  });

  it("leaves out months, function words and pronouns that open a sentence", () => {
    // Arrange
    const text = "Since October 5 2014 Alice has worked at Johns Hopkins University. She left.";

    // Act
    const found = names(text);

    // Assert: a capitalised institution is taken for a person, the scanner's known limit.
    expect(found.people).toEqual(["Alice", "Johns Hopkins University"]);
  });
});

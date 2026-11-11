import { describe, expect, it } from "vitest";
import { runOptions } from "./cli";

describe("runOptions", () => {
  it("reads ids, tag values by name, the limit and concurrency from the flags", () => {
    // Arrange
    const args = {
      cases: "a, b,",
      tag: ["citation=2(a),63(c)", "section=s2", "citation=151"],
      limit: "5",
      concurrency: "3",
    };

    // Act
    const options = runOptions(args, "/results");

    // Assert
    expect(options).toEqual({
      out: "/results",
      ids: ["a", "b"],
      tags: { citation: ["2(a)", "63(c)", "151"], section: ["s2"] },
      limit: 5,
      concurrency: 3,
    });
  });

  it.each([
    ["a tag without a value", { tag: ["citation"] }, "Pass --tag name=value,value, not citation"],
    ["a zero limit", { limit: "0" }, "--limit takes a positive whole number, not 0"],
    [
      "a fractional concurrency",
      { concurrency: "1.5" },
      "--concurrency takes a positive whole number, not 1.5",
    ],
  ])("rejects %s", (_, args, message) => {
    // Arrange: the malformed flag from the table.

    // Act
    const reading = (): unknown => runOptions(args, "/results");

    // Assert
    expect(reading).toThrow(message);
  });
});

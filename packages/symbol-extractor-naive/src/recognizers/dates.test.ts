import { describe, it } from "vitest";
import { expectFindings } from "../testing/helpers";

describe("dates", () => {
  it.each([
    { text: "Feb 29th, 2024", value: "2024-02-29" },
    { text: "14 Sept. 2015", value: "2015-09-14" },
    { text: "1992-02-03", value: "1992-02-03" },
  ])("recognizes the complete date $text", ({ text, value }) => {
    // Arrange: the table supplies the text and normalized date.
    // Act / Assert
    expectFindings("dates", `📅 ${text}.`, [{ value, mentions: [text] }]);
  });

  it.each(["Feb 30, 2024", "2023-02-29", "November 25th", "", "next Tuesday"])(
    "does not invent a complete date for %s",
    (text) => {
      // Arrange: the table supplies unsupported or invalid dates.
      // Act / Assert
      expectFindings("dates", text, []);
    },
  );
});

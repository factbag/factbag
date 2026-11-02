import { describe, it } from "vitest";
import { expectFindings } from "../testing/helpers";

describe("figures", () => {
  it.each([
    { text: "$2,000.50", figure: "2,000.50", value: 2000.5 },
    { text: "£-12.25", figure: "-12.25", value: -12.25 },
    { text: "40%", figure: "40", value: 40 },
    { text: "67 years old", figure: "67", value: 67 },
    { text: "equal to at most 22", figure: "22", value: 22 },
    { text: "in 1992", figure: "1992", value: 1992 },
  ])("recognizes the figure in $text", ({ text, figure, value }) => {
    // Arrange: the table supplies a phrase, its figure, and the expected value.
    // Act / Assert
    expectFindings("figures", text, [{ value, mentions: [figure] }]);
  });

  it("reads the parts of complete dates without forming ranges from them", () => {
    // Arrange
    const text = "Born Feb 3, 1992 and 1992-02-03.";
    // Act / Assert
    expectFindings("figures", text, [
      { value: 3, mentions: ["3", "03"] },
      { value: 1992, mentions: ["1992", "1992"] },
      { value: 2, mentions: ["02"] },
    ]);
  });

  it("does not split figures out of words or longer numbers", () => {
    // Arrange
    const text = "A12 v2.5 1,23456";
    // Act / Assert
    expectFindings("figures", text, []);
  });

  it.each([
    { text: "1992–93", start: 1992, end: 1993, parts: ["1992", "93"] },
    { text: "1999-02", start: 1999, end: 2002, parts: ["1999", "02"] },
  ])("expands the abbreviated interval $text", ({ text, start, end, parts }) => {
    // Arrange: the table supplies the interval, its bounds, and its written figures.
    // Act / Assert
    expectFindings("figures", `He was in NY from ${text}.`, [
      { value: start, mentions: [parts[0] ?? ""] },
      { value: Number(parts[1]), mentions: [parts[1] ?? ""] },
      { value: { start, end, precision: "year" }, mentions: [text] },
    ]);
  });

  it.each(["2015 to 2017", "between 2015 and 2017", "2015 through 2017"])(
    "recognizes the explicit interval %s",
    (text) => {
      // Arrange: the table supplies an explicit range.
      // Act / Assert
      expectFindings("figures", text, [
        { value: 2015, mentions: ["2015"] },
        { value: 2017, mentions: ["2017"] },
        { value: { start: 2015, end: 2017, precision: "year" }, mentions: [text] },
      ]);
    },
  );

  it.each(["2017 to 2015", "2015 and 2017"])("does not join %s into an interval", (text) => {
    // Arrange: the table supplies reversed or unrelated years.
    const [first, second] = text.split(/ (?:to|and) /u);
    // Act / Assert
    expectFindings("figures", text, [
      { value: Number(first), mentions: [first ?? ""] },
      { value: Number(second), mentions: [second ?? ""] },
    ]);
  });
});

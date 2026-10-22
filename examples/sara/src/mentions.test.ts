import { describe, expect, test } from "vitest";
import { iso } from "./calendar";
import { mentions } from "./mentions";

describe("mentions", () => {
  test("reads the date forms SARA uses and the people around them", () => {
    const found = mentions(
      "Alice and Bob got married on Feb 3rd, 1992. Alice died on July 9th, 2014. " +
        "Bob married Charlie on 14 Sept 2015. In 2016 Charlie was a nonresident alien.",
    );
    expect(found.people).toEqual(["Alice", "Bob", "Charlie"]);
    expect(found.dates.map(iso)).toEqual(["1992-02-03", "2014-07-09", "2015-09-14"]);
    expect(found.years).toEqual([2016]);
  });

  test("keeps years out of the dates and institutions out of the people", () => {
    const found = mentions(
      "Alice has worked at Johns Hopkins University in Baltimore, Maryland since October 5 2014.",
    );
    expect(found.people).toEqual(["Alice"]);
    expect(found.dates.map(iso)).toEqual(["2014-10-05"]);
    expect(found.years).toEqual([]);
  });

  test("reads the year a question asks about", () => {
    expect(mentions("Section 2(a)(1)(A) applies to Bob in 2015.").years).toEqual([2015]);
    expect(mentions("Section 7703(a)(2) applies to Alice for the year 2012.").people).toEqual([
      "Alice",
    ]);
  });
});

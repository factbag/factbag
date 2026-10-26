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
  });

  test("offers the years inside full dates as well as the years on their own", () => {
    const found = mentions(
      "Alice and Bob got married on Feb 3rd, 1992. In 2016 Charlie was a nonresident alien.",
    );
    expect(found.years).toEqual([1992, 2016]);
  });

  test("offers every year of a range the text states as one", () => {
    expect(mentions("From 2015 to 2019 Bob worked.").years).toEqual([2015, 2016, 2017, 2018, 2019]);
    expect(mentions("Between 2015 and 2018, Bob maintained the home.").years).toEqual([
      2015, 2016, 2017, 2018,
    ]);
    expect(mentions("Bob satisfied the test for the years 2017 through 2019.").years).toEqual([
      2017, 2018, 2019,
    ]);
    const text = "Charlie was a qualifying child of Bob from 2004 to 2006. In 2017 Bob retired.";
    const found = mentions(text);
    expect(found.years).toEqual([2004, 2005, 2006, 2017]);
    const range = found.spans.find((entry) => entry.kind === "range");
    expect(range?.value).toBe("2004 to 2006");
    expect(text.slice(range?.start, range?.end)).toBe("2004 to 2006");
  });

  test("does not fill in the years between two the text does not join", () => {
    expect(mentions("In 2015 Bob worked, and in 2019 he retired.").years).toEqual([2015, 2019]);
    expect(mentions("Bob worked in 2015 and 2019.").years).toEqual([2015, 2019]);
    // A range of days is two dates, not a range of years.
    const days = mentions("Alice employed Bob from Feb 1st, 2011 to November 19th, 2019.");
    expect(days.years).toEqual([2011, 2019]);
    expect(days.dates.map(iso)).toEqual(["2011-02-01", "2019-11-19"]);
    // Years out of order are not a range.
    expect(mentions("The figures went from 2019 to 2015 levels.").years).toEqual([2015, 2019]);
  });

  test("reads amounts, percentages and ages", () => {
    const found = mentions(
      "Alice paid each $1,250 and furnished 40% of the costs; Bob earned $300000. Alice is " +
        "67 years old.",
    );
    expect(found.amounts).toEqual([40, 67, 1250, 300000]);
  });

  test("reads the figure a value question asks about", () => {
    expect(mentions("Alice's standard deduction is equal to 22.").amounts).toEqual([22]);
    expect(mentions("The amount is equal to at most $500.").amounts).toEqual([500]);
  });

  test("does not read a dollar amount as a year", () => {
    const found = mentions("Alice's income in 2015 is $100000. She gets one exemption of $2000.");
    expect(found.years).toEqual([2015]);
    expect(found.amounts).toEqual([2000, 100000]);
  });

  test("does not make a day without a year into a date", () => {
    const found = mentions(
      "Alice employed Bob from Feb 1st, 2011 to November 19th, 2019. On November 25th, Bob " +
        "died. During the year 2017 Alice paid Bob on Jan 24 and on Oct 10.",
    );
    expect(found.dates.map(iso)).toEqual(["2011-02-01", "2019-11-19"]);
    expect(found.years).toEqual([2011, 2017, 2019]);
  });

  test("does not manufacture a person from a relative the text leaves unnamed", () => {
    expect(
      mentions(
        "Alice got married on Jan 6th, 2005. Alice files a joint return with her spouse for " +
          "2015. Alice's and her spouse's gross income for the year 2015 is $42876.",
      ).people,
    ).toEqual(["Alice"]);
    expect(
      mentions("Harold and Alice have a son, born Jan 25th, 2000. Harold died on Feb 28th, 2016.")
        .people,
    ).toEqual(["Harold", "Alice"]);
    expect(
      mentions("Since 2014, Alice maintains a house where she and her daughter lived.").people,
    ).toEqual(["Alice"]);
    expect(
      mentions("Alice and Bob got married in 1998. Their son Charlie was born October 1st, 2013.")
        .people,
    ).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("takes every capitalised word for a name except months and sentence openers", () => {
    const found = mentions(
      "Alice has worked at Johns Hopkins University in Baltimore, Maryland since October 5 2014.",
    );
    expect(found.people).toEqual(["Alice", "Johns Hopkins University", "Baltimore", "Maryland"]);
    expect(found.dates.map(iso)).toEqual(["2014-10-05"]);
  });

  test("reads adjacent capitalised words as one name, with a roman numeral at its end", () => {
    const text =
      "The Walter Brown Family Trust II was established on March 3rd, 1995. In 1999 Alice " +
      "and Bob paid it $500. Then Alice left.";
    const found = mentions(text);
    expect(found.people).toEqual(["Walter Brown Family Trust II", "Alice", "Bob"]);
    const trust = found.spans.find((entry) => entry.kind === "person");
    expect(trust).toBeDefined();
    expect(text.slice(trust?.start, trust?.end)).toBe("Walter Brown Family Trust II");
    // A numeral on its own starts no name, and punctuation between two names keeps them apart.
    expect(mentions("II applies here. Alice, Bob and Charlie came.").people).toEqual([
      "Alice",
      "Bob",
      "Charlie",
    ]);
    expect(
      mentions("Section 63(c)(6)(D) applies to the Walter Brown Family Trust II for 2021.").people,
    ).toEqual(["Section", "Walter Brown Family Trust II"]);
  });

  test("keeps every occurrence with its place in the text", () => {
    const text = "Alice paid Bob $500 on Feb 3rd, 1992. Alice paid $500 again in 1993.";
    const found = mentions(text);
    expect(
      found.spans.map((entry) => [entry.kind, entry.value, text.slice(entry.start, entry.end)]),
    ).toEqual([
      ["person", "Alice", "Alice"],
      ["person", "Bob", "Bob"],
      ["amount", "500", "$500"],
      ["date", "1992-02-03", "Feb 3rd, 1992"],
      ["year", "1992", "1992"],
      ["person", "Alice", "Alice"],
      ["amount", "500", "$500"],
      ["year", "1993", "1993"],
    ]);
    expect(found.people).toEqual(["Alice", "Bob"]);
    expect(found.amounts).toEqual([500]);
  });

  test("reads the year a question asks about", () => {
    expect(mentions("Section 2(a)(1)(A) applies to Bob in 2015.").years).toEqual([2015]);
    expect(mentions("Section 7703(a)(2) applies to Alice for the year 2012.").people).toEqual([
      "Section",
      "Alice",
    ]);
  });
});

import { and, closedPredicate, query, variable } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { describe, expect, it } from "vitest";
import { day } from "../day";
import { yearBounds, yearBoundsOf, yearMarks } from "./calendar";

const taxYear = closedPredicate("tax_year", { year: Number });
const bounds = closedPredicate("bounds", { year: Number, first: Date, last: Date });
const marks = closedPredicate("marks", { year: Number, julyFirst: Date, halfDays: Number });
const event = closedPredicate("event", { on: Date });
const eventYear = closedPredicate("event_year", { year: Number, first: Date, last: Date });
const Y = variable("Y");
const F = variable("F");
const L = variable("L");
const J = variable("J");
const H = variable("H");
const D = variable("D");

/** A knowledge base whose rules bind each helper's variables from a stated year or day. */
function calendarKB(year: number, on: string): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.asserts(taxYear({ year }));
  kb.asserts(event({ on: day(on) }));
  kb.rule(bounds({ year: Y, first: F, last: L })).iff(
    and(taxYear({ year: Y }), yearBounds(Y, F, L)),
  );
  kb.rule(marks({ year: Y, julyFirst: J, halfDays: H })).iff(
    and(taxYear({ year: Y }), yearMarks(Y, J, H)),
  );
  kb.rule(eventYear({ year: Y, first: F, last: L })).iff(
    and(event({ on: D }), yearBoundsOf(D, Y, F, L)),
  );
  return kb;
}

describe("calendar helpers", () => {
  it.each([
    // year, first, last, July 1, half the year's days rounded down
    [2017, "2017-01-01", "2017-12-31", "2017-07-01", 182],
    [2016, "2016-01-01", "2016-12-31", "2016-07-01", 183],
    [1900, "1900-01-01", "1900-12-31", "1900-07-01", 182],
  ])("bound %i and mark its July 1 and half-year length", (year, first, last, july, half) => {
    // Arrange: 2016 is a leap year; 1900 is a century that is not.
    const kb = calendarKB(year, first);

    // Act
    const bound = query(kb, bounds({ year, first: day(first), last: day(last) })).value;
    const marked = query(kb, marks({ year, julyFirst: day(july), halfDays: half })).value;

    // Assert
    expect([bound, marked]).toEqual(["true", "true"]);
  });

  it.each([
    ["the first day of a year", "2010-01-01", 2010],
    ["the last day of a year", "2010-12-31", 2010],
  ])("bounds the year %s falls in", (_name, on, year) => {
    // Arrange
    const kb = calendarKB(2000, on);

    // Act
    const result = query(
      kb,
      eventYear({ year, first: day(`${year}-01-01`), last: day(`${year}-12-31`) }),
    ).value;

    // Assert
    expect(result).toBe("true");
  });
});

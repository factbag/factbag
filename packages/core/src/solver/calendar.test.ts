import { describe, expect, it } from "vitest";
import { daysBetween, yearsBetween } from "./calendar";

describe("daysBetween", () => {
  it.each([
    ["autumn stay", "2015-12-31", "2015-09-01T23:00:00Z", 121],
    ["leap year", "2016-12-31", "2015-12-31", 366],
    ["same day", "2016-03-01", "2016-03-01T23:00:00Z", 0],
    ["reverse", "2016-03-01", "2016-03-02", -1],
    ["month end", "2021-03-01", "2021-01-31", 29],
    ["leap month end", "2020-03-01", "2020-02-28", 2],
    ["DST offset change", "2024-03-11T00:00:00-04:00", "2024-03-10T00:00:00-05:00", 1],
    ["UTC rather than local day", "2024-03-10T23:30:00-04:00", "2024-03-10T00:30:00-05:00", 1],
    ["before epoch", "1970-01-01", "1969-12-31T23:59:59Z", 1],
    ["year zero leap day", "0000-03-01", "0000-02-28", 2],
    ["year 99 boundary", "0100-01-01", "0099-12-31", 1],
  ])("counts UTC calendar days for %s", (_name, later, earlier, expected) => {
    // Arrange
    const end = new Date(later);
    const start = new Date(earlier);
    // Act
    const result = daysBetween(end, start);
    // Assert
    expect(result).toBe(expected);
  });
});

describe("yearsBetween", () => {
  it.each([
    ["year end", "2017-12-31", "1950-03-02", 67],
    ["before anniversary", "2015-03-01", "1950-03-02", 64],
    ["on anniversary", "2015-03-02", "1950-03-02", 65],
    ["month end", "2019-12-31", "2014-01-31", 5],
    ["before leap-day anniversary", "2017-02-28", "2000-02-29", 16],
    ["March anniversary", "2017-03-01", "2000-02-29", 17],
    ["leap anniversary", "2016-02-29", "2000-02-29", 16],
    ["first year", "2018-09-15", "2017-09-16", 0],
    ["reversed first year", "2017-09-16", "2018-09-15", 0],
    ["reverse", "2018-12-31", "2020-01-01", -1],
    ["reversed leap anniversary", "2000-02-29", "2017-02-28", -16],
    ["ignores anniversary time", "2015-03-02", "1950-03-02T23:59:59Z", 65],
    ["same day reversed time", "2015-03-02", "2015-03-02T23:59:59Z", 0],
    ["century is not a leap year", "2100-02-28", "2000-02-29", 99],
  ])("counts whole anniversary years for %s", (_name, later, earlier, expected) => {
    // Arrange
    const end = new Date(later);
    const start = new Date(earlier);
    // Act
    const result = yearsBetween(end, start);
    // Assert
    expect(result).toBe(expected);
  });
});

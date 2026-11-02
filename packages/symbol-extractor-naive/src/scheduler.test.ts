import { describe, expect, it, vi } from "vitest";
import { configure } from "./config";
import { recognizers } from "./recognizers";
import type { ScanInput } from "./recognizers/types";
import { scheduler } from "./scheduler";

const chunk = {
  id: "one",
  documentId: "one",
  range: { start: 0, end: 25 },
  text: "Alice met NY on Feb 3, 1992",
};
const settings = configure({ aliases: [{ text: "NY", value: "New York" }] });

describe("scheduler", () => {
  it("runs only requested recognizers and prerequisites, each once", () => {
    // Arrange
    const dates = vi.fn(recognizers.dates.scan);
    const aliases = vi.fn(recognizers.aliases.scan);
    const names = vi.fn(recognizers.names.scan);
    const recognize = scheduler([chunk], settings, {
      ...recognizers,
      dates: { ...recognizers.dates, scan: dates },
      aliases: { ...recognizers.aliases, scan: aliases },
      names: { ...recognizers.names, scan: names },
    });
    // Act / Assert
    recognize("figures");
    expect(dates).not.toHaveBeenCalled();
    recognize("dates");
    recognize("names");
    recognize("names");
    expect(dates).toHaveBeenCalledTimes(1);
    expect(aliases).toHaveBeenCalledTimes(1);
    expect(names).toHaveBeenCalledTimes(1);
  });

  it("gives a recognizer only its declared prerequisites' findings", () => {
    // Arrange
    const seen: ScanInput["prerequisites"][] = [];
    const recognize = scheduler([chunk], settings, {
      ...recognizers,
      names: {
        ...recognizers.names,
        scan: (input) => {
          seen.push(input.prerequisites);
          return recognizers.names.scan(input);
        },
      },
    });
    // Act
    recognize("figures");
    const result = recognize("names");
    // Assert
    expect([...(seen[0]?.keys() ?? [])]).toEqual(recognizers.names.requires);
    expect(seen[0]?.get("aliases")?.map(({ value }) => value)).toEqual(["NY"]);
    expect(result.map(({ value }) => value)).toEqual(["Alice"]);
  });

  it("freezes findings shared with later recognizers", () => {
    // Arrange
    const recognize = scheduler([chunk], settings, recognizers);
    // Act
    const [finding] = recognize("dates");
    // Assert
    expect(Object.isFrozen(finding)).toBe(true);
    expect(Object.isFrozen(finding?.mentions[0])).toBe(true);
  });

  it("rejects cyclic dependencies before scanning", () => {
    // Arrange
    const scan = vi.fn(recognizers.dates.scan);
    const recognize = scheduler([], settings, {
      ...recognizers,
      dates: { ...recognizers.dates, requires: ["names"], scan },
    });
    // Act / Assert
    expect(() => recognize("names")).toThrow("Cyclic recognizer dependency");
    expect(scan).not.toHaveBeenCalled();
  });
});

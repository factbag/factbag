import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "factbag/dsl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRecords, rebuild, toAtom } from "./saved";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sara-saved-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const wedding = {
  predicate: "married_on",
  fields: { person: "Alice", spouse: "Bob", wedding_date: "2017-02-03" },
};
const divorce = {
  predicate: "legally_separated",
  fields: { person: "Alice", spouse: "Bob", decree_date: "2018-05-06" },
};

describe("a saved run", () => {
  /** Replay and trace rest on this: a record's facts must come back as the facts they were. */
  it("rebuilds a case's asserted and denied facts over its people", () => {
    // Arrange
    const file = join(dir, "run.jsonl");
    const record = {
      id: "s7703_a_1_pos",
      tags: { section: "s7703", citation: "7703(a)(1)" },
      gold: "Entailment",
      answer: "Entailment",
      latencyMs: 10,
      usage: [],
      detail: {
        people: ["Alice", "Bob"],
        facts: [
          { sign: "+", ...wedding },
          { sign: "-", ...divorce },
        ],
        reading: 1,
      },
    };
    writeFileSync(file, `${JSON.stringify(record)}\n`);

    // Act
    const [saved] = readRecords(file);
    const { kb, people } = rebuild(saved?.detail ?? { people: [], facts: [], reading: 0 });

    // Assert
    expect([...people.keys()]).toEqual(["Alice", "Bob"]);
    expect(query(kb, toAtom(wedding.predicate, wedding.fields, people)).value).toBe("true");
    expect(query(kb, toAtom(divorce.predicate, divorce.fields, people)).value).toBe("false");
  });

  it("rejects a file that is not a run", () => {
    // Arrange
    const file = join(dir, "other.jsonl");
    writeFileSync(file, `${JSON.stringify({ model: "jev" })}\n`);

    // Act and assert
    expect(() => readRecords(file)).toThrow("Not a run record");
  });
});

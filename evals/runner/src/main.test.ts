import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./main";
import type { BenchmarkDefinition, SystemDefinition } from "./types";

type Label = "yes" | "no";

/** Loads one case per id in `--ids`, and counts its loads. */
function toy() {
  const loads = { count: 0 };
  const benchmark: BenchmarkDefinition<string, Label> = {
    flags: { ids: { type: "string", default: "a,b" } },
    load({ ids = "" }) {
      loads.count += 1;
      return {
        name: "toy",
        cases: ids.split(",").map((id) => ({ id, input: id, gold: "yes", tags: {} })),
      };
    },
  };
  return { benchmark, loads };
}

/** Answers what `--answer` says, and names itself after it. */
const fixed: SystemDefinition<string, Label> = {
  env: ["TOY_KEY"],
  concurrency: 1,
  flags: { answer: { type: "string", default: "yes" } },
  create({ answer }) {
    if (answer !== "yes" && answer !== "no") {
      throw new Error(`--answer takes yes or no, not ${answer}`);
    }
    return {
      name: `fixed-${answer}`,
      solve: async () => await Promise.resolve({ answer, usage: [] }),
    };
  },
};

/** Takes `--answer` too, with another default, and `--seed`, which `fixed` does not. */
const other: SystemDefinition<string, Label> = {
  env: [],
  concurrency: 1,
  flags: { answer: { type: "string", default: "no" }, seed: { type: "string" } },
  create: ({ answer }) => ({
    name: `other-${answer}`,
    solve: async () => await Promise.resolve({ answer: "no", usage: [] }),
  }),
};

const systems = { fixed, other };
const env = { TOY_KEY: "set" };

let out: string;
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), "eval-runner-"));
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(out, { recursive: true, force: true });
});

describe("main", () => {
  it("runs the named system on the benchmark with the flags given and writes to out", async () => {
    // Arrange
    const { benchmark } = toy();
    const argv = ["--system", "fixed", "--answer", "no", "--ids", "a,b,c", "--limit", "2"];

    // Act
    const summary = await main({ benchmark, systems, out, argv, env });

    // Assert
    expect(summary).toMatchObject({
      benchmark: "toy",
      system: "fixed-no",
      score: { cases: 2, correct: 0 },
    });
    expect(readdirSync(out).some((name) => name.startsWith("toy-fixed-no-"))).toBe(true);
  });

  /** Two systems may share a flag name; each must see its own default, not the other's. */
  it("gives each definition its own defaults", async () => {
    // Arrange
    const { benchmark } = toy();

    // Act
    const first = await main({ benchmark, systems, out, argv: ["--system", "fixed"], env });
    const second = await main({ benchmark, systems, out, argv: ["--system", "other"], env });

    // Assert
    expect(first).toMatchObject({ system: "fixed-yes", score: { cases: 2 } });
    expect(second).toMatchObject({ system: "other-no" });
  });

  it.each([
    ["no system", [], env, "Pass --system fixed|other"],
    ["an unknown system", ["--system", "nope"], env, "Pass --system fixed|other"],
    [
      "a flag of another system",
      ["--system", "fixed", "--seed", "1"],
      env,
      "--seed is not a flag of the system fixed",
    ],
    ["an unset environment variable", ["--system", "fixed"], {}, "Set TOY_KEY in your shell"],
    [
      "a flag the system rejects",
      ["--system", "fixed", "--answer", "maybe"],
      env,
      "--answer takes yes or no, not maybe",
    ],
  ])("refuses %s before loading the benchmark", async (_, argv, environment, message) => {
    // Arrange
    const { benchmark, loads } = toy();

    // Act
    const running = main({ benchmark, systems, out, argv, env: environment });

    // Assert
    await expect(running).rejects.toThrow(message);
    expect(loads.count).toBe(0);
  });
});

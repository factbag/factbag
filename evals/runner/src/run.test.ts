import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./run";
import type { Benchmark, System } from "./types";

type Label = "yes" | "no";

const benchmark: Benchmark<string, Label> = {
  name: "toy",
  cases: [
    { id: "a", input: "right", gold: "yes", tags: { kind: "odd" } },
    { id: "b", input: "wrong", gold: "yes", tags: { kind: "even" } },
    { id: "c", input: "none", gold: "no", tags: { kind: "odd" } },
    { id: "d", input: "throw", gold: "no", tags: { kind: "even" } },
  ],
};

/** Answers by its input: right, wrong, none or a throw, at one request of 10 tokens a case. */
const system: System<string, Label> = {
  name: "lookup",
  config: { version: 1 },
  async solve(input) {
    if (input === "throw") {
      throw new Error("model down");
    }
    const answer = input === "right" ? "yes" : input === "wrong" ? "no" : undefined;
    const usage = [{ model: "m", requests: 1, inputTokens: 10, usd: 0.5 }];
    return await Promise.resolve({ answer, usage, detail: { input } });
  },
};

let out: string;
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), "eval-runner-"));
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(out, { recursive: true, force: true });
});

function records(): readonly unknown[] {
  const file = readdirSync(out).find((name) => name.endsWith(".jsonl"));
  if (file === undefined) {
    throw new Error("No records written");
  }
  return readFileSync(join(out, file), "utf8")
    .trim()
    .split("\n")
    .map((line): unknown => JSON.parse(line));
}

describe("run", () => {
  it("scores the cases, counting unanswered and thrown cases as wrong", async () => {
    // Arrange: the toy benchmark has one right, one wrong, one unanswered and one throwing case.

    // Act
    const summary = await run(benchmark, system, { out });

    // Assert
    expect(summary.score).toMatchObject({ cases: 4, correct: 1, unanswered: 2, accuracy: 0.25 });
    expect(summary.byTag).toEqual({
      kind: { odd: { cases: 2, correct: 1 }, even: { cases: 2, correct: 0 } },
    });
    expect(summary.usage).toEqual({ m: { requests: 3, inputTokens: 30, usd: 1.5 } });
    expect(summary.usdPerCase).toBe(1.5 / 4);
    expect(summary.config).toEqual({ version: 1 });
  });

  it("writes one record per case, with the system's answer, usage and detail", async () => {
    // Arrange: the toy benchmark and lookup system.

    // Act
    await run(benchmark, system, { out });

    // Assert
    const written = records();
    expect(written).toMatchObject([
      {
        id: "a",
        tags: { kind: "odd" },
        gold: "yes",
        answer: "yes",
        usage: [{ model: "m", requests: 1, inputTokens: 10, usd: 0.5 }],
        detail: { input: "right" },
      },
      { id: "b", answer: "no" },
      { id: "c" },
      { id: "d", error: "model down", usage: [] },
    ]);
    expect(written[2]).not.toHaveProperty("answer");
    expect(readdirSync(out).sort()).toEqual([
      expect.stringMatching(/^toy-lookup-.+\.jsonl$/u),
      expect.stringMatching(/^toy-lookup-.+\.summary\.json$/u),
    ]);
  });

  it("solves only the cases selected by id and tag, up to the limit", async () => {
    // Arrange
    const solve = vi.spyOn(system, "solve");

    // Act
    const summary = await run(benchmark, system, {
      out,
      ids: ["a", "b", "c"],
      tags: { kind: ["odd"] },
      limit: 1,
    });

    // Assert
    expect(solve.mock.calls).toEqual([["right"]]);
    expect(summary.score.cases).toBe(1);
  });

  it("rejects a case id the benchmark does not have", async () => {
    // Arrange: an id outside the toy benchmark.

    // Act
    const running = run(benchmark, system, { out, ids: ["a", "z"] });

    // Assert
    await expect(running).rejects.toThrow("No case z in toy");
  });
});

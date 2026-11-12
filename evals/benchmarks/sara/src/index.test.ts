import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sara } from "./index";

let dataDir: string;

/** A SARA case file: Prolog with the text and question in `%` comment blocks. */
function writeCase(id: string, text: string, question: string): void {
  writeFileSync(
    join(dataDir, "cases", `${id}.pl`),
    `% Text\n% ${text}\n\n% Question\n% ${question}\n\n% Facts\nfact(x).\n\n% Test\n:- test.\n`,
  );
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "sara-"));
  for (const dir of ["cases", "splits", join("statutes", "source")]) {
    mkdirSync(join(dataDir, dir), { recursive: true });
  }
  writeFileSync(join(dataDir, "statutes", "source", "section2"), "  Section 2 text.\n");
  writeCase(
    "s2_a_pos",
    "Alice married Bob in 2017.",
    "Section 2(a)(1)(A) applies to Alice in 2018. Entailment",
  );
  writeCase(
    "s68_b_neg",
    "Bob earned $40,000.",
    "Section 68(b) applies to Bob in 2019. Contradiction",
  );
  writeCase("tax_case_1", "Carol earned $10,000.", "How much tax does Carol owe in 2019? $1200");
  writeCase("s2_b_pos", "Dan lives alone.", "Dan is single. Entailment");
  writeFileSync(join(dataDir, "splits", "train"), "s2_a_pos\ns68_b_neg\n\ntax_case_1\ns2_b_pos\n");
});
afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("sara", () => {
  it("loads a split's entailment cases with the statute section each question cites", () => {
    // Arrange: the fixture split holds two cited cases, a numeric case and an uncited case.

    // Act
    const benchmark = sara({ dataDir, split: "train" });

    // Assert
    expect(benchmark.name).toBe("sara-train");
    expect(benchmark.cases).toEqual([
      {
        id: "s2_a_pos",
        input: {
          text: "Alice married Bob in 2017.",
          question: "Section 2(a)(1)(A) applies to Alice in 2018.",
          statute: "Section 2 text.",
        },
        gold: "Entailment",
        tags: { section: "s2", citation: "2(a)(1)(A)" },
      },
      {
        id: "s68_b_neg",
        input: {
          text: "Bob earned $40,000.",
          question: "Section 68(b) applies to Bob in 2019.",
          statute: undefined,
        },
        gold: "Contradiction",
        tags: { section: "s68", citation: "68(b)" },
      },
      {
        id: "s2_b_pos",
        input: { text: "Dan lives alone.", question: "Dan is single.", statute: undefined },
        gold: "Entailment",
        tags: { section: "s2" },
      },
    ]);
  });

  it("rejects a question that ends in neither a label nor an amount", () => {
    // Arrange
    writeCase("s2_c", "Erin lives alone.", "Erin is single. Maybe");
    writeFileSync(join(dataDir, "splits", "test"), "s2_c\n");

    // Act
    const loading = (): unknown => sara({ dataDir, split: "test" });

    // Assert
    expect(loading).toThrow('Case s2_c: cannot read the answer from "Erin is single. Maybe"');
  });
});

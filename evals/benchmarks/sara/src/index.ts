/**
 * SARA, the StAtutory Reasoning Assessment (Holzenberger, Blair-Stanek and Van Durme,
 * 2020; MIT licence), as a benchmark: each case is a scenario and a statement about how a
 * section of the US tax code applies to it, labelled Entailment or Contradiction.
 *
 * The data is not vendored: pass the extracted `sara/` directory holding `cases/`,
 * `splits/` and `statutes/`. Only the English text, the question, the answer and the
 * statute sections are read; the Prolog facts and goals are never used.
 *
 * Only the entailment cases are loaded. The numeric cases, which ask how much tax a
 * person owes, are out of scope for now.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Benchmark, BenchmarkDefinition, Case } from "@factbag/eval-runner";

export type Split = "train" | "test";
export type SaraLabel = "Entailment" | "Contradiction";

export type SaraInput = Readonly<{
  /** The scenario. */
  text: string;
  /** The statement to judge, without its answer. */
  question: string;
  /** The text of the statute section the question cites, when the data holds it. */
  statute: string | undefined;
}>;

/**
 * SARA for the runner's command line: `--split train|test`, train unless said otherwise,
 * and `--data DIR`, the extracted `sara/` directory, which defaults to
 * `$FACTBAG_DATA_DIR/sara`.
 */
export const benchmark: BenchmarkDefinition<SaraInput, SaraLabel> = {
  flags: { split: { type: "string", default: "train" }, data: { type: "string" } },
  load({ split, data }) {
    if (split !== "train" && split !== "test") {
      throw new Error(`Unknown split ${split}`);
    }
    return sara({
      dataDir: data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "sara"),
      split,
    });
  },
};

/** The cases of one split. Each is tagged with its `section` and, when it cites one, its `citation`. */
export function sara(
  options: Readonly<{ dataDir: string; split: Split }>,
): Benchmark<SaraInput, SaraLabel> {
  const { dataDir, split } = options;
  const names = readFileSync(join(dataDir, "splits", split), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const statutes = new Map<string, string | undefined>();
  const statute = (section: string): string | undefined => {
    if (!statutes.has(section)) {
      const file = join(dataDir, "statutes", "source", `section${section}`);
      statutes.set(section, existsSync(file) ? readFileSync(file, "utf8").trim() : undefined);
    }
    return statutes.get(section);
  };
  return {
    name: `sara-${split}`,
    cases: names.flatMap((name) => {
      const item = parseCase(name, readFileSync(join(dataDir, "cases", `${name}.pl`), "utf8"));
      return item === undefined ? [] : [item];
    }),
  };

  /** The case, or nothing for a numeric case. */
  function parseCase(id: string, source: string): Case<SaraInput, SaraLabel> | undefined {
    const sections = commentBlocks(source);
    const text = sections.get("Text");
    const block = sections.get("Question");
    if (text === undefined || block === undefined) {
      throw new Error(`Case ${id} lacks a Text or Question block`);
    }
    const gold = parseLabel(id, block);
    if (gold === undefined) {
      return undefined;
    }
    const question = stripAnswer(block);
    const citation = citationOf(question);
    const section = id.startsWith("tax_case") ? "tax" : (/^(s\d+)/u.exec(id)?.[1] ?? "unknown");
    return {
      id,
      input: {
        text,
        question,
        statute: citation === undefined ? undefined : statute(/^\d+/u.exec(citation)?.[0] ?? ""),
      },
      gold,
      tags: { section, ...(citation === undefined ? {} : { citation }) },
    };
  }
}

const CITATION = /[Ss]ection\s+(\d+)((?:\([A-Za-z0-9]+\))*)/u;
const CITATIONS = new RegExp(CITATION.source, "gu");

/** The citation a question names, such as "2(a)(1)(A)", or undefined when it names none. */
export function citationOf(question: string): string | undefined {
  const match = CITATION.exec(question);
  return match === null ? undefined : `${match[1] ?? ""}${match[2] ?? ""}`;
}

/** The question with every citation taken out, so a reader does not take its numbers for figures. */
export function withoutCitations(question: string): string {
  return question.replace(CITATIONS, " ");
}

/** The Text and Question blocks are `%` comment lines under a `% Name` heading. */
function commentBlocks(source: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;
  let lines: string[] = [];
  const flush = (): void => {
    if (current !== undefined) {
      sections.set(current, lines.join("\n").trim());
    }
    lines = [];
  };
  for (const line of source.split("\n")) {
    const heading = /^%\s*(Text|Question|Facts|Test)\s*$/u.exec(line);
    if (heading?.[1] !== undefined) {
      flush();
      current = heading[1];
      continue;
    }
    if ((current === "Text" || current === "Question") && line.startsWith("%")) {
      const content = line.replace(/^%\s?/u, "").trim();
      if (content.length > 0) {
        lines.push(content);
      }
    }
  }
  flush();
  return sections;
}

/** The entailment label a question ends with, or nothing for a numeric one, which ends with a dollar amount. */
function parseLabel(id: string, question: string): SaraLabel | undefined {
  if (question.endsWith("Entailment")) {
    return "Entailment";
  }
  if (question.endsWith("Contradiction")) {
    return "Contradiction";
  }
  if (/\$\d+\s*$/u.test(question)) {
    return undefined;
  }
  throw new Error(`Case ${id}: cannot read the answer from ${JSON.stringify(question)}`);
}

function stripAnswer(question: string): string {
  return question.replace(/\s*(Entailment|Contradiction)$/u, "").trim();
}

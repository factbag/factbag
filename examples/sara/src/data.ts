/**
 * SARA (Holzenberger, Blair-Stanek and Van Durme, 2020; MIT licence). The data is not
 * vendored: it lives at $FACTBAG_DATA_DIR/sara or is passed with --data, as the
 * extracted `sara/` directory holding `cases/` and `splits/`. Only the English text,
 * the question and the answer are read; the Prolog facts and goals are never used.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Split = "train" | "test";
type Label = "Entailment" | "Contradiction";
type Answer =
  | Readonly<{ kind: "entailment"; label: Label }>
  | Readonly<{ kind: "numeric"; amount: number }>;

export type Case = Readonly<{
  id: string;
  /** The statute section the case was written for, from its file name, or "tax". */
  section: string;
  text: string;
  question: string;
  answer: Answer;
}>;

export function loadCases(dir: string, split: Split): readonly Case[] {
  const names = readFileSync(join(dir, "splits", split), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return names.map((name) =>
    parseCase(name, readFileSync(join(dir, "cases", `${name}.pl`), "utf8")),
  );
}

function parseCase(id: string, source: string): Case {
  const sections = commentBlocks(source);
  const text = sections.get("Text");
  const question = sections.get("Question");
  if (text === undefined || question === undefined) {
    throw new Error(`Case ${id} lacks a Text or Question block`);
  }
  return {
    id,
    section: id.startsWith("tax_case") ? "tax" : (/^(s\d+)/u.exec(id)?.[1] ?? "unknown"),
    text,
    question: stripAnswer(question),
    answer: parseAnswer(id, question),
  };
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

function parseAnswer(id: string, question: string): Answer {
  if (question.endsWith("Entailment")) {
    return { kind: "entailment", label: "Entailment" };
  }
  if (question.endsWith("Contradiction")) {
    return { kind: "entailment", label: "Contradiction" };
  }
  const amount = /\$(\d+)\s*$/u.exec(question);
  if (amount?.[1] !== undefined) {
    return { kind: "numeric", amount: Number(amount[1]) };
  }
  throw new Error(`Case ${id}: cannot read the answer from ${JSON.stringify(question)}`);
}

function stripAnswer(question: string): string {
  return question
    .replace(/\s*(Entailment|Contradiction)$/u, "")
    .replace(/\s*\$\d+\s*$/u, "")
    .trim();
}

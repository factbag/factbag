/**
 * ContractNLI (Koreeda and Manning, 2021), CC BY 4.0. The JSON files are untrusted input:
 * every field used is checked before it is trusted, and nothing else is read.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Label = "Entailment" | "Contradiction" | "NotMentioned";
export const LABELS: readonly Label[] = ["Entailment", "Contradiction", "NotMentioned"];
export type Split = "train" | "dev" | "test";

export type Hypothesis = Readonly<{ id: string; short: string; text: string }>;
export type Contract = Readonly<{
  id: number;
  fileName: string;
  text: string;
  gold: Readonly<Record<string, Label>>;
}>;
export type Dataset = Readonly<{
  split: Split;
  hypotheses: readonly Hypothesis[];
  contracts: readonly Contract[];
}>;

function isLabel(value: unknown): value is Label {
  return typeof value === "string" && (LABELS as readonly string[]).includes(value);
}

export function loadSplit(dir: string, split: Split): Dataset {
  const raw: unknown = JSON.parse(readFileSync(join(dir, `${split}.json`), "utf8"));
  if (!isRecord(raw) || !Array.isArray(raw["documents"]) || !isRecord(raw["labels"])) {
    throw new Error(`Unexpected ContractNLI layout in ${split}.json`);
  }
  const hypotheses = Object.entries(raw["labels"])
    .map(([id, value]): Hypothesis => {
      if (
        !isRecord(value) ||
        typeof value["hypothesis"] !== "string" ||
        typeof value["short_description"] !== "string"
      ) {
        throw new Error(`Malformed hypothesis ${id}`);
      }
      return { id, short: value["short_description"], text: value["hypothesis"] };
    })
    .sort((a, b) => hypothesisNumber(a.id) - hypothesisNumber(b.id));
  const ids = new Set(hypotheses.map((h) => h.id));
  const contracts = raw["documents"].map((doc: unknown): Contract => {
    if (!isRecord(doc) || typeof doc["id"] !== "number" || typeof doc["text"] !== "string") {
      throw new Error("Malformed document record");
    }
    const sets = doc["annotation_sets"];
    const first: unknown = Array.isArray(sets) ? sets[0] : undefined;
    if (!isRecord(first) || !isRecord(first["annotations"])) {
      throw new Error(`Document ${doc["id"]} has no annotations`);
    }
    const gold: Record<string, Label> = {};
    for (const [id, annotation] of Object.entries(first["annotations"])) {
      if (!ids.has(id) || !isRecord(annotation) || !isLabel(annotation["choice"])) {
        throw new Error(`Document ${doc["id"]}: malformed annotation ${id}`);
      }
      gold[id] = annotation["choice"];
    }
    if (Object.keys(gold).length !== hypotheses.length) {
      throw new Error(`Document ${doc["id"]} is missing hypotheses`);
    }
    return {
      id: doc["id"],
      fileName: typeof doc["file_name"] === "string" ? doc["file_name"] : "",
      text: doc["text"],
      gold,
    };
  });
  return { split, hypotheses, contracts };
}

function hypothesisNumber(id: string): number {
  return Number(id.replace(/^nda-/u, ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

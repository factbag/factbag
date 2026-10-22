/**
 * Re-derive labels from a Factbag run's stored observations under different admission
 * policies and conflict rules, without new requests. Mirrors the classifier's admission
 * (jobs.ts) and the query outcome for a predicate with only direct evidence.
 *
 * Usage: tsx src/rescore.ts results/authored/dev.jsonl --data DIR --split dev
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadSplit } from "./data";
import type { Label } from "./data";
import { score } from "./metrics";
import type { Judgment } from "./metrics";

type Probabilities = Readonly<Record<"ASSERT" | "DENY" | "IRRELEVANT", number>>;
type Stored = Readonly<{
  contractId: number;
  detail: { observations: Readonly<Record<string, readonly { probabilities: Probabilities }[]>> };
}>;
type Policy = Readonly<{
  minimumProbability: number;
  ambiguityMargin: number;
  conflict: "max" | "sum";
}>;

const { positionals, values: args } = parseArgs({
  allowPositionals: true,
  options: { data: { type: "string" }, split: { type: "string", default: "dev" } },
});
const file = positionals[0];
if (file === undefined) {
  throw new Error("Pass the results JSONL to rescore");
}
const split = args.split;
if (split !== "train" && split !== "dev" && split !== "test") {
  throw new Error(`Unknown split ${split}`);
}
const dataDir = args.data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "contract-nli");
const dataset = loadSplit(dataDir, split);
const stored: Stored[] = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((line): Stored => {
    const parsed: unknown = JSON.parse(line);
    if (!isStored(parsed)) {
      throw new Error("Unexpected results row");
    }
    return parsed;
  });

function isStored(value: unknown): value is Stored {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<Stored>;
  return typeof row.contractId === "number" && typeof row.detail?.observations === "object";
}
const byId = new Map(stored.map((row) => [row.contractId, row]));

function label(observations: readonly { probabilities: Probabilities }[], policy: Policy): Label {
  let asserts = 0;
  let denies = 0;
  let assertScore = 0;
  let denyScore = 0;
  for (const { probabilities } of observations) {
    const strongest = Math.max(probabilities.ASSERT, probabilities.DENY);
    if (probabilities.IRRELEVANT >= strongest) {
      continue;
    }
    for (const outcome of ["ASSERT", "DENY"] as const) {
      const p = probabilities[outcome];
      if (p >= policy.minimumProbability && strongest - p <= policy.ambiguityMargin) {
        if (outcome === "ASSERT") {
          asserts += 1;
          assertScore = policy.conflict === "max" ? Math.max(assertScore, p) : assertScore + p;
        } else {
          denies += 1;
          denyScore = policy.conflict === "max" ? Math.max(denyScore, p) : denyScore + p;
        }
      }
    }
  }
  if (asserts > 0 && denies > 0) {
    return denyScore > assertScore ? "Contradiction" : "Entailment";
  }
  if (asserts > 0) {
    return "Entailment";
  }
  if (denies > 0) {
    return "Contradiction";
  }
  return "NotMentioned";
}

function evaluate(policy: Policy): ReturnType<typeof score> {
  const judgments: Judgment[] = [];
  for (const contract of dataset.contracts) {
    const row = byId.get(contract.id);
    if (row === undefined) {
      continue;
    }
    for (const hypothesis of dataset.hypotheses) {
      const observations = row.detail.observations[hypothesis.id.replace("-", "_")] ?? [];
      judgments.push({
        contractId: contract.id,
        hypothesisId: hypothesis.id,
        gold: contract.gold[hypothesis.id] ?? "NotMentioned",
        predicted: label(observations, policy),
      });
    }
  }
  return score(judgments);
}

const pct = (value: number): string => (value * 100).toFixed(2).padStart(6);
process.stdout.write("minProb  margin  conflict  accuracy  macroF1   recE    recC    recN\n");
for (const conflict of ["max", "sum"] as const) {
  for (const ambiguityMargin of [0, 0.1, 0.2]) {
    for (const minimumProbability of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const m = evaluate({ minimumProbability, ambiguityMargin, conflict });
      process.stdout.write(
        `${minimumProbability.toFixed(1).padStart(7)}  ${ambiguityMargin.toFixed(1).padStart(6)}  ${conflict.padEnd(8)}  ` +
          `${pct(m.accuracy)}  ${pct(m.macroF1)}  ${pct(m.classes.Entailment.recall)}  ` +
          `${pct(m.classes.Contradiction.recall)}  ${pct(m.classes.NotMentioned.recall)}\n`,
      );
    }
  }
}

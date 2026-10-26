/**
 * Score a probe results file against the hand-written gold at several admission
 * thresholds: precision and recall over asserted facts, with the misses and false
 * positives at one threshold listed.
 *
 * Usage: pnpm --filter @factbag/sara-eval score-probe results/probe-<stamp>.json [--detail 0.8]
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { factKey, probeGold } from "./probe-gold";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { detail: { type: "string", default: "0.8" } },
});
const file = positionals[0];
if (file === undefined) {
  throw new Error("Pass a probe results file");
}

type Judgment = Readonly<{
  sign: "+" | "-";
  predicate: string;
  fields: Readonly<Record<string, string>>;
  probability: number;
}>;
type ProbeRecord = Readonly<{ id: string; admitted: readonly Judgment[] }>;

const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
const records = readRecords(parsed);
const gold = probeGold();
const detail = Number(args.detail);

function readRecords(value: unknown): readonly ProbeRecord[] {
  if (typeof value !== "object" || value === null || !("records" in value)) {
    throw new Error("Not a probe results file");
  }
  const list: unknown = value.records;
  if (!Array.isArray(list)) {
    throw new Error("Not a probe results file");
  }
  return list.map((item: unknown): ProbeRecord => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("admitted" in item) ||
      typeof item.id !== "string" ||
      !Array.isArray(item.admitted)
    ) {
      throw new Error("Malformed probe record");
    }
    // Each judgment was written by probe.ts with exactly these fields.
    return { id: item.id, admitted: item.admitted as readonly Judgment[] };
  });
}

process.stdout.write("threshold  precision  recall   tp   fp   fn  tolerated\n");
for (const threshold of [0.4, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tolerated = 0;
  const falsePositives: string[] = [];
  const misses: string[] = [];
  for (const record of records) {
    const expected = gold.get(record.id);
    if (expected === undefined) {
      throw new Error(`No gold for ${record.id}`);
    }
    const seen = new Set<string>();
    for (const judgment of record.admitted) {
      if (judgment.sign !== "+" || judgment.probability < threshold) {
        continue;
      }
      const key = factKey(judgment.predicate, judgment.fields);
      if (expected.gold.has(key)) {
        seen.add(key);
      } else if (expected.tolerated.has(key)) {
        tolerated += 1;
      } else {
        fp += 1;
        falsePositives.push(`${record.id} ${key} ${judgment.probability.toFixed(2)}`);
      }
    }
    tp += seen.size;
    fn += expected.gold.size - seen.size;
    for (const key of expected.gold) {
      if (!seen.has(key)) {
        misses.push(`${record.id} ${key}`);
      }
    }
  }
  const precision = tp + fp === 0 ? 0 : (tp / (tp + fp)) * 100;
  const recall = tp + fn === 0 ? 0 : (tp / (tp + fn)) * 100;
  process.stdout.write(
    `${threshold.toFixed(2).padEnd(10)} ${precision.toFixed(1).padStart(6)}%   ${recall.toFixed(1).padStart(6)}%  ` +
      `${String(tp).padStart(3)}  ${String(fp).padStart(3)}  ${String(fn).padStart(3)}  ${String(tolerated).padStart(4)}\n`,
  );
  if (threshold === detail) {
    process.stdout.write(
      `  missed at ${detail}:\n${misses.map((line) => `    ${line}`).join("\n")}\n`,
    );
    process.stdout.write(
      `  false positives at ${detail}:\n${falsePositives.map((line) => `    ${line}`).join("\n")}\n`,
    );
  }
}

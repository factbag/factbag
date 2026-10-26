/**
 * Set two saved runs side by side, story by story: an `eval` run and a `baseline` run on
 * the same selection. No requests are made. Prints and writes the agreement overall and by
 * clause length, with the stories each system alone got right.
 *
 * Usage: pnpm --filter @factbag/clutrr-eval compare --factbag results/<split>-staged-<stamp>.jsonl
 *        --direct results/baseline-<split>-<stamp>.jsonl [--out DIR]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    factbag: { type: "string" },
    direct: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
  },
});
if (args.factbag === undefined || args.direct === undefined) {
  throw new Error("Pass --factbag results/<run>.jsonl and --direct results/baseline-<run>.jsonl");
}

type Saved = Readonly<{
  id: string;
  length: number;
  gold: string;
  predicted?: string;
  requests: number;
  inputTokens: number;
  latencyMs: number;
}>;

function isSaved(value: unknown): value is Saved {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { gold?: unknown }).gold === "string" &&
    typeof (value as { length?: unknown }).length === "number"
  );
}

function read(file: string): ReadonlyMap<string, Saved> {
  const records = new Map<string, Saved>();
  for (const line of readFileSync(file, "utf8").trim().split("\n")) {
    const parsed: unknown = JSON.parse(line);
    if (!isSaved(parsed)) {
      throw new Error(`Not a saved record: ${line.slice(0, 80)}`);
    }
    records.set(parsed.id, parsed);
  }
  return records;
}

type Cell = { cases: number; factbag: number; direct: number; both: number; neither: number };

function cell(): Cell {
  return { cases: 0, factbag: 0, direct: 0, both: 0, neither: 0 };
}

const factbag = read(args.factbag);
const direct = read(args.direct);
const shared = [...factbag.values()].filter((record) => direct.has(record.id));
const overall = cell();
const byLength: Record<string, Cell> = {};
const factbagOnly: string[] = [];
const directOnly: string[] = [];
for (const record of shared) {
  const other = direct.get(record.id);
  const factbagRight = record.predicted === record.gold;
  const directRight = other?.predicted === record.gold;
  for (const entry of [overall, (byLength[String(record.length)] ??= cell())]) {
    entry.cases += 1;
    entry.factbag += factbagRight ? 1 : 0;
    entry.direct += directRight ? 1 : 0;
    entry.both += factbagRight && directRight ? 1 : 0;
    entry.neither += !factbagRight && !directRight ? 1 : 0;
  }
  if (factbagRight && !directRight) {
    factbagOnly.push(record.id);
  } else if (directRight && !factbagRight) {
    directOnly.push(record.id);
  }
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
}
const cost = (records: readonly Saved[]): Record<string, number> => ({
  requests: records.reduce((sum, r) => sum + r.requests, 0),
  inputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
  medianLatencyMs: medianOf(records.map((r) => r.latencyMs)),
});

const summary = {
  factbag: basename(args.factbag),
  direct: basename(args.direct),
  overall,
  byLength,
  factbagOnly,
  directOnly,
  cost: {
    factbag: cost(shared),
    direct: cost(shared.map((r) => direct.get(r.id)).filter((r) => r !== undefined)),
  },
  ranAt: new Date().toISOString(),
};
mkdirSync(args.out, { recursive: true });
const stamp = summary.ranAt.replace(/[:.]/gu, "-");
const file = join(args.out, `compare-${stamp}.summary.json`);
writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);

const percent = (part: number, whole: number): string =>
  whole === 0 ? "-" : `${((part / whole) * 100).toFixed(1)}%`;
const rows = [...Object.entries(byLength)]
  .sort(([a], [b]) => Number(a) - Number(b))
  .concat([["all", overall]])
  .map(
    ([length, entry]) =>
      `${length.padEnd(6)} ${String(entry.cases).padStart(5)}  ` +
      `${String(entry.factbag).padStart(4)} (${percent(entry.factbag, entry.cases).padStart(6)})  ` +
      `${String(entry.direct).padStart(4)} (${percent(entry.direct, entry.cases).padStart(6)})  ` +
      `${String(entry.both).padStart(4)}  ${String(entry.neither).padStart(7)}`,
  )
  .join("\n");
process.stdout.write(
  `${String(shared.length)} shared stories\n` +
    `k      cases  factbag        direct         both  neither\n${rows}` +
    `\nFactbag only ${String(factbagOnly.length)}, direct only ${String(directOnly.length)}\n` +
    `Factbag: ${String(summary.cost.factbag["requests"])} requests, ${String(summary.cost.factbag["inputTokens"])} tokens, ` +
    `median ${String(summary.cost.factbag["medianLatencyMs"])} ms/case; ` +
    `direct: ${String(summary.cost.direct["requests"])} requests, ${String(summary.cost.direct["inputTokens"])} tokens, ` +
    `median ${String(summary.cost.direct["medianLatencyMs"])} ms/case\n` +
    `Wrote ${basename(file)}\n`,
);

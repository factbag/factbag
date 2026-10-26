/**
 * Re-solve a past run's cases from the facts and question readings it saved, under the
 * current rules, with no requests. A regression check for rule changes while extraction
 * and reading stay the same: it says which answers changed and how long the solver took.
 *
 * Usage: pnpm --filter @factbag/sara-eval replay --facts results/train-....jsonl [--out DIR]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Atom } from "@factbag/core/dsl";
import { variable } from "@factbag/core/dsl";
import { query, queryAll } from "@factbag/core/query";
import { loadCases } from "./data";
import { summarise } from "@factbag/eval-shared/metrics";
import type { Outcome } from "@factbag/eval-shared/metrics";
import { provisionFor, readQuestionOffline } from "./question";
import { readRecords, rebuild, toAtom } from "./saved";
import type { SavedRecord } from "./saved";
import { EXTRACTION_VERSION } from "./schema";
import type { Person } from "./schema";
import { TAX_QUESTION } from "./statute";

const { values: args } = parseArgs({
  options: {
    facts: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
    data: { type: "string" },
    split: { type: "string", default: "train" },
  },
});
if (args.facts === undefined) {
  throw new Error("Pass --facts results/<run>.jsonl");
}

type Replayed = Readonly<{
  id: string;
  citation: string | undefined;
  gold: string;
  before: string | undefined;
  predicted: string | undefined;
  value: string;
  solverMs: number;
}>;

// With the data directory, a record whose question went unread, or whose query threw, is
// read again offline: possible when only one reading exists, which needs no request.
const dataDir = args.data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "sara");
const questions = new Map(
  existsSync(dataDir)
    ? loadCases(dataDir, args.split === "test" ? "test" : "train").map((item) => [item.id, item])
    : [],
);
function savedAtom(record: SavedRecord, people: ReadonlyMap<string, Person>): Atom | undefined {
  if (record.atom !== undefined) {
    return toAtom(record.atom.predicate, record.atom.fields, people);
  }
  const item = questions.get(record.id);
  if (item === undefined) {
    return undefined;
  }
  const provision = item.answer.kind === "numeric" ? TAX_QUESTION : provisionFor(item.question);
  return provision === undefined
    ? undefined
    : readQuestionOffline(item.question, provision, [...people.values()]);
}

const records = readRecords(args.facts);
const replayed: Replayed[] = [];
for (const record of records) {
  const { kb, people } = rebuild(record);
  const atom = record.facts === undefined ? undefined : savedAtom(record, people);
  if (atom === undefined || record.facts === undefined) {
    replayed.push({
      id: record.id,
      citation: record.citation,
      gold: record.gold,
      before: record.predicted,
      predicted: undefined,
      value: record.value,
      solverMs: 0,
    });
    continue;
  }
  const began = performance.now();
  let value: string;
  let predicted: string | undefined;
  if (record.open === true) {
    const amounts = queryAll(kb, {
      ...atom,
      fields: { ...atom.fields, amount: variable("Amount") },
    })
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => judgment.goal.atom.fields["amount"])
      .filter((amount): amount is number => typeof amount === "number");
    value = amounts.length === 0 ? "no amount" : amounts.map(String).join(" | ");
    predicted = amounts.length === 1 ? String(amounts[0]) : undefined;
  } else {
    value = query(kb, atom).value;
    predicted = value === "true" ? "Entailment" : value === "false" ? "Contradiction" : undefined;
  }
  const solverMs = performance.now() - began;
  replayed.push({
    id: record.id,
    citation: record.citation,
    gold: record.gold,
    before: record.predicted,
    predicted,
    value,
    solverMs,
  });
  const mark = predicted === record.gold ? "ok " : "BAD";
  const change = predicted === record.predicted ? "" : ` (was ${record.predicted ?? "none"})`;
  process.stdout.write(
    `  ${mark} ${record.id}: ${value} (${predicted ?? "none"} / ${record.gold})${change}, ${solverMs.toFixed(0)} ms\n`,
  );
}

const outcomes: Outcome[] = replayed.map(({ id, gold, predicted }) => ({ id, gold, predicted }));
const run = summarise(outcomes);
const before = summarise(
  replayed.map(({ id, gold, before: predicted }) => ({ id, gold, predicted })),
);
const solverTimes = replayed.map((item) => item.solverMs).sort((left, right) => left - right);
const median = solverTimes[Math.floor(solverTimes.length / 2)] ?? 0;
const changed = replayed.filter((item) => item.predicted !== item.before);
const summary = {
  facts: basename(args.facts),
  extraction: EXTRACTION_VERSION,
  run,
  before,
  changed: Object.fromEntries(
    changed.map((item) => [
      item.id,
      `${item.before ?? "none"} -> ${item.predicted ?? "none"} (gold ${item.gold})`,
    ]),
  ),
  solverMs: {
    median: Math.round(median),
    max: Math.round(solverTimes[solverTimes.length - 1] ?? 0),
  },
  ranAt: new Date().toISOString(),
};
mkdirSync(args.out, { recursive: true });
const stamp = summary.ranAt.replace(/[:.]/gu, "-");
const base = join(args.out, `replay-${stamp}`);
writeFileSync(`${base}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(`${base}.jsonl`, `${replayed.map((item) => JSON.stringify(item)).join("\n")}\n`);
process.stdout.write(
  `\n${run.correct}/${run.cases} correct (was ${before.correct}/${before.cases}), ` +
    `${run.unanswered} unanswered, ${changed.length} changed; solver median ${summary.solverMs.median} ms, ` +
    `max ${summary.solverMs.max} ms\nWrote ${base}.summary.json\n`,
);

/**
 * Re-solve a past run's cases from the facts and question readings it saved, under the
 * current rules, with no requests. A regression check for rule changes while extraction
 * and reading stay the same: it says which answers changed and how long the solver took.
 *
 * Usage: pnpm --filter @factbag/sara-eval replay --facts results/train-....jsonl [--out DIR]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import { query, queryAll } from "@factbag/core/query";
import { variable } from "@factbag/core/dsl";
import { day } from "./calendar";
import { summarise } from "./metrics";
import type { Outcome } from "./metrics";
import { EXTRACTION_VERSION, FACT_PREDICATES, Person } from "./schema";
import { PROVISIONS, statuteKB, TAX_QUESTION } from "./statute";

const { values: args } = parseArgs({
  options: {
    facts: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
  },
});
if (args.facts === undefined) {
  throw new Error("Pass --facts results/<run>.jsonl");
}

type SavedFact = Readonly<{ sign: string; predicate: string; fields: Record<string, string> }>;
type SavedRecord = Readonly<{
  id: string;
  citation: string | undefined;
  gold: string;
  predicted: string | undefined;
  value: string;
  atom?: Readonly<{ predicate: string; fields: Record<string, string> }>;
  open?: true;
  people?: readonly string[];
  facts?: readonly SavedFact[];
}>;

const byName = new Map<string, PredicateDeclaration>();
for (const declaration of FACT_PREDICATES) {
  byName.set(declaration.name, declaration);
}
for (const provision of [...PROVISIONS, TAX_QUESTION]) {
  for (const declaration of [provision.predicate, provision.valued]) {
    if (declaration !== undefined) {
      byName.set(declaration.name, declaration);
    }
  }
}

/** Parse a rendered field back by the predicate's declared type. */
function parseField(
  declaration: PredicateDeclaration,
  name: string,
  text: string,
  people: ReadonlyMap<string, Person>,
): unknown {
  const type = declaration.params[name];
  if (type === Person) {
    const person = people.get(text);
    if (person === undefined) {
      throw new Error(`Unknown person ${text} in ${declaration.name}`);
    }
    return person;
  }
  if (type === Date) {
    return day(text);
  }
  if (type === BigInt) {
    return BigInt(text);
  }
  if (type === Number) {
    return Number(text);
  }
  if (type === Boolean) {
    return text === "true";
  }
  return text;
}

function toAtom(
  predicate: string,
  fields: Record<string, string>,
  people: ReadonlyMap<string, Person>,
): GroundAtom {
  const declaration = byName.get(predicate);
  if (declaration === undefined) {
    throw new Error(`Unknown predicate ${predicate}`);
  }
  const parsed: Record<string, unknown> = {};
  for (const [name, text] of Object.entries(fields)) {
    parsed[name] = parseField(declaration, name, text, people);
  }
  return { predicate: declaration, fields: parsed };
}

function isSavedRecord(value: unknown): value is SavedRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { gold?: unknown }).gold === "string"
  );
}

const records: SavedRecord[] = readFileSync(args.facts, "utf8")
  .trim()
  .split("\n")
  .map((line): unknown => JSON.parse(line))
  .filter(isSavedRecord);

type Replayed = Readonly<{
  id: string;
  citation: string | undefined;
  gold: string;
  before: string | undefined;
  predicted: string | undefined;
  value: string;
  solverMs: number;
}>;

const replayed: Replayed[] = [];
for (const record of records) {
  if (record.atom === undefined || record.facts === undefined) {
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
  const people = new Map((record.people ?? []).map((name) => [name, new Person(name)]));
  const kb = statuteKB();
  kb.entities.add(...people.values());
  for (const fact of record.facts) {
    const atom = toAtom(fact.predicate, fact.fields, people);
    if (fact.sign === "+") {
      kb.asserts(atom);
    } else {
      kb.denies(atom);
    }
  }
  const atom = toAtom(record.atom.predicate, record.atom.fields, people);
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

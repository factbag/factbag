/**
 * Run the SARA entailment cases of one split through grounding, question reading and the
 * statute, and score the answers.
 *
 * Usage: pnpm --filter @factbag/sara-eval eval --split train|test [--citation 2(a)(1)(A),...]
 *        [--limit N] [--concurrency N] [--model jev-1.13.0] [--data DIR] [--out DIR]
 *
 * Data: DIR is the extracted SARA directory holding cases/ and splits/; defaults to
 * $FACTBAG_DATA_DIR/sara. Cases whose citation the statute does not yet cover, and the
 * numeric cases, are listed in the summary and cost no requests. Per-case records go to a
 * JSONL file beside the summary.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { query } from "@factbag/core/query";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { loadCases } from "./data";
import type { Case } from "./data";
import { ground, renderFields } from "./ground";
import { meter, metered, USD_PER_INPUT_TOKEN } from "./meter";
import type { Meter } from "./meter";
import { summarise } from "./metrics";
import type { Outcome } from "./metrics";
import { pool } from "./pool";
import { citationOf, provisionFor, readQuestion } from "./question";
import { EXTRACTION_VERSION } from "./schema";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { values: args } = parseArgs({
  options: {
    split: { type: "string", default: "train" },
    citation: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "2" },
    model: { type: "string", default: "jev-1.13.0" },
    data: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
  },
});

const split = args.split;
if (split !== "train" && split !== "test") {
  throw new Error(`Unknown split ${split}`);
}
const dataDir = args.data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "sara");
if ((process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  throw new Error("Set TYPESAFE_API_KEY in your shell or the repo's .env");
}

type Record_ = Readonly<{
  id: string;
  citation: string | undefined;
  gold: string;
  predicted: string | undefined;
  /** The query value, or why there was no query. */
  value: string;
  atom?: Readonly<{ predicate: string; fields: Readonly<Record<string, string>> }>;
  people?: readonly string[];
  facts?: readonly Readonly<{
    sign: string;
    predicate: string;
    fields: Readonly<Record<string, string>>;
  }>[];
  /** The question reading's probability: 1 when only one reading was possible. */
  reading?: number;
  requests: number;
  inputTokens: number;
  /** End to end: grounding, question reading and the query. */
  latencyMs: number;
  /** The query alone. */
  solverMs?: number;
}>;

const sdk = new TypeSafeClient({ defaultModel: args.model, timeout: 300_000 });
const wanted = args.citation?.split(",").map((text) => text.trim());
const all = loadCases(dataDir, split);
const selected = all.filter(
  (item) => wanted === undefined || wanted.includes(citationOf(item.question) ?? ""),
);

const records: Record_[] = [];
const skipped: Record_[] = [];
for (const item of selected) {
  const reason =
    item.answer.kind === "numeric"
      ? "numeric"
      : provisionFor(item.question) === undefined
        ? "unsupported citation"
        : undefined;
  if (reason !== undefined) {
    skipped.push({
      id: item.id,
      citation: citationOf(item.question),
      gold: goldOf(item),
      predicted: undefined,
      value: reason,
      requests: 0,
      inputTokens: 0,
      latencyMs: 0,
    });
  }
}
const runnable = selected
  .filter((item) => item.answer.kind === "entailment" && provisionFor(item.question) !== undefined)
  .slice(0, args.limit === undefined ? undefined : Number(args.limit));

process.stdout.write(
  `SARA ${split}: ${runnable.length} cases to run, ${skipped.length} skipped (model ${args.model})\n`,
);
const startedAt = performance.now();
await pool(runnable, Number(args.concurrency), async (item) => {
  const usage: Meter = meter();
  const client = metered(sdk, usage);
  const began = performance.now();
  try {
    const provision = provisionFor(item.question);
    if (provision === undefined) {
      throw new Error("unreachable: provision checked above");
    }
    const grounding = await ground(item.text, { client, concurrency: 4 });
    const reading = await readQuestion(item.question, provision, grounding.people, client);
    const facts = grounding.literals.map((literal) => ({
      sign: literal.sign,
      predicate: literal.atom.predicate.name,
      fields: renderFields(literal.atom.fields),
    }));
    let value = reading.reason ?? "";
    let predicted: string | undefined;
    let solverMs: number | undefined;
    if (reading.atom !== undefined) {
      const queried = performance.now();
      value = query(grounding.kb, reading.atom).value;
      solverMs = performance.now() - queried;
      predicted = value === "true" ? "Entailment" : value === "false" ? "Contradiction" : undefined;
    }
    const record: Record_ = {
      id: item.id,
      citation: provision.citation,
      gold: goldOf(item),
      predicted,
      value,
      ...(reading.atom === undefined
        ? {}
        : {
            atom: {
              predicate: reading.atom.predicate.name,
              fields: renderFields(reading.atom.fields),
            },
          }),
      people: grounding.people.map((person) => person.id),
      facts,
      reading: reading.probability,
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      latencyMs: performance.now() - began,
      ...(solverMs === undefined ? {} : { solverMs }),
    };
    records.push(record);
    const mark = predicted === record.gold ? "ok " : "BAD";
    process.stdout.write(
      `  ${mark} ${item.id}: ${value} (${record.predicted ?? "none"} / ${record.gold}), ` +
        `${usage.requests} req, ${usage.inputTokens} tok\n`,
    );
  } catch (error) {
    records.push({
      id: item.id,
      citation: citationOf(item.question),
      gold: goldOf(item),
      predicted: undefined,
      value: `error: ${error instanceof Error ? error.message : String(error)}`,
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      latencyMs: performance.now() - began,
    });
    process.stdout.write(`  ERR ${item.id}: ${String(error)}\n`);
  }
});
const wallMs = performance.now() - startedAt;

const outcomes: Outcome[] = records.map(({ id, gold, predicted }) => ({ id, gold, predicted }));
const run = summarise(outcomes);
const withSkipped = summarise([
  ...outcomes,
  ...skipped.map(({ id, gold, predicted }) => ({ id, gold, predicted })),
]);
const inputTokens = records.reduce((sum, record) => sum + record.inputTokens, 0);
const requests = records.reduce((sum, record) => sum + record.requests, 0);
const byCitation: Record<string, { cases: number; correct: number }> = {};
for (const record of records) {
  const key = record.citation ?? "none";
  const entry = (byCitation[key] ??= { cases: 0, correct: 0 });
  entry.cases += 1;
  entry.correct += record.predicted === record.gold ? 1 : 0;
}

const summary = {
  split,
  model: args.model,
  extraction: EXTRACTION_VERSION,
  admission: "jev default: minimumProbability 0.4, ambiguityMargin 0",
  citations: wanted ?? "all",
  run,
  withSkipped,
  skipped: Object.fromEntries(
    skipped.map((record) => [record.id, `${record.value} (${record.citation ?? "none"})`]),
  ),
  byCitation,
  requests,
  inputTokens,
  usdPerCase: records.length === 0 ? 0 : (inputTokens * USD_PER_INPUT_TOKEN) / records.length,
  latencyMs: spread(records.map((record) => record.latencyMs)),
  solverMs: spread(
    records.flatMap((record) => (record.solverMs === undefined ? [] : [record.solverMs])),
  ),
  wallMs,
  ranAt: new Date().toISOString(),
};

mkdirSync(args.out, { recursive: true });
const stamp = summary.ranAt.replace(/[:.]/gu, "-");
const base = join(args.out, `${split}-${stamp}`);
writeFileSync(`${base}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(`${base}.jsonl`, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
process.stdout.write(
  `\n${run.correct}/${run.cases} correct (${(run.accuracy * 100).toFixed(1)}% ` +
    `[${(run.interval[0] * 100).toFixed(1)}, ${(run.interval[1] * 100).toFixed(1)}]), ` +
    `${run.unanswered} unanswered; with skipped: ${(withSkipped.accuracy * 100).toFixed(1)}%\n` +
    `${requests} requests, ${inputTokens} input tokens, $${summary.usdPerCase.toFixed(5)}/case, ` +
    `median ${summary.latencyMs?.median ?? 0} ms/case end to end, ` +
    `${summary.solverMs?.median ?? 0} ms in the solver, ${(wallMs / 1000).toFixed(0)}s\n` +
    `Wrote ${base}.summary.json\n`,
);

/** Median and maximum of a sample, rounded to whole milliseconds. */
function spread(values: readonly number[]): { median: number; max: number } | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return { median: Math.round(median), max: Math.round(sorted[sorted.length - 1] ?? 0) };
}

function goldOf(item: Case): string {
  return item.answer.kind === "entailment" ? item.answer.label : String(item.answer.amount);
}

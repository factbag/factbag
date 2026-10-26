/**
 * Run the SARA entailment cases of one split through grounding, question reading and the
 * statute, and score the answers.
 *
 * Usage: pnpm --filter @factbag/sara-eval eval --split train|test [--citation 2(a)(1)(A),...]
 *        [--limit N] [--concurrency N] [--model jev-1.13.0] [--data DIR] [--out DIR]
 *        [--relevance-threshold 0.3] [--participant-threshold 0.3] [--candidate-product-cutoff 16]
 *
 * Extraction is staged, with the routing thresholds above; there is no other strategy.
 * Result files are named `<split>-staged-<stamp>` and carry the routing audit per case.
 *
 * Data: DIR is the extracted SARA directory holding cases/ and splits/; defaults to
 * $FACTBAG_DATA_DIR/sara. Cases whose citation the statute does not yet cover are listed
 * in the summary and cost no requests. A numeric case asks how much tax a person owes: the
 * open query over the tax owed answers it, and it is scored by exact match, with the
 * distance to the gold amount recorded. Per-case records go to a JSONL file beside the
 * summary. Pass --numeric to run only the numeric cases, --entailment only the others.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { query, queryAll } from "@factbag/core/query";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { loadCases } from "./data";
import type { Case } from "./data";
import { DEFAULT_ROUTING, ground, renderFields } from "./ground";
import type { RoutingAudit } from "./ground";
import { meter, metered, USD_PER_INPUT_TOKEN } from "@factbag/eval-shared/meter";
import type { Meter } from "@factbag/eval-shared/meter";
import { summarise } from "@factbag/eval-shared/metrics";
import type { Outcome } from "@factbag/eval-shared/metrics";
import { pool } from "@factbag/eval-shared/pool";
import { citationOf, provisionFor, readQuestion } from "./question";
import { TAX_QUESTION } from "./statute";
import { EXTRACTION_VERSION } from "./schema";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { values: args } = parseArgs({
  options: {
    "relevance-threshold": { type: "string", default: String(DEFAULT_ROUTING.relevanceThreshold) },
    "participant-threshold": {
      type: "string",
      default: String(DEFAULT_ROUTING.participantThreshold),
    },
    "candidate-product-cutoff": {
      type: "string",
      default: String(DEFAULT_ROUTING.candidateProductCutoff),
    },
    split: { type: "string", default: "train" },
    citation: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "2" },
    model: { type: "string", default: "jev-1.13.0" },
    data: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
    numeric: { type: "boolean", default: false },
    entailment: { type: "boolean", default: false },
  },
});

const strategy = "staged";
const routing = {
  relevanceThreshold: Number(args["relevance-threshold"]),
  participantThreshold: Number(args["participant-threshold"]),
  candidateProductCutoff: Number(args["candidate-product-cutoff"]),
};
for (const threshold of [routing.relevanceThreshold, routing.participantThreshold]) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("Routing thresholds must be in [0, 1]");
  }
}
if (!Number.isSafeInteger(routing.candidateProductCutoff) || routing.candidateProductCutoff < 0) {
  throw new Error("Candidate product cutoff must be a nonnegative safe integer");
}
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
  /** For a numeric case: the question is open over the amount. */
  open?: true;
  /** For a numeric case: how far the answer is from the gold amount, when there is one. */
  error?: number;
  /** Why there is no prediction, when there is none: the failure's category. */
  failure?: string;
  /** Fact predicates the grounding could not classify, for want of candidates. */
  unclassified?: readonly string[];
  routing?: readonly RoutingAudit[];
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
      ? args.entailment
        ? "numeric, not run"
        : undefined
      : args.numeric
        ? "entailment, not run"
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
  .filter((item) =>
    item.answer.kind === "numeric"
      ? !args.entailment
      : !args.numeric && provisionFor(item.question) !== undefined,
  )
  .slice(0, args.limit === undefined ? undefined : Number(args.limit));

process.stdout.write(
  `SARA ${split}: ${runnable.length} cases to run, ${skipped.length} skipped (model ${args.model})\n`,
);
const startedAt = performance.now();
await pool(runnable, Number(args.concurrency), async (item) => {
  const usage: Meter = meter();
  const client = metered(sdk, usage);
  const began = performance.now();
  let grounded: Pick<Record_, "people" | "facts"> = {};
  try {
    const numeric = item.answer.kind === "numeric";
    const provision = numeric ? TAX_QUESTION : provisionFor(item.question);
    if (provision === undefined) {
      throw new Error("unreachable: provision checked above");
    }
    const grounding = await ground(item.text, { client, concurrency: 4, routing });
    const reading = await readQuestion(item.question, provision, grounding.people, client);
    const facts = grounding.literals.map((literal) => ({
      sign: literal.sign,
      predicate: literal.atom.predicate.name,
      fields: renderFields(literal.atom.fields),
    }));
    grounded = { people: grounding.people.map((person) => person.id), facts };
    let value = reading.reason ?? "";
    let predicted: string | undefined;
    let solverMs: number | undefined;
    let error: number | undefined;
    let failure: string | undefined =
      reading.atom === undefined
        ? `question unreadable: ${reading.reason ?? "no reading"}`
        : undefined;
    if (reading.atom !== undefined && numeric) {
      const queried = performance.now();
      const amounts = queryAll(grounding.kb, reading.atom)
        .filter((judgment) => judgment.value === "true")
        .map((judgment) => judgment.goal.atom.fields["amount"])
        .filter((amount): amount is number => typeof amount === "number");
      solverMs = performance.now() - queried;
      value = amounts.length === 0 ? "no amount" : amounts.map(String).join(" | ");
      const [only] = amounts;
      if (amounts.length === 1 && only !== undefined) {
        predicted = String(only);
        error = Math.abs(only - item.answer.amount);
      } else {
        failure = amounts.length === 0 ? "query: no amount" : "query: several amounts";
      }
    } else if (reading.atom !== undefined) {
      const queried = performance.now();
      value = query(grounding.kb, reading.atom).value;
      solverMs = performance.now() - queried;
      predicted = value === "true" ? "Entailment" : value === "false" ? "Contradiction" : undefined;
      if (predicted === undefined) {
        failure = `query: ${value}`;
      }
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
              fields: renderFields(
                Object.fromEntries(
                  Object.entries(reading.atom.fields).filter(
                    ([name]) => !numeric || name !== "amount",
                  ),
                ),
              ),
            },
          }),
      ...(numeric ? { open: true as const } : {}),
      ...(error === undefined ? {} : { error }),
      ...(failure === undefined ? {} : { failure }),
      ...(grounding.unclassified.length === 0 ? {} : { unclassified: grounding.unclassified }),
      people: grounding.people.map((person) => person.id),
      facts,
      reading: reading.probability,
      routing: grounding.routing,
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
      failure: "error",
      ...grounded,
      ...(item.answer.kind === "numeric" ? { open: true as const } : {}),
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
const numericRecords = records.filter((record) => record.open === true);
const entailmentRecords = records.filter((record) => record.open !== true);
const numeric = summarise(
  numericRecords.map(({ id, gold, predicted }) => ({ id, gold, predicted })),
);
const entailment = summarise(
  entailmentRecords.map(({ id, gold, predicted }) => ({ id, gold, predicted })),
);
/** Numeric answers within a dollar of gold, and within one percent of it. */
const numericNear = {
  withinOneDollar: numericRecords.filter((record) => (record.error ?? Infinity) <= 1).length,
  withinOnePercent: numericRecords.filter(
    (record) => (record.error ?? Infinity) <= Math.abs(Number(record.gold)) * 0.01,
  ).length,
};
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
/** Unanswered cases by the category of their failure. */
const failures = tally(
  records.flatMap((record) => (record.failure === undefined ? [] : [record.failure])),
);
/** How many cases left each fact predicate unclassified for want of candidates. */
const unclassified = tally(records.flatMap((record) => record.unclassified ?? []));

const summary = {
  split,
  model: args.model,
  extraction: EXTRACTION_VERSION,
  strategy,
  routing,
  admission: "jev default: minimumProbability 0.4, ambiguityMargin 0",
  citations: wanted ?? "all",
  run,
  entailment,
  numeric,
  numericNear,
  withSkipped,
  skipped: Object.fromEntries(
    skipped.map((record) => [record.id, `${record.value} (${record.citation ?? "none"})`]),
  ),
  byCitation,
  failures,
  unclassified,
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
const base = join(args.out, `${split}-${strategy}-${stamp}`);
writeFileSync(`${base}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(`${base}.jsonl`, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
process.stdout.write(
  `\nentailment ${entailment.correct}/${entailment.cases}, numeric ${numeric.correct}/${numeric.cases} ` +
    `exact (${numericNear.withinOneDollar} within $1, ${numericNear.withinOnePercent} within 1%)\n` +
    `${run.correct}/${run.cases} correct (${(run.accuracy * 100).toFixed(1)}% ` +
    `[${(run.interval[0] * 100).toFixed(1)}, ${(run.interval[1] * 100).toFixed(1)}]), ` +
    `${run.unanswered} unanswered; with skipped: ${(withSkipped.accuracy * 100).toFixed(1)}%\n` +
    `failures: ${
      Object.entries(failures)
        .map(([category, count]) => `${category} ${count}`)
        .join(", ") || "none"
    }\n` +
    `${requests} requests, ${inputTokens} input tokens, $${summary.usdPerCase.toFixed(5)}/case, ` +
    `median ${summary.latencyMs?.median ?? 0} ms/case end to end, ` +
    `${summary.solverMs?.median ?? 0} ms in the solver, ${(wallMs / 1000).toFixed(0)}s\n` +
    `Wrote ${base}.summary.json\n`,
);

function tally(items: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

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

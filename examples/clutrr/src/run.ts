/**
 * Run the CLUTRR stories of one split through grounding and the kinship rules, and score
 * the answers.
 *
 * Usage: pnpm --filter @factbag/clutrr-eval eval --split train|test [--lengths 2,3]
 *        [--per-length N] [--offset N] [--ids id,...] [--concurrency N] [--model jev-1.13.0]
 *        [--data DIR] [--out DIR] [--relevance-threshold 0.3] [--participant-threshold 0.3]
 *        [--candidate-product-cutoff 16] [--resolve [--max-rounds 2]]
 *
 * With --resolve, the stated facts are checked against the benchmark's exclusivity (two
 * different relations stated between the same two people, `src/violations.ts`) before the
 * question is answered: the facts behind each violation are reread against the story by
 * `@factbag/jev/recheck`, the ones the rereading no longer supports are retracted, and the
 * rest stand. Result files are then named `<split>-staged-resolved-<stamp>`.
 *
 * Extraction is staged, with the routing thresholds above. Result files are named
 * `<split>-staged-<stamp>` and carry the routing audit per story. `--per-length N` takes
 * the first N stories of each clause length in file order, after `--offset`, so a
 * development sample is reproducible.
 *
 * Data: DIR is one pre-generated configuration's directory; defaults to
 * $FACTBAG_DATA_DIR/clutrr/data_089907f8. The story and the queried pair are all either
 * system sees. A case is scored right when its single predicted label equals the gold
 * label; a case without a prediction scores wrong and is counted among the failures by
 * reason. The generator's own proof of each story is read afterwards to attribute every
 * failure to the scanner, the extraction, the rules' own ambiguity or the rules.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { meter, metered, USD_PER_INPUT_TOKEN } from "@factbag/eval-shared/meter";
import type { Meter } from "@factbag/eval-shared/meter";
import { summarise } from "@factbag/eval-shared/metrics";
import type { Outcome, Summary } from "@factbag/eval-shared/metrics";
import { pool } from "@factbag/eval-shared/pool";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { answer } from "./answer";
import { attribute } from "./attribution";
import type { Attribution } from "./attribution";
import { CONFIGURATION, defaultDataDir, loadStories } from "./data";
import type { Story } from "./data";
import { DEFAULT_ROUTING, ground, renderFields } from "./ground";
import type { RoutingAudit } from "./ground";
import type { SavedFact } from "./saved";
import { EXTRACTION_VERSION, FACT_PREDICATES } from "./schema";
import { violationQueries } from "./violations";
import { recheck } from "@factbag/jev/recheck";
import type { RecheckResult, Verdict } from "@factbag/jev/recheck";
import type { AnyLiteral } from "@factbag/core/kb";

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
    lengths: { type: "string" },
    "per-length": { type: "string" },
    offset: { type: "string", default: "0" },
    ids: { type: "string" },
    concurrency: { type: "string", default: "2" },
    model: { type: "string", default: "jev-1.13.0" },
    data: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
    resolve: { type: "boolean", default: false },
    "max-rounds": { type: "string", default: "2" },
  },
});

const maxRounds = Number(args["max-rounds"]);
if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
  throw new Error("--max-rounds must be a positive integer");
}
const strategy = args.resolve ? "staged-resolved" : "staged";
const factNames = new Set<string>(FACT_PREDICATES.map((declaration) => declaration.name));
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
const dataDir = args.data ?? defaultDataDir();
if (dataDir === undefined) {
  throw new Error("Pass --data DIR or set FACTBAG_DATA_DIR");
}
if ((process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  throw new Error("Set TYPESAFE_API_KEY in your shell or the repo's .env");
}

type Record_ = Readonly<{
  id: string;
  file: string;
  length: number;
  query: readonly [string, string];
  gold: string;
  predicted: string | undefined;
  /** The keys the rules derived from the first person to the second. */
  keys?: readonly string[];
  /** The second person's extracted gender, when settled. */
  gender?: string;
  /** Whether the answer rests on more than one stated fact. */
  derived?: boolean;
  /** The stated facts each derived relation rests on. */
  supporting?: Readonly<Record<string, readonly string[]>>;
  /** Why there is no prediction, when there is none. */
  failure?: string;
  people?: readonly string[];
  /** Every admitted fact after resolution, with the classifier's probability for its sign. */
  facts?: readonly SavedFact[];
  /** With --resolve: what the exclusivity check found and what the rereading did about it. */
  resolution?: Readonly<{
    /** Facts the rereading retracted, with the classifier's and the rereading's probabilities. */
    retracted: readonly (SavedFact & { reread: Readonly<Record<string, number>> })[];
    /** Facts behind a violation that the rereading kept. */
    kept: readonly (SavedFact & { reread: Readonly<Record<string, number>> })[];
    /** Distinct pairs still stated twice when the rounds ran out. */
    unresolved: number;
    rounds: number;
    requests: number;
  }>;
  /** Fact predicates the grounding could not classify, for want of people. */
  unclassified?: readonly string[];
  routing?: readonly RoutingAudit[];
  /** Read against the generator's proof after prediction; never given to the system. */
  attribution?: Attribution;
  requests: number;
  inputTokens: number;
  /** End to end: grounding and the query. */
  latencyMs: number;
  /** The query alone. */
  solverMs?: number;
}>;

const sdk = new TypeSafeClient({ defaultModel: args.model, timeout: 300_000 });
const lengths = args.lengths?.split(",").map(Number);
const ids = args.ids?.split(",").map((text) => text.trim());
const all = loadStories(dataDir, split);
const offset = Number(args.offset);
const perLength = args["per-length"] === undefined ? undefined : Number(args["per-length"]);
const selected = select(all);

function select(stories: readonly Story[]): readonly Story[] {
  if (ids !== undefined) {
    return stories.filter((story) => ids.includes(story.id));
  }
  const wanted = stories.filter((story) => lengths === undefined || lengths.includes(story.length));
  if (perLength === undefined) {
    return wanted.slice(offset);
  }
  const byLength = new Map<number, Story[]>();
  for (const story of wanted) {
    const group = byLength.get(story.length) ?? [];
    group.push(story);
    byLength.set(story.length, group);
  }
  return [...byLength.keys()]
    .sort((a, b) => a - b)
    .flatMap((length) => (byLength.get(length) ?? []).slice(offset, offset + perLength));
}

const records: Record_[] = [];
process.stdout.write(
  `CLUTRR ${CONFIGURATION} ${split}: ${selected.length} stories to run (model ${args.model})\n`,
);
const startedAt = performance.now();
await pool(selected, Number(args.concurrency), async (story) => {
  const usage: Meter = meter();
  const client = metered(sdk, usage);
  const began = performance.now();
  let grounded: Pick<Record_, "people" | "facts"> = {};
  try {
    const grounding = await ground(story.text, { client, concurrency: 4, routing });
    const people = new Map(grounding.people.map((person) => [person.id, person]));
    grounded = { people: [...people.keys()], facts: grounding.literals.map(savedFact) };
    let kb = grounding.kb;
    let resolution: Record_["resolution"];
    if (args.resolve) {
      const [first, second] = story.query;
      const a = people.get(first);
      const b = people.get(second);
      const pair = a === undefined || b === undefined ? undefined : { a, b };
      const result: RecheckResult = await recheck(grounding.corpus, kb, violationQueries(pair), {
        client,
        maxRounds,
      });
      kb = result.kb;
      resolution = summariseResolution(result);
    }
    const facts = kb
      .literals((literal) => factNames.has(literal.atom.predicate.name))
      .map(savedFact);
    const [first, second] = story.query;
    const found = answer(kb, people, first, second);
    const partial = {
      id: story.id,
      file: story.file,
      length: story.length,
      query: story.query,
      gold: story.target,
      predicted: found.predicted,
      keys: found.keys,
      ...(found.gender === undefined ? {} : { gender: found.gender }),
      ...(found.derived === undefined ? {} : { derived: found.derived }),
      supporting: found.supporting,
      ...(found.failure === undefined ? {} : { failure: found.failure }),
      people: [...people.keys()],
      facts,
      ...(resolution === undefined ? {} : { resolution }),
      ...(grounding.unclassified.length === 0 ? {} : { unclassified: grounding.unclassified }),
      routing: grounding.routing,
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      latencyMs: performance.now() - began,
      solverMs: found.solverMs,
    };
    const record: Record_ = { ...partial, attribution: attribute(story, partial) };
    records.push(record);
    const mark = found.predicted === story.target ? "ok " : "BAD";
    process.stdout.write(
      `  ${mark} k=${String(story.length)} ${story.id.slice(0, 8)}: ${found.predicted ?? found.failure ?? "none"} / ${story.target}, ` +
        `${String(usage.requests)} req, ${String(usage.inputTokens)} tok, ${String(Math.round(found.solverMs))} ms solver\n`,
    );
  } catch (error) {
    const partial = {
      id: story.id,
      file: story.file,
      length: story.length,
      query: story.query,
      gold: story.target,
      predicted: undefined,
      failure: "error",
      ...grounded,
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      latencyMs: performance.now() - began,
    };
    records.push({ ...partial, attribution: attribute(story, partial) });
    process.stdout.write(`  ERR ${story.id.slice(0, 8)}: ${String(error)}\n`);
  }
});
const wallMs = performance.now() - startedAt;
records.sort((a, b) => a.length - b.length || a.id.localeCompare(b.id));

const outcomes: Outcome[] = records.map(({ id, gold, predicted }) => ({ id, gold, predicted }));
const run = summarise(outcomes);
const byLength: Record<string, Summary> = {};
for (const length of [...new Set(records.map((record) => record.length))].sort((a, b) => a - b)) {
  byLength[String(length)] = summarise(
    outcomes.filter((outcome) => records.find((r) => r.id === outcome.id)?.length === length),
  );
}
const inputTokens = records.reduce((sum, record) => sum + record.inputTokens, 0);
const requests = records.reduce((sum, record) => sum + record.requests, 0);
const failures = tally(
  records.flatMap((record) =>
    record.failure === undefined ? [] : [record.failure.split(":")[0] ?? record.failure],
  ),
);
const attribution = tally(
  records.flatMap((record) =>
    record.predicted === record.gold || record.attribution === undefined
      ? []
      : [record.attribution.category],
  ),
);
const attributionByLength: Record<string, Record<string, number>> = {};
for (const record of records) {
  if (record.predicted === record.gold || record.attribution === undefined) {
    continue;
  }
  const group = (attributionByLength[String(record.length)] ??= {});
  group[record.attribution.category] = (group[record.attribution.category] ?? 0) + 1;
}
const unclassified = tally(records.flatMap((record) => record.unclassified ?? []));
/** With --resolve: how many stories had a violation, how many facts fell, how many stayed open. */
const resolution = args.resolve
  ? {
      maxRounds,
      violations:
        "stated_twice: two different relations stated between the same two people; conflicting_relations: two relations derived for the queried pair",
      storiesWithViolations: records.filter((record) => (record.resolution?.rounds ?? 0) > 0)
        .length,
      retractedFacts: records.reduce(
        (sum, record) => sum + (record.resolution?.retracted.length ?? 0),
        0,
      ),
      keptFacts: records.reduce((sum, record) => sum + (record.resolution?.kept.length ?? 0), 0),
      storiesUnresolved: records.filter((record) => (record.resolution?.unresolved ?? 0) > 0)
        .length,
      requests: records.reduce((sum, record) => sum + (record.resolution?.requests ?? 0), 0),
    }
  : "none";

const summary = {
  dataset: { configuration: CONFIGURATION, split, files: [...new Set(records.map((r) => r.file))] },
  selection: {
    ...(ids === undefined ? {} : { ids }),
    ...(lengths === undefined ? {} : { lengths }),
    ...(perLength === undefined ? {} : { perLength }),
    offset,
  },
  model: args.model,
  extraction: EXTRACTION_VERSION,
  strategy,
  routing,
  admission: "jev default: minimumProbability 0.4, ambiguityMargin 0",
  resolution,
  run,
  byLength,
  failures,
  attribution,
  attributionByLength,
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
  `\n${String(run.correct)}/${String(run.cases)} correct (${(run.accuracy * 100).toFixed(1)}% ` +
    `[${(run.interval[0] * 100).toFixed(1)}, ${(run.interval[1] * 100).toFixed(1)}]), ` +
    `${String(run.unanswered)} unanswered\n` +
    `by length: ${Object.entries(byLength)
      .map(([length, entry]) => `k=${length} ${String(entry.correct)}/${String(entry.cases)}`)
      .join(", ")}\n` +
    `failures: ${
      Object.entries(failures)
        .map(([category, count]) => `${category} ${String(count)}`)
        .join(", ") || "none"
    }\n` +
    `attribution: ${
      Object.entries(attribution)
        .map(([category, count]) => `${category} ${String(count)}`)
        .join(", ") || "none"
    }\n` +
    `${String(requests)} requests, ${String(inputTokens)} input tokens, $${summary.usdPerCase.toFixed(5)}/case, ` +
    `median ${String(summary.latencyMs?.median ?? 0)} ms/case end to end, ` +
    `${String(summary.solverMs?.median ?? 0)} ms in the solver, ${(wallMs / 1000).toFixed(0)}s\n` +
    `Wrote ${basename(base)}.summary.json\n`,
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

/** A literal for the results file: its sign, atom and the classifier's probability. */
function savedFact(literal: AnyLiteral): SavedFact {
  const probability = literal.metadata?.scores?.["probability"];
  return {
    sign: literal.sign,
    predicate: literal.atom.predicate.name,
    fields: renderFields(literal.atom.fields),
    ...(probability === undefined ? {} : { probability }),
  };
}

function summariseResolution(result: RecheckResult): NonNullable<Record_["resolution"]> {
  // The last verdict on a literal decides: one kept in a round may fall in a later one.
  const lastVerdict = new Map<AnyLiteral, Verdict>();
  for (const round of result.rounds) {
    for (const violation of round.violations) {
      for (const verdict of violation.verdicts) {
        lastVerdict.set(verdict.literal, verdict);
      }
    }
  }
  const retracted = new Set(result.retracted);
  const reread = (verdict: Verdict): SavedFact & { reread: Readonly<Record<string, number>> } => ({
    ...savedFact(verdict.literal),
    reread: verdict.answer.probabilities,
  });
  const unresolvedPairs = new Set(
    result.unresolved.map((atom) =>
      Object.values(renderFields(atom.fields))
        .sort((a, b) => a.localeCompare(b))
        .join("|"),
    ),
  );
  return {
    retracted: [...lastVerdict.values()].filter((v) => retracted.has(v.literal)).map(reread),
    kept: [...lastVerdict.values()].filter((v) => !retracted.has(v.literal)).map(reread),
    unresolved: unresolvedPairs.size,
    rounds: result.rounds.length,
    requests: result.requests,
  };
}

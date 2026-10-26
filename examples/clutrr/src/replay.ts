/**
 * Re-solve a past run's stories from the facts it saved, under the current rules, with no
 * requests. A regression check for rule changes while extraction stays the same: it says
 * which answers changed and how long the solver took.
 *
 * Usage: pnpm --filter @factbag/clutrr-eval replay --facts results/<run>.jsonl [--out DIR]
 *        [--resolve --data DIR [--max-rounds 2] [--model jev-1.13.0]]
 *
 * With --resolve, the saved facts are first checked against the benchmark's exclusivity
 * (`src/violations.ts`) and the facts behind each violation are reread against the story
 * by `@factbag/jev/recheck`, which makes requests for those stories only. Since the facts
 * are the saved run's, this is a paired comparison of the same extraction with and without
 * resolution: the saved prediction is "before", the resolved one "after".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { meter, metered, USD_PER_INPUT_TOKEN } from "@factbag/eval-shared/meter";
import { summarise } from "@factbag/eval-shared/metrics";
import type { Outcome, Summary } from "@factbag/eval-shared/metrics";
import { pool } from "@factbag/eval-shared/pool";
import { Corpus } from "@factbag/corpus";
import { recheck } from "@factbag/jev/recheck";
import type { RecheckResult } from "@factbag/jev/recheck";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { answer } from "./answer";
import { defaultDataDir, loadStories } from "./data";
import { renderFields } from "./ground";
import { readRecords, rebuild } from "./saved";
import type { SavedFact, SavedRecord } from "./saved";
import { EXTRACTION_VERSION } from "./schema";
import { defineViolations, violationQueries } from "./violations";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { values: args } = parseArgs({
  options: {
    facts: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
    resolve: { type: "boolean", default: false },
    "max-rounds": { type: "string", default: "2" },
    data: { type: "string" },
    model: { type: "string", default: "jev-1.13.0" },
    concurrency: { type: "string", default: "3" },
  },
});
if (args.facts === undefined) {
  throw new Error("Pass --facts results/<run>.jsonl");
}
const maxRounds = Number(args["max-rounds"]);
if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
  throw new Error("--max-rounds must be a positive integer");
}
const dataDir = args.data ?? defaultDataDir();
if (args.resolve && dataDir === undefined) {
  throw new Error("--resolve needs the story texts: pass --data DIR or set FACTBAG_DATA_DIR");
}
if (args.resolve && (process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  throw new Error("Set TYPESAFE_API_KEY in your shell or the repo's .env");
}

type Reread = SavedFact & { reread: Readonly<Record<string, number>> };

type Replayed = Readonly<{
  id: string;
  length: number;
  gold: string;
  before: string | undefined;
  predicted: string | undefined;
  failure?: string;
  solverMs: number;
  /** With --resolve: the facts reread, the verdicts, and what the run cost. */
  resolution?: Readonly<{
    retracted: readonly Reread[];
    kept: readonly Reread[];
    unresolved: number;
    rounds: number;
    requests: number;
    inputTokens: number;
    latencyMs: number;
  }>;
}>;

const records = readRecords(args.facts);
const stories = new Map(
  args.resolve && dataDir !== undefined
    ? [...loadStories(dataDir, "train"), ...loadStories(dataDir, "test")].map((story) => [
        story.id,
        story,
      ])
    : [],
);
const sdk = args.resolve
  ? new TypeSafeClient({ defaultModel: args.model, timeout: 300_000 })
  : undefined;

async function replayOne(record: SavedRecord): Promise<Replayed> {
  if (record.facts === undefined) {
    return {
      id: record.id,
      length: record.length,
      gold: record.gold,
      before: record.predicted,
      predicted: undefined,
      failure: record.failure ?? "no saved facts",
      solverMs: 0,
    };
  }
  const story = stories.get(record.id);
  // The staged driver reads a short story as one chunk of its one document, "text".
  const source = story === undefined ? undefined : `text#0-${String(story.text.length)}`;
  const built = rebuild(record, source === undefined ? {} : { source });
  const { people } = built;
  let { kb } = built;
  let resolution: Replayed["resolution"];
  if (args.resolve && story !== undefined && sdk !== undefined) {
    const corpus = new Corpus();
    corpus.add({ documentId: "text", text: story.text });
    defineViolations(kb);
    const [first, second] = record.query;
    const a = people.get(first);
    const b = people.get(second);
    const pair = a === undefined || b === undefined ? undefined : { a, b };
    const usage = meter();
    const began = performance.now();
    const result = await recheck(corpus, kb, violationQueries(pair), {
      client: metered(sdk, usage),
      maxRounds,
    });
    kb = result.kb;
    resolution = {
      ...verdictsOf(result),
      unresolved: result.unresolved.length / 2,
      rounds: result.rounds.length,
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      latencyMs: performance.now() - began,
    };
  }
  const [first, second] = record.query;
  const found = answer(kb, people, first, second);
  return {
    id: record.id,
    length: record.length,
    gold: record.gold,
    before: record.predicted,
    predicted: found.predicted,
    ...(found.failure === undefined ? {} : { failure: found.failure }),
    solverMs: found.solverMs,
    ...(resolution === undefined ? {} : { resolution }),
  };
}

/** Each reread literal once, by its last verdict, split by whether it fell. */
function verdictsOf(result: RecheckResult): { retracted: Reread[]; kept: Reread[] } {
  const last = new Map<unknown, Reread & { fell: boolean }>();
  const retracted = new Set(result.retracted);
  for (const round of result.rounds) {
    for (const violation of round.violations) {
      for (const verdict of violation.verdicts) {
        const probability = verdict.literal.metadata?.scores?.["probability"];
        last.set(verdict.literal, {
          sign: verdict.literal.sign,
          predicate: verdict.literal.atom.predicate.name,
          fields: renderFields(verdict.literal.atom.fields),
          ...(probability === undefined ? {} : { probability }),
          reread: verdict.answer.probabilities,
          fell: retracted.has(verdict.literal),
        });
      }
    }
  }
  const all = [...last.values()];
  const strip = ({ fell: _fell, ...rest }: Reread & { fell: boolean }): Reread => rest;
  return {
    retracted: all.filter((entry) => entry.fell).map(strip),
    kept: all.filter((entry) => !entry.fell).map(strip),
  };
}

const replayed: Replayed[] = [];
await pool(records, args.resolve ? Number(args.concurrency) : 1, async (record) => {
  const item = await replayOne(record);
  replayed.push(item);
  const mark = item.predicted === record.gold ? "ok " : "BAD";
  const change = item.predicted === record.predicted ? "" : ` (was ${record.predicted ?? "none"})`;
  const resolved =
    item.resolution === undefined || item.resolution.rounds === 0
      ? ""
      : ` [reread ${String(item.resolution.retracted.length + item.resolution.kept.length)}, retracted ${String(item.resolution.retracted.length)}]`;
  process.stdout.write(
    `  ${mark} k=${String(record.length)} ${record.id.slice(0, 8)}: ${item.predicted ?? item.failure ?? "none"} / ${record.gold}${change}${resolved}, ${item.solverMs.toFixed(0)} ms\n`,
  );
});
replayed.sort((a, b) => a.length - b.length || a.id.localeCompare(b.id));

const outcomes: Outcome[] = replayed.map(({ id, gold, predicted }) => ({ id, gold, predicted }));
const run = summarise(outcomes);
const before = summarise(
  replayed.map(({ id, gold, before: predicted }) => ({ id, gold, predicted })),
);
const byLength: Record<string, Summary> = {};
for (const length of [...new Set(replayed.map((item) => item.length))].sort((a, b) => a - b)) {
  byLength[String(length)] = summarise(
    replayed
      .filter((item) => item.length === length)
      .map(({ id, gold, predicted }) => ({ id, gold, predicted })),
  );
}
const solverTimes = replayed.map((item) => item.solverMs).sort((left, right) => left - right);
const median = solverTimes[Math.floor(solverTimes.length / 2)] ?? 0;
const changed = replayed.filter((item) => item.predicted !== item.before);
const resolved = replayed.flatMap((item) =>
  item.resolution === undefined ? [] : [item.resolution],
);
const inputTokens = resolved.reduce((sum, item) => sum + item.inputTokens, 0);
const beforeByLength: Record<string, Summary> = {};
for (const length of Object.keys(byLength)) {
  beforeByLength[length] = summarise(
    replayed
      .filter((item) => String(item.length) === length)
      .map(({ id, gold, before: predicted }) => ({ id, gold, predicted })),
  );
}
const resolution = args.resolve
  ? {
      maxRounds,
      violations:
        "stated_twice: two different relations stated between the same two people; conflicting_relations: two relations derived for the queried pair",
      storiesWithViolations: resolved.filter((item) => item.rounds > 0).length,
      storiesChanged: replayed.filter((item) => item.predicted !== item.before).length,
      retractedFacts: resolved.reduce((sum, item) => sum + item.retracted.length, 0),
      keptFacts: resolved.reduce((sum, item) => sum + item.kept.length, 0),
      storiesUnresolved: resolved.filter((item) => item.unresolved > 0).length,
      requests: resolved.reduce((sum, item) => sum + item.requests, 0),
      inputTokens,
      usdPerStory:
        replayed.length === 0 ? 0 : (inputTokens * USD_PER_INPUT_TOKEN) / replayed.length,
      latencyMs: spread(resolved.filter((item) => item.rounds > 0).map((item) => item.latencyMs)),
    }
  : "none";
/** The extraction version of the run whose facts these are, from its summary beside them. */
function savedExtraction(factsFile: string): string | undefined {
  const summaryFile = factsFile.replace(/\.jsonl$/u, ".summary.json");
  if (summaryFile === factsFile || !existsSync(summaryFile)) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(readFileSync(summaryFile, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("extraction" in parsed)) {
    return undefined;
  }
  const { extraction } = parsed;
  return typeof extraction === "string" ? extraction : undefined;
}

const summary = {
  facts: basename(args.facts),
  // The facts are the saved run's, so the wording that produced them is that run's, not
  // necessarily the current one.
  extraction: savedExtraction(args.facts) ?? EXTRACTION_VERSION,
  resolution,
  run,
  before,
  byLength,
  beforeByLength,
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
const base = join(args.out, `${args.resolve ? "replay-resolved" : "replay"}-${stamp}`);
writeFileSync(`${base}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(`${base}.jsonl`, `${replayed.map((item) => JSON.stringify(item)).join("\n")}\n`);
process.stdout.write(
  `\n${String(run.correct)}/${String(run.cases)} correct (was ${String(before.correct)}/${String(before.cases)}), ` +
    `${String(run.unanswered)} unanswered, ${String(changed.length)} changed; solver median ${String(summary.solverMs.median)} ms, ` +
    `max ${String(summary.solverMs.max)} ms\nWrote ${basename(base)}.summary.json\n`,
);

/** Median and maximum of a sample, rounded to whole milliseconds. */
function spread(values: readonly number[]): { median: number; max: number } | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const mid =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return { median: Math.round(mid), max: Math.round(sorted[sorted.length - 1] ?? 0) };
}

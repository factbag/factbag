/**
 * Run a system over a benchmark's cases and write the report: one JSONL record per case
 * and a summary beside it, named `<benchmark>-<system>-<stamp>`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { summarise } from "./metrics";
import type { Summary } from "./metrics";
import { pool } from "./pool";
import type { Benchmark, Case, System, Usage } from "./types";

export type RunOptions = Readonly<{
  /** The directory the report is written to. */
  out: string;
  /** Cases solved at once; 1 when left out. */
  concurrency?: number;
  /** Only these cases; every id must be the benchmark's. */
  ids?: readonly string[];
  /** Only cases whose tag has one of the values given, for every tag given. */
  tags?: Readonly<Record<string, readonly string[]>>;
  /** At most this many of the selected cases, in benchmark order. */
  limit?: number;
}>;

/** One case's line in the report. */
export type CaseRecord = Readonly<{
  id: string;
  tags: Readonly<Record<string, string>>;
  gold: string;
  answer?: string;
  /** Why the system threw, when it did; the case is then unanswered. */
  error?: string;
  latencyMs: number;
  usage: readonly Usage[];
  detail?: unknown;
}>;

type Totals = { requests: number; inputTokens: number; usd: number };

export type RunSummary = Readonly<{
  benchmark: string;
  system: string;
  config: unknown;
  selection: Readonly<{ ids?: readonly string[]; tags?: RunOptions["tags"]; limit?: number }>;
  score: Summary;
  /** Cases and correct answers by each tag's value. */
  byTag: Readonly<Record<string, Readonly<Record<string, { cases: number; correct: number }>>>>;
  /** Usage over the run, by model. */
  usage: Readonly<Record<string, Totals>>;
  usdPerCase: number;
  latencyMs: Readonly<{ median: number; max: number }> | undefined;
  wallMs: number;
  ranAt: string;
}>;

export async function run<Input, Label extends string>(
  benchmark: Benchmark<Input, Label>,
  system: System<Input, Label>,
  options: RunOptions,
): Promise<RunSummary> {
  const cases = select(benchmark, options);
  process.stdout.write(
    `${benchmark.name} with ${system.name}: ${cases.length} of ${benchmark.cases.length} cases\n`,
  );
  const records: CaseRecord[] = [];
  const startedAt = performance.now();
  await pool(cases, options.concurrency ?? 1, async (item) => {
    const record = await solve(system, item);
    records.push(record);
    const mark = record.error === undefined ? (record.answer === item.gold ? "ok " : "BAD") : "ERR";
    process.stdout.write(
      `  ${mark} ${item.id}: ${record.error ?? record.answer ?? "none"} / ${item.gold}, ` +
        `${Math.round(record.latencyMs)} ms\n`,
    );
  });
  const wallMs = performance.now() - startedAt;
  records.sort((left, right) => left.id.localeCompare(right.id));

  const score = summarise(records);
  const usage = totals(records);
  const usd = Object.values(usage).reduce((sum, model) => sum + model.usd, 0);
  const summary: RunSummary = {
    benchmark: benchmark.name,
    system: system.name,
    config: system.config,
    selection: {
      ...(options.ids === undefined ? {} : { ids: options.ids }),
      ...(options.tags === undefined ? {} : { tags: options.tags }),
      ...(options.limit === undefined ? {} : { limit: options.limit }),
    },
    score,
    byTag: byTag(records),
    usage,
    usdPerCase: records.length === 0 ? 0 : usd / records.length,
    latencyMs: spread(records.map((record) => record.latencyMs)),
    wallMs,
    ranAt: new Date().toISOString(),
  };

  mkdirSync(options.out, { recursive: true });
  const stamp = summary.ranAt.replace(/[:.]/gu, "-");
  const base = join(options.out, `${benchmark.name}-${system.name}-${stamp}`);
  writeFileSync(`${base}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(`${base}.jsonl`, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  process.stdout.write(
    `\n${score.correct}/${score.cases} correct (${percent(score.accuracy)} ` +
      `[${percent(score.interval[0])}, ${percent(score.interval[1])}]), ` +
      `${score.unanswered} unanswered\n` +
      `$${summary.usdPerCase.toFixed(5)}/case, median ${summary.latencyMs?.median ?? 0} ms/case, ` +
      `${(wallMs / 1000).toFixed(0)}s in all\nWrote ${base}.summary.json\n`,
  );
  return summary;
}

function select<Input, Label extends string>(
  benchmark: Benchmark<Input, Label>,
  { ids, tags, limit }: RunOptions,
): readonly Case<Input, Label>[] {
  const unknown = ids?.filter((id) => !benchmark.cases.some((item) => item.id === id)) ?? [];
  if (unknown.length > 0) {
    throw new Error(`No case ${unknown.join(", ")} in ${benchmark.name}`);
  }
  return benchmark.cases
    .filter(
      (item) =>
        (ids === undefined || ids.includes(item.id)) &&
        Object.entries(tags ?? {}).every(([tag, values]) => values.includes(item.tags[tag] ?? "")),
    )
    .slice(0, limit);
}

async function solve<Input, Label extends string>(
  system: System<Input, Label>,
  item: Case<Input, Label>,
): Promise<CaseRecord> {
  const began = performance.now();
  const base = { id: item.id, tags: item.tags, gold: item.gold };
  try {
    const { answer, usage, detail } = await system.solve(item.input);
    return {
      ...base,
      ...(answer === undefined ? {} : { answer }),
      latencyMs: performance.now() - began,
      usage,
      ...(detail === undefined ? {} : { detail }),
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: performance.now() - began,
      usage: [],
    };
  }
}

function totals(records: readonly CaseRecord[]): Record<string, Totals> {
  const byModel: Record<string, Totals> = {};
  for (const { model, requests, inputTokens, usd } of records.flatMap((record) => record.usage)) {
    const entry = (byModel[model] ??= { requests: 0, inputTokens: 0, usd: 0 });
    entry.requests += requests;
    entry.inputTokens += inputTokens;
    entry.usd += usd;
  }
  return byModel;
}

function byTag(records: readonly CaseRecord[]): RunSummary["byTag"] {
  const tags: Record<string, Record<string, { cases: number; correct: number }>> = {};
  for (const record of records) {
    for (const [tag, value] of Object.entries(record.tags)) {
      const entry = ((tags[tag] ??= {})[value] ??= { cases: 0, correct: 0 });
      entry.cases += 1;
      entry.correct += record.answer === record.gold ? 1 : 0;
    }
  }
  return tags;
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

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

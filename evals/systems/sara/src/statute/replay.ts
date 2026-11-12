/**
 * Re-solve a past run's cases from the facts and question readings it saved, under the
 * current rules, with no requests. A regression check for rule changes while extraction
 * and reading stay the same: it says which answers changed and how long the solver took.
 * A case whose question went unread, or that threw, stays unanswered.
 *
 * Usage: pnpm --filter @factbag/sara-systems replay --facts results/<run>.jsonl
 */
import { parseArgs } from "node:util";
import { query } from "factbag/dsl";
import { summarise } from "@factbag/eval-runner";
import { readRecords, rebuild, toAtom } from "./saved";
import { labelOf } from "./record";

const { values: args } = parseArgs({ options: { facts: { type: "string" } } });
if (args.facts === undefined) {
  throw new Error("Pass --facts results/<run>.jsonl");
}

const records = readRecords(args.facts);
const replayed: { id: string; gold: string; answer: string | undefined }[] = [];
const solverMs: number[] = [];
let changed = 0;
for (const { id, gold, answer: before, detail, error } of records) {
  let answer: string | undefined;
  let value = detail?.unread ?? error ?? "unanswered";
  if (detail?.atom !== undefined) {
    const { kb, people } = rebuild(detail);
    const atom = toAtom(detail.atom.predicate, detail.atom.fields, people);
    const began = performance.now();
    ({ value } = query(kb, atom));
    solverMs.push(performance.now() - began);
    answer = labelOf(value);
  }
  replayed.push({ id, gold, answer });
  changed += answer === before ? 0 : 1;
  const mark = answer === gold ? "ok " : "BAD";
  const was = answer === before ? "" : ` (was ${before ?? "none"})`;
  process.stdout.write(`  ${mark} ${id}: ${value} (${answer ?? "none"} / ${gold})${was}\n`);
}

const now = summarise(replayed);
const then = summarise(records);
solverMs.sort((left, right) => left - right);
process.stdout.write(
  `\n${now.correct}/${now.cases} correct (was ${then.correct}/${then.cases}), ` +
    `${now.unanswered} unanswered, ${changed} changed; solver median ` +
    `${Math.round(solverMs[Math.floor(solverMs.length / 2)] ?? 0)} ms, ` +
    `max ${Math.round(solverMs[solverMs.length - 1] ?? 0)} ms\n`,
);

/**
 * Extraction probe: ground chosen cases and print every admitted fact, with the near
 * misses, so the facts can be checked against the text by eye before the statute grows
 * to use them. No question is read and nothing is scored.
 *
 * Usage: pnpm --filter @factbag/sara-eval probe [--cases id,id,...] [--longest N]
 *        [--split train] [--concurrency N] [--model jev-1.13.0] [--data DIR] [--out DIR]
 *
 * `--longest N` takes the N longest entailment texts of the split, skipping texts that
 * repeat an earlier one up to a single detail. Only the train split is probed.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Assessment } from "@factbag/jev/classifier";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { iso } from "./calendar";
import { loadCases } from "./data";
import type { Case } from "./data";
import { ground, renderFields } from "./ground";
import { meter, metered, USD_PER_INPUT_TOKEN } from "./meter";
import { EXTRACTION_VERSION } from "./schema";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { values: args } = parseArgs({
  options: {
    cases: { type: "string" },
    longest: { type: "string" },
    split: { type: "string", default: "train" },
    concurrency: { type: "string", default: "4" },
    model: { type: "string", default: "jev-1.13.0" },
    data: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
  },
});

if (args.split !== "train") {
  throw new Error("The probe reads the train split only; the test split stays sealed");
}
const dataDir = args.data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "sara");
if ((process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  throw new Error("Set TYPESAFE_API_KEY in your shell or the repo's .env");
}

const all = loadCases(dataDir, "train");
const wanted = args.cases?.split(",").map((id) => id.trim());
const selected: Case[] = [];
if (wanted !== undefined) {
  for (const id of wanted) {
    const item = all.find((candidate) => candidate.id === id);
    if (item === undefined) {
      throw new Error(`No train case ${id}`);
    }
    selected.push(item);
  }
}
if (args.longest !== undefined) {
  const byLength = all
    .filter((item) => item.answer.kind === "entailment")
    .sort((a, b) => words(b.text) - words(a.text));
  for (const item of byLength) {
    if (selected.length >= Number(args.longest)) {
      break;
    }
    if (
      !selected.some((chosen) => chosen.id === item.id || nearDuplicate(chosen.text, item.text))
    ) {
      selected.push(item);
    }
  }
}

type Judgment = Readonly<{
  sign: "+" | "-";
  predicate: string;
  fields: Readonly<Record<string, string>>;
  probability: number;
}>;

type ProbeRecord = Readonly<{
  id: string;
  text: string;
  people: readonly string[];
  domains: Readonly<Record<string, readonly string[]>>;
  unclassified: readonly string[];
  admitted: readonly Judgment[];
  /** Candidates that scored for a sign but short of admission. */
  nearMisses: readonly Judgment[];
  requests: number;
  inputTokens: number;
  latencyMs: number;
}>;

const NEAR_MISS = 0.15;

const sdk = new TypeSafeClient({ defaultModel: args.model, timeout: 300_000 });
const records: ProbeRecord[] = [];
process.stdout.write(`Probing ${selected.length} train cases (model ${args.model})\n`);
for (const item of selected) {
  const usage = meter();
  const began = performance.now();
  // oxlint-disable-next-line eslint/no-await-in-loop -- Cases print in order; requests within a case run concurrently.
  const grounding = await ground(item.text, {
    client: metered(sdk, usage),
    concurrency: Number(args.concurrency),
  });
  const admitted: Judgment[] = [];
  const nearMisses: Judgment[] = [];
  for (const assessment of grounding.assessments) {
    for (const entry of assessment.assessments) {
      sort(entry, admitted, nearMisses);
    }
  }
  const order = (a: Judgment, b: Judgment): number =>
    a.predicate.localeCompare(b.predicate) ||
    JSON.stringify(a.fields).localeCompare(JSON.stringify(b.fields));
  admitted.sort(order);
  nearMisses.sort(order);
  const record: ProbeRecord = {
    id: item.id,
    text: item.text,
    people: grounding.people.map((person) => person.id),
    domains: {
      Date: (grounding.domains.Date ?? []).map(iso),
      BigInt: (grounding.domains.BigInt ?? []).map(String),
      Number: (grounding.domains.Number ?? []).map(String),
    },
    unclassified: grounding.unclassified,
    admitted,
    nearMisses,
    requests: usage.requests,
    inputTokens: usage.inputTokens,
    latencyMs: performance.now() - began,
  };
  records.push(record);
  process.stdout.write(`\n=== ${item.id} (${usage.requests} req, ${usage.inputTokens} tok)\n`);
  process.stdout.write(`${item.text}\n`);
  process.stdout.write(`people: ${record.people.join(", ")}\n`);
  process.stdout.write(
    `dates: ${record.domains["Date"]?.join(" ") ?? ""}\nyears: ${record.domains["BigInt"]?.join(" ") ?? ""}\namounts: ${record.domains["Number"]?.join(" ") ?? ""}\n`,
  );
  if (record.unclassified.length > 0) {
    process.stdout.write(`not classified: ${record.unclassified.join(", ")}\n`);
  }
  process.stdout.write("admitted:\n");
  for (const judgment of admitted) {
    process.stdout.write(`  ${line(judgment)}\n`);
  }
  if (nearMisses.length > 0) {
    process.stdout.write("near misses:\n");
    for (const judgment of nearMisses) {
      process.stdout.write(`  ${line(judgment)}\n`);
    }
  }
}

const inputTokens = records.reduce((sum, record) => sum + record.inputTokens, 0);
const requests = records.reduce((sum, record) => sum + record.requests, 0);
mkdirSync(args.out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
const file = join(args.out, `probe-${stamp}.json`);
writeFileSync(
  file,
  `${JSON.stringify({ model: args.model, extraction: EXTRACTION_VERSION, records }, null, 2)}\n`,
);
process.stdout.write(
  `\n${requests} requests, ${inputTokens} input tokens, ` +
    `$${((inputTokens * USD_PER_INPUT_TOKEN) / Math.max(records.length, 1)).toFixed(5)}/case\n` +
    `Wrote ${file}\n`,
);

/** File one candidate's assessment as admitted or as a near miss, by its sign. */
function sort(
  entry: Assessment["assessments"][number],
  admitted: Judgment[],
  nearMisses: Judgment[],
): void {
  const fields = renderFields(entry.atom.fields);
  const predicate = entry.atom.predicate.name;
  if (entry.literals.length > 0) {
    for (const literal of entry.literals) {
      admitted.push({
        sign: literal.sign,
        predicate,
        fields,
        probability: entry.answer.probabilities[literal.sign === "+" ? "ASSERT" : "DENY"],
      });
    }
    return;
  }
  for (const [sign, outcome] of [
    ["+", "ASSERT"],
    ["-", "DENY"],
  ] as const) {
    const probability = entry.answer.probabilities[outcome];
    if (probability >= NEAR_MISS) {
      nearMisses.push({ sign, predicate, fields, probability });
    }
  }
}

function line(judgment: Judgment): string {
  const fields = Object.entries(judgment.fields)
    .map(([name, value]) => `${name}=${value}`)
    .join(" ");
  return `${judgment.sign} ${judgment.predicate}(${fields}) ${judgment.probability.toFixed(2)}`;
}

function words(text: string): number {
  return text.split(/\s+/u).length;
}

/** Two texts of the same length that differ in at most one whitespace-separated token. */
function nearDuplicate(a: string, b: string): boolean {
  const left = a.split(/\s+/u);
  const right = b.split(/\s+/u);
  if (left.length !== right.length) {
    return false;
  }
  let differences = 0;
  for (const [index, token] of left.entries()) {
    if (token !== right[index]) {
      differences += 1;
    }
  }
  return differences <= 1;
}

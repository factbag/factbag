/**
 * Run one protocol over one ContractNLI split and score it against the gold labels.
 *
 * Usage: pnpm --filter @factbag/contract-nli-eval eval --protocol paper|naive --split dev|test
 *        [--limit N] [--concurrency N] [--model jev-1.13.0] [--data DIR] [--out DIR]
 *
 * Data: DIR holds ContractNLI's train.json, dev.json and test.json; defaults to
 * $FACTBAG_DATA_DIR/contract-nli. Predictions and raw detail are written as JSONL
 * beside a summary, so thresholds and policies can be re-scored without new requests.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { loadSplit } from "./data";
import type { Hypothesis, Split } from "./data";
import { bootstrap, score } from "./metrics";
import type { Judgment, Metrics } from "./metrics";
import { pool } from "./pool";
import { authored, guidance } from "./protocols/authored";
import { batchedProtocol } from "./protocols/batched";
import { factbagProtocol, naive } from "./protocols/factbag";
import { paperProtocol } from "./protocols/paper";
import { rules } from "./protocols/rules";
import type { ContractResult, Protocol } from "./protocols/types";

/** Jev list price at the time of the paper: USD 0.042 per million input tokens, output free. */
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const { values: args } = parseArgs({
  options: {
    protocol: { type: "string", default: "paper" },
    split: { type: "string", default: "dev" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "2" },
    model: { type: "string", default: "jev-1.13.0" },
    data: { type: "string" },
    out: { type: "string", default: fileURLToPath(new URL("../results", import.meta.url)) },
  },
});

const split = args.split;
if (split !== "train" && split !== "dev" && split !== "test") {
  throw new Error(`Unknown split ${split}`);
}
const dataDir = args.data ?? join(process.env["FACTBAG_DATA_DIR"] ?? "", "contract-nli");
if ((process.env["TYPESAFE_API_KEY"] ?? "") === "") {
  throw new Error("Set TYPESAFE_API_KEY in your shell or the repo's .env");
}

const sdk = new TypeSafeClient({ defaultModel: args.model, timeout: 300_000 });
const authoredGuide = (hypothesis: Hypothesis): string => {
  const guide = guidance[hypothesis.id];
  if (guide === undefined) {
    throw new Error(`No authored guidance for ${hypothesis.id}`);
  }
  return `${guide.description}\n\n${guide.instructions}`;
};
const protocols: Record<string, () => Protocol> = {
  paper: () => paperProtocol(sdk, args.model),
  "paper-authored": () => paperProtocol(sdk, args.model, authoredGuide),
  "paper-authored-single": () => paperProtocol(sdk, args.model, authoredGuide, true),
  batched: () => batchedProtocol(sdk, args.model),
  naive: () => factbagProtocol(sdk, naive),
  authored: () => factbagProtocol(sdk, authored),
  rules: () => factbagProtocol(sdk, rules),
};
const makeProtocol = protocols[args.protocol];
if (makeProtocol === undefined) {
  throw new Error(`Unknown protocol ${args.protocol}; choose ${Object.keys(protocols).join(", ")}`);
}
const protocol = makeProtocol();

const dataset = loadSplit(dataDir, split satisfies Split);
const contracts =
  args.limit === undefined ? dataset.contracts : dataset.contracts.slice(0, Number(args.limit));
const results: ContractResult[] = [];
const failures: { contractId: number; error: string }[] = [];
const startedAt = performance.now();

process.stdout.write(
  `${protocol.name} on ${split} (${contracts.length} contracts, model ${args.model})\n`,
);
await pool(contracts, Number(args.concurrency), async (contract, index) => {
  try {
    const result = await protocol.run(contract, dataset.hypotheses);
    results.push(result);
    const done = results.length + failures.length;
    process.stdout.write(
      `  [${done}/${contracts.length}] contract ${contract.id}: ${result.requests} req, ` +
        `${result.inputTokens} tok, ${(result.latencyMs / 1000).toFixed(1)}s\n`,
    );
  } catch (error) {
    failures.push({
      contractId: contract.id,
      error: error instanceof Error ? error.message : String(error),
    });
    process.stdout.write(`  [${index + 1}] contract ${contract.id} failed: ${String(error)}\n`);
  }
});
const wallMs = performance.now() - startedAt;

const byId = new Map(results.map((result) => [result.contractId, result]));
const judgments: Judgment[] = contracts.flatMap((contract) =>
  dataset.hypotheses.map((hypothesis) => ({
    contractId: contract.id,
    hypothesisId: hypothesis.id,
    gold: contract.gold[hypothesis.id] ?? "NotMentioned",
    predicted: byId.get(contract.id)?.labels[hypothesis.id],
  })),
);
const metrics = score(judgments);
const intervals = bootstrap(judgments);
const inputTokens = results.reduce((sum, result) => sum + result.inputTokens, 0);
const requests = results.reduce((sum, result) => sum + result.requests, 0);
const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);

const summary = {
  protocol: protocol.name,
  split,
  model: args.model,
  contracts: contracts.length,
  failed: failures,
  metrics,
  intervals,
  requests,
  inputTokens,
  usdPerContract: (inputTokens * USD_PER_INPUT_TOKEN) / Math.max(1, results.length),
  medianLatencyMs: latencies[Math.floor(latencies.length / 2)] ?? 0,
  wallMs,
  perHypothesis: perHypothesis(judgments),
  ranAt: new Date().toISOString(),
};

const outDir = join(args.out, protocol.name);
mkdirSync(outDir, { recursive: true });
const stem = args.limit === undefined ? split : `${split}-${args.limit}`;
writeFileSync(
  join(outDir, `${stem}.jsonl`),
  `${results.map((r) => JSON.stringify(r)).join("\n")}\n`,
);
writeFileSync(join(outDir, `${stem}.summary.json`), `${JSON.stringify(summary, null, 2)}\n`);

process.stdout.write(`\n${report(summary.protocol, metrics, summary.usdPerContract, intervals)}\n`);
process.stdout.write(`results: ${join(outDir, `${stem}.summary.json`)}\n`);

function report(name: string, m: Metrics, usd: number, ci: ReturnType<typeof bootstrap>): string {
  const pct = (value: number): string => (value * 100).toFixed(2);
  const recall = (label: keyof Metrics["classes"]): string => pct(m.classes[label].recall);
  return [
    `${name}: accuracy ${pct(m.accuracy)} [${pct(ci.accuracy[0])}, ${pct(ci.accuracy[1])}]`,
    `  macro-F1 ${pct(m.macroF1)}  invalid ${m.invalid}/${m.judgments}`,
    `  recall E ${recall("Entailment")}  C ${recall("Contradiction")}  N ${recall("NotMentioned")}`,
    `  USD/contract ${usd.toFixed(6)}  requests ${requests}  input tokens ${inputTokens}`,
  ].join("\n");
}

function perHypothesis(
  all: readonly Judgment[],
): Record<string, { accuracy: number; n: number; confusion: Record<string, number> }> {
  const out: Record<string, { accuracy: number; n: number; confusion: Record<string, number> }> =
    {};
  for (const hypothesis of dataset.hypotheses) {
    const mine = all.filter((j) => j.hypothesisId === hypothesis.id);
    const confusion: Record<string, number> = {};
    for (const j of mine) {
      const key = `${j.gold}->${j.predicted ?? "invalid"}`;
      confusion[key] = (confusion[key] ?? 0) + 1;
    }
    out[hypothesis.id] = { accuracy: score(mine).accuracy, n: mine.length, confusion };
  }
  return out;
}

/**
 * Run one of the four systems on a SARA split.
 *
 * Usage: pnpm --filter @factbag/sara-systems eval
 *        --system jev-factbag|jev-direct|llm-factbag|llm-direct
 *        [--split train|test] [--data DIR] [the system's flags]
 *        [--cases id,...] [--tag citation=2(a)(1)(A),...] [--limit N] [--concurrency N] [--out DIR]
 *
 * Each system's file documents its flags beside its definition.
 */
import { fileURLToPath } from "node:url";
import { main } from "@factbag/eval-runner";
import { benchmark } from "@factbag/sara-benchmark";
import { jevDirect } from "./jev-direct/system";
import { jevFactbag } from "./jev-factbag/system";
import { llmDirect } from "./llm-direct/system";
import { llmFactbag } from "./llm-factbag/system";

await main({
  benchmark,
  systems: {
    "jev-factbag": jevFactbag,
    "jev-direct": jevDirect,
    "llm-factbag": llmFactbag,
    "llm-direct": llmDirect,
  },
  out: fileURLToPath(new URL("../results", import.meta.url)),
});

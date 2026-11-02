import { invariant, atom, corpus, guarded } from "./base.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { query } from "factbag/dsl";
import { classifier, createConfig } from "@factbag/clef";

// Check from both the application and the installed package. A transitive or
// auto-installed peer must not silently satisfy the SDK-free consumer test.
for (const location of [import.meta.url, import.meta.resolve("factbag/kb")]) {
  const require = createRequire(location);
  assert.throws(() => require.resolve("@typesafe-ai/sdk"), { code: "MODULE_NOT_FOUND" });
}

/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  return Object.fromEntries(Object.entries(value));
}

// Clef runs through a Workers AI binding without the TypeSafe SDK installed.
/** @type {string[]} */
const runs = [];
const config = createConfig({
  binding: {
    /** @param {string} model @param {Record<string, unknown>} inputs */
    async run(model, inputs) {
      runs.push(model);
      const questions = record(inputs["questions"]);
      return await Promise.resolve({
        model: "clef-flash",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(
          Object.keys(questions).map((id) => [
            id,
            {
              type: "choice",
              choice: "ASSERT",
              confidence: 0.9,
              probabilities: { ASSERT: 0.9, DENY: 0.05, IRRELEVANT: 0.05 },
            },
          ]),
        ),
      });
    },
  },
});
const run = classifier({ corpus, input: guarded, config });
invariant(runs.length === 0, "Clef classifier eagerly called its binding");
await Promise.all([...run].map(async (job) => await job.execute()));
invariant(
  runs.join(",") === "@cf/cloudflare/clef-flash",
  "Clef classifier did not use its binding",
);
invariant(query(run.kb, atom).value === "true", "Clef classifier did not admit evidence");

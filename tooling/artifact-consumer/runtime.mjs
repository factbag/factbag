import { UnsupportedPredicateError } from "factbag/exceptions";
import { KnowledgeBase, guard } from "factbag/kb";
import { query } from "factbag/dsl";
import { classifier, createConfig, resolver } from "@factbag/jev";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { invariant, atom, kb, corpus, document, guarded } from "./base.mjs";

const jobs = classifier({ corpus, input: guarded });
invariant(typeof jobs[Symbol.iterator] === "function", "Jev classifier did not return jobs");
invariant(typeof resolver === "function", "Jev resolver export is not callable");
invariant(typeof UnsupportedPredicateError === "function", "Error export is not constructable");

// Execute both Jev entry points through a real SDK client over a scripted transport,
// without credentials or network calls. Adjudication questions offer KEEP; classification
// questions offer ASSERT.
/** @param {unknown} value @returns {Record<string, unknown>} */
function record(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, eslint/no-inline-comments -- A non-array object indexes by string; JSDoc casts are inline by construction.
  return /** @type {Record<string, unknown>} */ (value);
}

const calls = { count: 0 };
const client = new TypeSafeClient({
  apiKey: "packed-consumer",
  compression: false,
  retry: { maxRetries: 0 },
  /**
   * @param {string} _url
   * @param {RequestInit} [init]
   */
  async fetch(_url, init) {
    calls.count++;
    if (typeof init?.body !== "string") {
      throw new Error("Expected a JSON request body");
    }
    const questions = record(record(JSON.parse(init.body))["questions"]);
    return await Promise.resolve(
      Response.json({
        model: "packed-consumer",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(
          Object.entries(questions).map(([id, question]) => [
            id,
            "KEEP" in record(record(question)["criteria"])
              ? {
                  type: "choice",
                  choice: "RETRACT",
                  confidence: 0.9,
                  probabilities: { KEEP: 0.1, RETRACT: 0.9 },
                }
              : {
                  type: "choice",
                  choice: "ASSERT",
                  confidence: 0.9,
                  probabilities: { ASSERT: 0.9, DENY: 0.05, IRRELEVANT: 0.05 },
                },
          ]),
        ),
      }),
    );
  },
});
const config = createConfig({ client });
const denied = classifier({ corpus, input: guard(kb), config });
invariant([...denied].length === 0, "Default-deny guard exposed classification jobs");
const run = classifier({ corpus, input: guarded, config });
invariant(calls.count === 0, "Classifier eagerly called the client");
const job = [...run].at(0);
if (job === undefined) {
  throw new Error("Classifier did not produce a permitted job");
}
await job.execute();
invariant(calls.count === 1, "Classifier did not use the injected client");
invariant(Object.keys(job).join(",") === "execute", "Job exposed internal data");
invariant(run.kb.literals().length === 3, "Classifier omitted boolean candidates");
invariant(query(run.kb, atom).value === "true", "Classifier did not admit evidence");
invariant(kb.literals().length === 1, "Classifier mutated its input");

const conflict = new KnowledgeBase();
const source = corpus.slice(document, { start: 0, end: document.text.length }).id;
conflict.asserts(atom, { source });
conflict.denies(atom, { source });
const resolution = resolver(corpus, conflict, config);
invariant(calls.count === 1, "Resolver eagerly called the client");
const resolutionJob = [...resolution].at(0);
if (resolutionJob === undefined) {
  throw new Error("Resolver did not produce a contradiction job");
}
await resolutionJob.execute();
invariant(calls.count === 2, "Resolver did not use the injected client");
invariant(resolution.kb.literals().length === 0, "Resolver did not retract superseded evidence");
invariant(query(resolution.kb, atom).value === "unknown", "Resolved evidence remains");
invariant(query(conflict, atom).value === "conflicted", "Resolver mutated its input");

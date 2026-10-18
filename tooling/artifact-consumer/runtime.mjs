import { KnowledgeBase } from "factbag/kb";
import { query } from "factbag/query";
import { guard } from "factbag/guards";
import { classifier } from "factbag/jev/classifier";
import { UnsupportedPredicateError } from "factbag/jev/errors";
import { resolver } from "factbag/jev/resolve";
import { invariant, atom, kb, corpus, document, guarded } from "./base.mjs";

const jobs = classifier(corpus, guarded);
invariant(typeof jobs[Symbol.iterator] === "function", "Jev classifier did not return jobs");
invariant(typeof resolver === "function", "Jev resolver export is not callable");
invariant(typeof UnsupportedPredicateError === "function", "Jev error export is not constructable");

// Execute both Jev entry points with injected clients, without credentials or network calls.
const calls = { count: 0 };
/** @type {import("factbag/jev/classifier").ClassifierClient} */
const classificationClient = {
  /** @param {{ questions: Record<string, unknown> }} request */
  async systemOne(request) {
    calls.count++;
    return await Promise.resolve({
      model: "packed-consumer",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id) => [
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
};
const denied = classifier(corpus, guard(kb), { client: classificationClient });
invariant([...denied].length === 0, "Default-deny guard exposed classification jobs");
const run = classifier(corpus, guarded, { client: classificationClient });
invariant(calls.count === 0, "Classifier eagerly called the client");
const job = [...run].at(0);
if (job === undefined) {
  throw new Error("Classifier did not produce a permitted job");
}
const assessment = await job.execute();
invariant(calls.count === 1, "Classifier did not use the injected client");
invariant(assessment.assessments.length === 2, "Classifier omitted boolean candidates");
invariant(query(run.kb, atom).value === "true", "Classifier did not admit evidence");
invariant(kb.literals().length === 1, "Classifier mutated its input");

const conflict = new KnowledgeBase();
const source = corpus.slice(document, { start: 0, end: document.text.length }).id;
conflict.asserts(atom, { source });
conflict.denies(atom, { source });
const resolution = resolver(corpus, conflict, {
  client: {
    async systemOne(request) {
      calls.count++;
      return await Promise.resolve({
        model: "packed-consumer",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(
          Object.keys(request.questions).map((id) => [
            id,
            {
              type: "choice",
              choice: "RETRACT",
              confidence: 0.9,
              probabilities: { KEEP: 0.1, RETRACT: 0.9 },
            },
          ]),
        ),
      });
    },
  },
});
invariant(calls.count === 1, "Resolver eagerly called the client");
const resolutionJob = [...resolution].at(0);
if (resolutionJob === undefined) {
  throw new Error("Resolver did not produce a contradiction job");
}
const result = await resolutionJob.execute();
invariant(calls.count === 2, "Resolver did not use the injected client");
invariant(result.retracted.length === 2, "Resolver did not retract superseded evidence");
invariant(query(resolution.kb, atom).value === "unknown", "Resolved evidence remains");
invariant(query(conflict, atom).value === "conflicted", "Resolver mutated its input");

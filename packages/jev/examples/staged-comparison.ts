import assert from "node:assert/strict";
import { predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import type { GroundFields } from "@factbag/core/dsl";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "../src/classifier";
import type { ClassifierClient } from "../src/classifier";
import { stagedClassifier } from "../src/staged";
import type { RoutingClient } from "../src/staged";

class Person {
  constructor(readonly id: string) {}
}
const married = predicate(
  "married",
  { spouse: Person, partner: Person },
  { description: "The spouse is married to the partner." },
);
const kb = new KnowledgeBase();
kb.entities.add(...Array.from({ length: 10 }, (_, index) => new Person(`person-${index}`)));
const access = guard(kb).permit("assert", married).permit("deny", married);
const corpus = new Corpus();
corpus.add({ documentId: "notice", text: "person-0 is not married to person-1." });

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A non-array object indexes by string.
  return value as Record<string, unknown>;
}

function measuredClassifier(): {
  client: ClassifierClient;
  counts: { requests: number; questions: number };
} {
  const counts = { requests: 0, questions: 0 };
  const client: ClassifierClient = {
    async systemOne({ state, questions }) {
      counts.requests++;
      counts.questions += Object.keys(questions).length;
      const candidates = record(state)["candidates"];
      if (!Array.isArray(candidates)) {
        throw new Error("Expected candidates");
      }
      return await Promise.resolve({
        model: "deterministic-fixture",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: Object.fromEntries(
          candidates.map((candidate) => {
            const entry = record(candidate);
            if (typeof entry["id"] !== "string") {
              throw new Error("Expected candidate ID");
            }
            const fields = record(entry["fields"]);
            const denied =
              record(fields["spouse"])["id"] === "person-0" &&
              record(fields["partner"])["id"] === "person-1";
            return [
              entry["id"],
              {
                type: "choice" as const,
                choice: denied ? ("DENY" as const) : ("IRRELEVANT" as const),
                confidence: 1,
                probabilities: { ASSERT: 0, DENY: denied ? 1 : 0, IRRELEVANT: denied ? 0 : 1 },
              },
            ];
          }),
        ),
      });
    },
  };
  return { client, counts };
}

const routingClient: RoutingClient = {
  async systemOne({ questions }) {
    return await Promise.resolve({
      model: "deterministic-fixture",
      usage: { input_tokens: 0, output_tokens: 0 },
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => {
          const instructions = record(question.instructions);
          const role = instructions["role"];
          const retained =
            role === undefined ||
            record(instructions["value"])["id"] === (role === "spouse" ? "person-0" : "person-1");
          return [id, { type: "noul" as const, noul: retained ? 1 : 0 }];
        }),
      ),
    });
  },
};

const exhaustiveTransport = measuredClassifier();
const exhaustive = classifier(corpus, access, { client: exhaustiveTransport.client });
await Promise.all([...exhaustive].map(async (job) => await job.execute()));

const stagedTransport = measuredClassifier();
const staged = stagedClassifier(corpus, access, { client: stagedTransport.client, routingClient });
const stagedCounts = { requests: 0, questions: 0 };
await Promise.all(
  [...staged].map(async (chunk) => {
    await Promise.all(chunk.relevance.map(async (job) => await job.execute()));
    await Promise.all(chunk.participants().map(async (job) => await job.execute()));
    await Promise.all(chunk.classification().map(async (job) => await job.execute()));
    const inspection = chunk.inspect();
    for (const stage of [
      inspection.relevance,
      inspection.participants,
      inspection.classification,
    ]) {
      stagedCounts.requests += stage.requests;
      stagedCounts.questions += stage.questions;
    }
  }),
);
const facts = (output: KnowledgeBase): { sign: string; fields: GroundFields }[] =>
  output.literals().map(({ sign, atom }) => ({ sign, fields: atom.fields }));
assert.deepEqual(facts(staged.kb), facts(exhaustive.kb));
assert.equal(staged.kb.literals().length, 1);
assert.equal(kb.literals().length, 0);
assert.deepEqual(exhaustiveTransport.counts, { requests: 2, questions: 90 });
assert.deepEqual(stagedCounts, { requests: 3, questions: 22 });
process.stdout.write(
  `${JSON.stringify({ exhaustive: exhaustiveTransport.counts, staged: stagedCounts }, null, 2)}\nIdentical admitted facts in this scripted fixture. No live cost or recall measurement.\n`,
);

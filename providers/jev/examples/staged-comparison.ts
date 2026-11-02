import { record } from "./utils";
import assert from "node:assert/strict";
import { predicate, type GroundFields } from "factbag/dsl";
import { KnowledgeBase, guard } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { classifier } from "../src/index";

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

/**
 * A scripted Jev over a fake transport, counting requests and questions. Routing questions
 * retain person-0 and person-1 across both roles; classification denies exactly
 * that pair and finds everything else irrelevant.
 */
function scripted(): { client: TypeSafeClient; counts: { requests: number; questions: number } } {
  const counts = { requests: 0, questions: 0 };
  const client = new TypeSafeClient({
    apiKey: "scripted",
    compression: false,
    retry: { maxRetries: 0 },
    async fetch(_url, init) {
      if (typeof init?.body !== "string") {
        throw new Error("Expected a JSON request body");
      }
      const body = record(JSON.parse(init.body));
      const questions = record(body["questions"]);
      const state = record(body["state"]);
      counts.requests++;
      counts.questions += Object.keys(questions).length;
      return await Promise.resolve(
        Response.json({
          model: "deterministic-fixture",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers: Object.fromEntries(
            Object.entries(questions).map(([id, question]) => [
              id,
              answer(id, record(question), state),
            ]),
          ),
        }),
      );
    },
  });
  return { client, counts };
}

function answer(
  id: string,
  question: Record<string, unknown>,
  state: Record<string, unknown>,
): Record<string, unknown> {
  if (question["type"] === "noul") {
    const instructions = record(question["instructions"]);
    const retained =
      !("value" in instructions) ||
      ["person-0", "person-1"].includes(String(record(instructions["value"])["id"]));
    return { type: "noul", noul: retained ? 1 : 0 };
  }
  const candidate_facts = state["candidate_facts"];
  if (!Array.isArray(candidate_facts)) {
    throw new Error("Expected candidates");
  }
  const candidate = candidate_facts.map(record).find((entry) => entry["id"] === id);
  if (candidate === undefined) {
    throw new Error(`Unknown candidate ${id}`);
  }
  const fields = record(candidate["fields"]);
  const denied =
    record(fields["spouse"])["id"] === "person-0" && record(fields["partner"])["id"] === "person-1";
  return {
    type: "choice",
    choice: denied ? "DENY" : "IRRELEVANT",
    confidence: 1,
    probabilities: { ASSERT: 0, DENY: denied ? 1 : 0, IRRELEVANT: denied ? 0 : 1 },
  };
}

const exhaustiveTransport = scripted();
const exhaustive = classifier({
  corpus,
  input: access,
  config: {
    client: exhaustiveTransport.client,
    routing: false,
  },
});
await Promise.all([...exhaustive].map(async (job) => await job.execute()));

const stagedTransport = scripted();
const staged = classifier({
  corpus,
  input: access,
  config: {
    client: stagedTransport.client,
    routing: true,
  },
});
await Promise.all([...staged].map(async (job) => await job.execute()));
const facts = (output: KnowledgeBase): { sign: string; fields: GroundFields }[] =>
  output.literals().map(({ sign, atom }) => ({ sign, fields: atom.fields }));
assert.deepEqual(facts(staged.kb), facts(exhaustive.kb));
assert.equal(staged.kb.literals().length, 1);
assert.equal(kb.literals().length, 0);
assert.deepEqual(exhaustiveTransport.counts, { requests: 2, questions: 90 });
assert.deepEqual(stagedTransport.counts, { requests: 3, questions: 13 });
process.stdout.write(
  `${JSON.stringify({ exhaustive: exhaustiveTransport.counts, staged: stagedTransport.counts }, null, 2)}\nIdentical admitted facts in this scripted fixture. No live cost or recall measurement.\n`,
);

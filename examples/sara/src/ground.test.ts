import { expect, test } from "vitest";
import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { ground, renderFields } from "./ground";
import type { MeteredClient } from "@factbag/eval-shared/meter";

function client(retain: boolean): { client: MeteredClient; stages: string[] } {
  const stages: string[] = [];
  return {
    stages,
    client: {
      async systemOne<const Q extends Questions>({
        questions,
      }: {
        questions: Q;
      }): Promise<SystemOneResult<Q>> {
        const answers = Object.fromEntries(
          Object.entries(questions).map(([id, question]) => {
            stages.push(question.type);
            return [
              id,
              question.type === "noul"
                ? { type: "noul", noul: retain ? 1 : 0 }
                : {
                    type: "choice",
                    choice: "IRRELEVANT",
                    confidence: 1,
                    probabilities: { ASSERT: 0, DENY: 0, IRRELEVANT: 1 },
                  },
            ];
          }),
        );
        // The fixture returns the corresponding answer shape for each question type.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Controlled mock answers match each input question type.
        return await Promise.resolve({
          model: "fixture",
          usage: { input_tokens: 0, output_tokens: 0 },
          answers,
        } as SystemOneResult<Q>);
      },
    },
  };
}

const text = "Alice married Bob on January 1, 2017. Charlie and Daniel lived together in 2017.";

test("staged grounding uses the supplied transport for every pass and reads the text's domains", async () => {
  const stagedClient = client(true);
  const staged = await ground(text, {
    client: stagedClient.client,
    routing: { candidateProductCutoff: 0 },
  });
  expect(staged.people.map((p) => p.id)).toEqual(["Alice", "Bob", "Charlie", "Daniel"]);
  expect(staged.domains.fields?.["year"]).toEqual([2017]);
  expect(staged.domains.Date?.map((date) => date.toISOString().slice(0, 10))).toEqual([
    "2017-01-01",
  ]);
  expect(staged.unclassified).toContain("paid");
  expect(staged.literals.map((l) => renderFields(l.atom.fields))).toEqual([]);
  expect(stagedClient.stages).toContain("noul");
  expect(stagedClient.stages).toContain("choice");
  expect(staged.routing[0]?.participants.requests).toBeGreaterThan(0);
  expect(staged.routing[0]?.decisions[0]?.predicate).toEqual(expect.any(String));
  expect(staged.requests).toBe(
    staged.routing.reduce(
      (sum, audit) =>
        sum +
        audit.relevance.requests +
        audit.participants.requests +
        audit.classification.requests,
      0,
    ),
  );
});

test("routing rejection is recorded separately from missing candidate domains and admits no facts", async () => {
  const transport = client(false);
  const result = await ground(text, { client: transport.client });
  expect(result.literals).toEqual([]);
  expect(result.routing[0]?.classification.requests).toBe(0);
  expect(result.routing[0]?.candidates.every((c) => c.bypass === "irrelevant")).toBe(true);
  expect(result.unclassified).not.toContain("child_of");
  expect(transport.stages.every((s) => s === "noul")).toBe(true);
});

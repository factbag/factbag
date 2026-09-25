import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { SystemOneRequest } from "@typesafe-ai/sdk";
import { query } from "@factbag/core/query";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import createJ1Scenario from "@factbag/scenarios/j1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.stubEnv("TYPESAFE_API_KEY", "test-key");
  vi.stubEnv("TYPESAFE_BASE_URL", "https://jev.example.invalid");
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

it.each(["positive", "negative", "contradictory", "contradictory-document", "neutral"] as const)(
  "classifies the J-1 %s scenario using the default client",
  async (caseName) => {
    // ARRANGE — Shared inputs and ground truth, fresh for this run.
    const scenario = createJ1Scenario(caseName);
    const { kb, corpus, predicates } = scenario;
    const requested = new Set<string>();
    // Scripted model responses are independent of the document annotations.
    server.use(
      http.post<never, SystemOneRequest>(
        "https://jev.example.invalid/v1/systemone",
        async ({ request }) => {
          const body = await request.json();
          const state = body.state;
          assert.ok(state !== null && typeof state === "object" && !Array.isArray(state));
          const passage = state["document"];
          assert.ok(passage !== null && typeof passage === "object" && !Array.isArray(passage));
          const text = passage["text"];
          assert.ok(typeof text === "string");
          // Requests carry no document IDs, so the passage is identified by its text.
          const document = corpus.documents().find((candidate) => candidate.text === text);
          assert.ok(document !== undefined);
          requested.add(document.documentId);
          // The complete payload contains the passage text and candidate fields—not identifiers or labels.
          expect(body.state).toEqual({
            document: { text: document.text },
            candidates: [
              {
                id: "candidate_0",
                fields: {
                  person: {
                    id: scenario.applicant.id,
                    name: scenario.applicant.name,
                    type: "Person",
                  },
                },
              },
            ],
          });
          const choice =
            document.documentId === "j1/document-1"
              ? "ASSERT"
              : document.documentId === "j1/document-2"
                ? "DENY"
                : "IRRELEVANT";
          const conflicting = document.documentId === "j1/document-5";
          return HttpResponse.json({
            model: "test-model",
            usage: { input_tokens: 0, output_tokens: 0 },
            answers: {
              candidate_0: {
                type: "choice",
                choice: conflicting ? "ASSERT" : choice,
                confidence: conflicting ? 0.5 : 0.98,
                // The existing default admission policy admits both sides of an exact 0.5 tie.
                probabilities: conflicting
                  ? { ASSERT: 0.5, DENY: 0.5, IRRELEVANT: 0 }
                  : {
                      ASSERT: choice === "ASSERT" ? 0.98 : 0.01,
                      DENY: choice === "DENY" ? 0.98 : 0.01,
                      IRRELEVANT: choice === "IRRELEVANT" ? 0.98 : 0.01,
                    },
              },
            },
          });
        },
      ),
    );

    // ACT — The consumer chooses permissions and execution order.
    const run = classifier(corpus, guard(kb).permit("*", predicates.tenureTrack));
    for (const job of run) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- A deliberately sequential walkthrough.
      await job.execute();
    }

    // ASSERT — Evaluate outputs independently against the scenario's expectations.
    expect(requested.size).toBe(corpus.documents().length);
    expect(kb.literals()).toEqual([]);
    for (const { atom, value } of scenario.expected) {
      expect(query(run.kb, atom).value).toBe(value);
    }
    for (const document of corpus.documents()) {
      const actual = run.kb
        .literals()
        .filter(
          ({ metadata }) =>
            metadata?.source !== undefined && corpus.resolve(metadata.source).document === document,
        );
      expect(actual.map(({ sign, atom }) => ({ sign, atom }))).toEqual(document.metadata.evidence);
    }
  },
);

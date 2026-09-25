import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { enumeration, predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "../src/classifier";
import { distribution } from "./fixtures";

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

it("distinguishes a cancellation reason from an explicit denial and missing information", async () => {
  // ARRANGE — One interview, three possible reasons.
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  const cancellation = { customer: "Cobalt", event: "cancellation-2026-09-01" };
  const interview = corpus.add({
    documentId: "cobalt-exit-interview",
    text: "Cobalt's exit interview for the 2026-09-01 cancellation: recurring outages contributed to leaving. The subscription price did not contribute.",
  });

  const contributed = predicate(
    "contributed_to_cancellation",
    {
      customer: enumeration(cancellation.customer),
      event: enumeration(cancellation.event),
      factor: enumeration("reliability", "price", "competition"),
    },
    {
      description:
        "The document reports that this factor contributed to this customer's cancellation event.",
      instructions:
        "Require a reported contribution. Explicit non-contribution is denial; silence is irrelevant.",
    },
  );

  // Mock the HTTP response, not the SDK. Candidate order follows the factor enum.
  // Invented probabilities, in ASSERT / DENY / IRRELEVANT order.
  server.use(
    http.post("https://jev.example.invalid/v1/systemone", () =>
      HttpResponse.json({
        model: "test-model",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers: {
          // reliability
          candidate_0: distribution(0.94, 0.02, 0.04),
          // price
          candidate_1: distribution(0.03, 0.91, 0.06),
          // competition
          candidate_2: distribution(0.01, 0.01, 0.98),
        },
      }),
    ),
  );

  // ACT — The default SDK client makes HTTP requests intercepted by MSW.
  const run = classifier(corpus, guard(kb).permit("*", contributed));
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- This example executes jobs sequentially.
    await job.execute();
  }
  const enriched = run.kb;

  // ASSERT — Supported, explicitly denied, and unmentioned are different outcomes.
  const reliability = contributed({ ...cancellation, factor: "reliability" });
  const price = contributed({ ...cancellation, factor: "price" });
  const competition = contributed({ ...cancellation, factor: "competition" });

  expect(query(enriched, reliability).value).toBe("true");
  expect(query(enriched, price).value).toBe("false");
  expect(query(enriched, competition).value).toBe("unknown");
  expect(kb.literals()).toEqual([]);

  // Both admitted pieces of evidence point back to the interview.
  expect(enriched.literals()).toHaveLength(2);
  for (const evidence of enriched.literals()) {
    const source = evidence.metadata?.source;
    if (source === undefined) {
      throw new Error("Expected documentary evidence to have a source");
    }
    expect(corpus.resolve(source).document.documentId).toBe(interview.documentId);
  }
});

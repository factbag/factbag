import assert from "node:assert/strict";
import { zstdDecompressSync } from "node:zlib";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { TypeSafeClientConfig } from "@typesafe-ai/sdk";
import type { DemoAnswer, Fixture } from "./fixtures";

/** Intercept the real SDK's HTTP requests; `using` closes the server even when a demo fails. */
export function mockJev(
  fixtures: readonly Fixture[],
): Disposable & { clientOptions: TypeSafeClientConfig } {
  const baseURL = "https://jev.example.invalid";
  const server = setupServer(
    http.post(`${baseURL}/v1/systemone`, async ({ request }) => {
      // SDK 0.7 compresses requests on runtimes with Zstandard support.
      const payload: unknown =
        request.headers.get("content-encoding") === "zstd"
          ? JSON.parse(zstdDecompressSync(Buffer.from(await request.arrayBuffer())).toString())
          : await request.json();
      const body = record(payload);
      const state = record(body["state"]);
      const questions = record(body["questions"]);
      const text = record(state["document"])["text"];
      const candidates: unknown = state["candidates"];
      assert.ok(Array.isArray(candidates), "Expected candidate fields in the HTTP request");
      assert.equal(candidates.length, Object.keys(questions).length);

      const answers: Record<string, DemoAnswer> = {};
      for (const item of candidates) {
        const candidate = record(item);
        const id = candidate["id"];
        assert.ok(typeof id === "string");
        const question = record(questions[id]);
        const predicate = record(record(question["instructions"])["predicate"])["name"];
        const fixture = fixtures.find(
          (entry) => entry.text === text && entry.predicate === predicate,
        );
        const expected = fixture?.answers[id];
        assert.ok(expected, `No scripted HTTP response for ${String(predicate)} / ${id}`);
        assert.equal(question["type"], "choice");
        assert.deepEqual(
          candidate["fields"],
          expected.fields,
          "Candidate fields do not match the scripted response",
        );
        answers[id] = expected.answer;
      }

      return HttpResponse.json({
        model: "demo-fixtures-not-a-live-model",
        usage: { input_tokens: 0, output_tokens: 0 },
        answers,
      });
    }),
  );
  server.listen({ onUnhandledRequest: "error" });
  return {
    clientOptions: { apiKey: "offline-demo", baseURL, retry: { maxRetries: 0 } },
    [Symbol.dispose]() {
      server.close();
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object shape is checked above; properties remain unknown.
  return value as Record<string, unknown>;
}

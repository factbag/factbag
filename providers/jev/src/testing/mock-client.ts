import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Questions, SystemOneRequest } from "@typesafe-ai/sdk";
import { vi } from "vitest";
import type { Mock } from "vitest";

/** A scripted Jev: the transport mock answers each parsed request body, and all requests are kept. */
type MockClient<Q extends Questions> = TypeSafeClient & {
  readonly transport: Mock<(request: SystemOneRequest<Q>) => unknown>;
  readonly requests: SystemOneRequest<Q>[];
};

/**
 * A real SDK client over a mock HTTP transport. Requests go through the SDK's own encoding
 * and the JSON body is handed to `respond`, whose return value becomes the response body, so
 * tests can script malformed answers as well as valid ones. Retries are off so a single
 * scripted failure is a single failure.
 */
export function mockClient<Q extends Questions = Questions>(
  respond: (request: SystemOneRequest<Q>) => unknown,
): MockClient<Q> {
  const transport = vi.fn(respond);
  const requests: SystemOneRequest<Q>[] = [];
  const client = new TypeSafeClient({
    apiKey: "test",
    compression: false,
    retry: { maxRetries: 0 },
    async fetch(_url, init) {
      if (typeof init?.body !== "string") {
        throw new Error("Expected a JSON request body");
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The SDK sent the request it was given.
      const request = JSON.parse(init.body) as SystemOneRequest<Q>;
      requests.push(request);
      return Response.json(await transport(request));
    },
  });
  return Object.assign(client, { transport, requests });
}

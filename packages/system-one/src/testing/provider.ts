import { vi } from "vitest";
import type { Mock } from "vitest";
import type { Provider, SystemOneRequest, Transport } from "../provider";
import { systemOne } from "../system-one";
import type { SystemOne } from "../system-one";
import { isRecord } from "../utils";

/** A scripted model: the mock answers each request as sent, and all requests are kept. */
type MockClient = Transport & {
  readonly transport: Mock<(request: SystemOneRequest) => unknown>;
  readonly requests: SystemOneRequest[];
};

/**
 * A transport whose answers come from `respond`. Requests pass through JSON first, as they
 * would on the wire, so tests see exactly what a model would receive. `respond` may return
 * malformed answers as well as valid ones.
 */
export function mockClient(respond: (request: SystemOneRequest) => unknown): MockClient {
  const transport = vi.fn(respond);
  const requests: SystemOneRequest[] = [];
  const send: Transport = async (request) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON round-trips the request it was given.
    const sent = JSON.parse(JSON.stringify(request)) as SystemOneRequest;
    requests.push(sent);
    const body = await transport(sent);
    return { answers: isRecord(body) ? body["answers"] : undefined };
  };
  return Object.assign(send, { transport, requests });
}

/** A provider whose only option is the transport itself. */
export function testProvider(
  limits: Partial<Pick<Provider<object>, "maxBatchSize" | "defaultBatchSize">> = {},
): Provider<{ client: Transport }> {
  return {
    name: "test",
    maxBatchSize: Infinity,
    defaultBatchSize: 64,
    ...limits,
    connect: ({ client }) => {
      if (client === undefined) {
        throw new Error("The test provider needs a client");
      }
      return client;
    },
  };
}

/** Classification and resolution bound to the test provider. */
const bound: SystemOne<{ client: Transport }> = systemOne(testProvider());
export const classifier: typeof bound.classifier = bound.classifier;
export const resolver: typeof bound.resolver = bound.resolver;
export const createConfig: typeof bound.createConfig = bound.createConfig;

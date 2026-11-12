/**
 * A TypeSafe client that counts what it sends. The classifier and the
 * question reader both take a client, so one metered client per case meters the case.
 */
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  APIPromise,
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";

export class MeteredClient extends TypeSafeClient {
  requests = 0;
  inputTokens = 0;
  outputTokens = 0;

  // oxlint-disable-next-line typescript/promise-function-async -- The override must return the SDK's APIPromise.
  override systemOne<const Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ): APIPromise<SystemOneResult<Q>> {
    const pending = super.systemOne(request, options);
    // Counted when the request settles, before the caller's own continuation runs.
    void pending.then(
      ({ usage }) => {
        this.requests += 1;
        this.inputTokens += usage.input_tokens ?? 0;
        this.outputTokens += usage.output_tokens ?? 0;
      },
      () => undefined,
    );
    return pending;
  }
}

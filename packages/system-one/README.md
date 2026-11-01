# @factbag/system-one

Classification and resolution over any
[System One](https://docs.typesafe.ai/concepts/system-one.md) model. This package
holds everything that does not depend on the vendor:

- the evidence workflows: candidate enumeration, routing, admission, and resolution;
- what the model is asked: request state, question wording, and batching;
- how answers are read: validation, and the provenance kept in evidence annotations.

Applications don't import this package. They import a provider package, such as
`@factbag/jev` or `@factbag/clef`, which binds these workflows to one model.

## Writing a provider

A provider supplies only how to reach its model and how much one request may hold:

```ts
import { systemOne } from "@factbag/system-one";
import type { SystemOne } from "@factbag/system-one";

export const vendor: SystemOne<{ client: VendorClient }> = systemOne({
  // Namespace for the model's details in evidence annotations.
  name: "vendor",
  // The most questions one request may hold. Use Infinity when only context limits it.
  maxBatchSize: 64,
  // Questions per request when the caller does not choose.
  defaultBatchSize: 64,
  // Called once per configuration, on its first request.
  connect:
    ({ client = new VendorClient() }) =>
    async (request) =>
      await client.send(request),
});
```

`systemOne` checks the provider's limits when the provider package loads. The
result has `classifier`, `resolver`, and `createConfig`. Each accepts one flat
config: the shared `Settings` beside the provider's own options. Each provider
package re-exports these from its single entry point.

`batchSize` is validated against `maxBatchSize` as soon as a config is created
or a run is built. Work that can be split, such as relevance and classification,
is sent in `batchSize` slices. Adjudication must ask about every passage in one
request, so it throws before sending if the passages exceed `maxBatchSize`.

# Clairic symbol extractor

`@factbag/symbol-extractor-clairic` implements System One's `ChunkSymbolExtractor`
with [Clairic](https://developers.cloudflare.com/workers-ai/models/clairic/),
Cloudflare's extraction model on Workers AI. Clairic is in preview. The package
exports `createChunkSymbolExtractor` and its configuration type,
`SymbolExtractorConfig`.

## Usage

```ts
import { predicate } from "factbag/dsl";
import { classifier } from "@factbag/clef";
import { createChunkSymbolExtractor } from "@factbag/symbol-extractor-clairic";

class Person {
  constructor(readonly id: string) {}
}
const paid = predicate(
  "paid",
  { payer: Person, payee: String, amount: Number, on: Date },
  {
    description: "The payer paid the payee the amount, in dollars, on the date.",
    parameters: { payee: "The organization or person paid." },
  },
);

// corpus and input are your corpus and guarded knowledge base.
const run = classifier({
  corpus,
  input,
  createChunkSymbolExtractor: (chunks) =>
    createChunkSymbolExtractor(chunks, {
      entities: [[Person, (name) => new Person(name)]],
      referenceDate: "2024-06-01",
    }),
});
```

Each query sends one request per chunk for every 8 requested fields. Every requested field becomes a Clairic
list field whose instructions name the predicate and field and quote the
predicate's `description` and the field's `parameters` entry. Clairic reads values
for that field, so good descriptions give better candidates.

| Field type   | Clairic list items | Candidates                                    |
| ------------ | ------------------ | --------------------------------------------- |
| `String`     | `text`             | Text spans of the passage                     |
| `Number`     | `number`           | Numbers, to six decimals                      |
| `Date`       | `date`             | Dates, as UTC midnight                        |
| Entity class | `text`             | Text spans passed through the class's factory |

Entity fields of classes without a factory are not sent; Jev and Clef still offer
their registered entities. Items Clairic cannot normalize, such as an impossible
date, are skipped.

## Configuration

- `entities` lists one name factory per entity class. A factory for a scalar
  type, or a second factory for the same class, throws `TypeError` at
  construction.
- `referenceDate` is an ISO date that anchors dates written without a year.
- `batchSize` is the most fields one request asks about, default 8. A query with
  more fields sends several requests per chunk, in parallel. Clairic misreads values
  more often when one request asks about many fields: with about 40 fields, it has
  read the year 2015 as 2.015.
- `binding` sends requests through a Workers AI binding, such as `env.AI` in a
  Worker. Without one, requests go to Cloudflare's REST API with `accountId` and
  `apiToken`, which default to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
  and are read on the first request. Pass `fetch` to add retries or timeouts.

A failed request, or a response without an answer for every field, rejects the
query, which fails the classifier job.

## Live check

`pnpm --filter @factbag/symbol-extractor-clairic live` asks Clairic for the
fields of one payment passage, then classifies it with Clef over those values.
It needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.

# @factbag/jev

`classifier({ corpus, input: kb, config })` returns a lazy iterator of executable
classification jobs, one per chunk. Constructing and consuming the iterator makes **no remote calls**. The caller
decides when to execute each job and how much work to run concurrently.

The package has one entry point, `@factbag/jev`, which exports:

- `classifier({ corpus, input: kb, config? })`
- `resolver(corpus, kb, config?)`
- `createConfig`, `Config`, and the `DEFAULT_*` constants

## Install

```sh
npm install factbag@alpha @factbag/jev@alpha @typesafe-ai/sdk@^0.7.0
```

`@factbag/jev` is released with `factbag` and needs the same `factbag` version.
Set `TYPESAFE_API_KEY`, or pass your own `TypeSafeClient` as `config.client`.

## Usage

```ts
import { enumeration, predicate } from "factbag/dsl";
import { KnowledgeBase } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/guards";
import { classifier } from "@factbag/jev";

class Company {
  constructor(
    readonly id: string,
    readonly tradingName: string,
  ) {}
}

const status = predicate(
  "company_status",
  {
    company: Company,
    status: enumeration("active", "dissolved"),
  },
  {
    description: "The document explicitly establishes this company's legal status.",
  },
);

const kb = new KnowledgeBase();
kb.entities.add(new Company("company-42", "Harbor"));
const corpus = new Corpus();
corpus.add({ documentId: "registry", text: "Harbor is an active company." });

// The default TypeSafeClient reads TYPESAFE_API_KEY on the first execute().
const run = classifier({
  corpus,
  input: guard(kb).permit("assert", status).permit("deny", status),
});

for (const job of run) {
  await job.execute();
  // The consumer may await persistence or a rate limiter here.
}

const enriched = run.kb;
// kb is unchanged. enriched contains the original knowledge plus new evidence.
```

## Boundary and registration

Classification and resolution share one optional, flat `Config`. Create it once
with `createConfig` to share one lazy client across runs:

```ts
const config = createConfig({ client, minimumProbability: 0.6 });
const classified = classifier({ corpus, input: kb, config });
const resolved = resolver(corpus, classified.kb, config);
```

Admission defaults to `{ minimumProbability: 0.4, ambiguityMargin: 0 }`:
the strongest ASSERT/DENY outcome must reach 0.4 and outrank IRRELEVANT. An exact
ASSERT/DENY tie admits both. These are convenience defaults, not calibrated probabilities.
A plainly worded record often scores in the 0.45-0.65 band, so 0.5 loses evidence a reader
would call clear; a lower bar writes more, and contradictions surface rather than gaps.

```ts
classifier({ corpus, input: kb });
classifier({ corpus, input: kb, config: { client } });
classifier({ corpus, input: kb, config: { minimumProbability: 0.8, ambiguityMargin: 0.05 } });
```

- A **guarded KB** retains its exact permit/block policy. `guard(kb)` is default-deny.
- A **bare KB** permits assert/deny for all predicates referenced in its
  evidence and rules, including rule bodies. There is no global predicate registry.
- Query permissions do not make a predicate classifiable.
- Every exposed predicate is validated synchronously during `classifier(...)`.
  Unsupported predicates fail even if the corpus is empty; blocked predicates are
  not registered.

`UnsupportedPredicateError` (from `factbag/exceptions`) identifies the predicate and, where applicable, the
field that cannot be classified. A nonempty metadata description is required.

Supported field domains:

| Schema field               | Candidate values                         |
| -------------------------- | ---------------------------------------- |
| `Boolean`                  | `false`, `true`                          |
| `enumeration(...)`         | Explicit string, number, or Date members |
| Entity constructor         | Instances registered in `kb.entities`    |
| `String`, `Number`, `Date` | Unsupported open-ended domains           |

An entity domain must contain registered instances. Existing scalar facts do not
turn an open-ended schema into an enum. To model a fixed value, declare it explicitly
with `enumeration(value)` rather than asking the classifier to discover it.

Number and Date enumerations, such as `enumeration(10, 20)` or
`enumeration(new Date("2026-10-25T00:00:00Z"))`, are classified like string
enumerations. Dates are sent to the model as ISO strings and retained as `Date`
values in evidence. The same date in two fields is a valid candidate; only
repeated entities are excluded.

Entity candidates include their enumerable properties, including `id`, plus `type`
set to the constructor name. They are JSON-encoded when each request is built:
nested properties are included, dates become ISO strings, and methods are not sent.
For example, the company above is sent as
`{ type: "Company", id: "company-42", tradingName: "Harbor" }`.
Evidence continues to reference the original registered entity. Related KB facts
are not automatically included in the entity payload.

Fields fan out as a Cartesian product. A predicate with no fields has one candidate
proposition. Every candidate gets an independent `Choice(ASSERT, DENY, IRRELEVANT)`
question. Assert and deny permissions for the same predicate share one question.
No enum exclusivity or Boolean equivalence is assumed; those belong to the ruleset.

## Jobs and execution

`run` is a single-cursor `IterableIterator`. Each yielded job classifies one chunk
and exposes only `execute(): Promise<void>`, sending up to `batchSize` questions per
request. `batchSize` defaults to 64. TypeSafe sets no upper limit. Re-executing a job makes a fresh attempt; a repeated
success adds fresh evidence.

The consumer can execute jobs sequentially, in batches, or through a concurrency
limiter. Jobs contain no scheduler, rate limiter, retry loop, or error handler.
`config.client` is optional and defaults to `new TypeSafeClient()`, created on the
first request. Pass a configured client to set the model, retry, timeout or
transport, or a scripted one in tests.

Request errors propagate unchanged from `execute()`. All answers for a chunk are
validated before any of that chunk's evidence is written. A failure does not
terminate the job iterator, remove earlier evidence, or retry automatically.
The caller can retry the same job or advance to another job.

`run.kb` is a live output store. Concurrent jobs add evidence in completion order.
Existing evidence, rules and entities retain their identities, but the storage
containers are independent of the input KB. Candidate domains use the construction-
time KB snapshot; new evidence does not introduce new candidates during a run.

## Corpus traversal

The classifier reads the whole corpus: every document present at construction
time. There is no source selection; to classify a subset, pass a
filtered view such as `corpus.filter((document) => document.metadata["kind"] !== "structured")`.
Its chunks register in the shared corpus, so evidence resolves from any handle. The adapter always uses a private recursive
splitter: up to **8,000 Unicode graphemes**, with up to
**200 graphemes of overlap**, preferring paragraph, line, and word boundaries.
Short documents remain intact. Jev constructs `chunkers.recursive()` internally;
source ranges and jobs are produced as iteration advances. The chunker indexes
the current document's grapheme boundaries when iteration starts.

Overlap supplies neighboring context. There is no configurable chunker or context
expansion step on the classifier API.

This is a conservative text-sizing policy, not an exact token budget. Jev 1.13's
[documented limits](https://docs.typesafe.ai/models) are 32k tokens for state plus
the longest question and 64k for the whole request. Candidate state, metadata and
questions also consume that budget; this passage bound alone does not guarantee
that arbitrarily large candidate batches fit.

Requests carry only the passage text. Chunk IDs, document IDs and source ranges are
kept out of them, so document names and coordinates cannot influence the model.

Each evidence source is the exact consumed chunk ID, resolvable through `corpus.resolve(source)`. The ID encodes the document and
range, and document text is immutable.

## Admission and results

- When `IRRELEVANT` is at least as probable as either polarity, admit neither.
- Otherwise, a polarity must meet `minimumProbability` and fall within
  `ambiguityMargin` of the stronger polarity.
- Only permitted polarities are inserted. Forbidden outcomes are not relabeled or
  renormalized into permitted ones.
- Both polarities can be admitted, preserving evidence that needs review.

New literals carry source, outcome probability,
candidate IDs, selected choice, SDK confidence, and the full distribution. SDK confidence remains separate from outcome probability. These
thresholds are application policy, not calibrated defaults.

## Optional relevance filtering

Set `config: { routing: true }` to reduce the candidate facts sent for classification
by filtering predicates and values for relevance to each passage. Each chunk job
first asks which predicates the passage may bear on. For predicates that make claims
about supplied entities or values, it can also ask which of those symbols the passage
involves. For example, before classifying ownership claims, it can narrow the list
of companies to those relevant to the passage. Only combinations of the retained
symbols are classified.

Symbol filtering runs when a retained predicate has symbols to filter and its
candidate combinations exceed `candidateProductCutoff` (default 16). Each distinct
symbol is checked once across all surviving predicates and roles. Boolean field
values are always retained. `predicateThreshold` and `symbolThreshold`
(default 0.3) are inclusive.

Filtering is **off by default**: a false negative in either pass silently drops
evidence, including denials. Filtering adds requests and does not guarantee cost savings. Run
`pnpm --filter @factbag/jev demo:staged` to compare both modes on a scripted fixture.

## Resolving contradictions

Each chunk is classified on its own, so a 2012 removal notice and a 2022
redesignation can leave the same fact asserted and denied. `resolver` reads those
passages together and asks, for each one, whether its account still stands. It works
like `classifier`: construction makes no remote calls, and each job is one request.

```ts
import { resolver } from "@factbag/jev";

const resolution = resolver(corpus, run.kb);
for (const job of resolution) {
  await job.execute();
}
const resolved = resolution.kb;
```

- There is one job per atom with evidence of both signs. Its `execute()` sends
  every distinct source passage in one request with a KEEP/RETRACT
  question per passage: does another passage supersede this one for the fact as
  described, including any date it is stated as of? Disagreement alone is not
  supersession, so two documents that merely conflict both stand.
- The model judges documents, not the fact. Evidence from a retracted passage is removed
  from `resolution.kb`; the rest stays, and the solver decides what the surviving
  evidence means. Retracting every passage leaves the fact `unknown`, which is right:
  the evidence was withdrawn, not disproved.
- A passage is retracted only when RETRACT reaches `minimumProbability` and leads KEEP by
  more than `ambiguityMargin` (defaults 0.4 and 0). With two outcomes that means RETRACT must
  exceed 0.5 in practice, whatever the minimum. Keeping the evidence is the default,
  so an uncertain answer changes nothing.
- Every piece of conflicting evidence must have a `source` that resolves in the corpus.
  Construction throws for evidence without a source, naming the atom, and propagates
  corpus errors such as `Invalid chunk ID`, so no job exists until all are readable.
  To resolve a KB with stipulated or tool-sourced evidence, decide those contradictions
  first or resolve a fork without them.
- `resolution.kb` is an independent copy of the input, which is unchanged.
  Contradictions are independent, so jobs can run in any order or concurrently.
- A job settles once. Request errors propagate unchanged and leave the job retryable;
  executing it again after it succeeds throws. `config.client` defaults to
  `new TypeSafeClient()`, as for the classifier.

## Internal structure

This package only connects Jev to the shared workflows in `@factbag/system-one`:
the TypeSafe client, Jev's batch limits, and the public signatures. Candidate
selection, admission, prompts, batching, and answer validation live there and are
bundled into the published package. The same code serves `@factbag/clef`.

## Examples and checks

Read [Fix one fact, not the whole answer](https://github.com/factbag/factbag/blob/main/providers/jev/docs/README.md) for the narrative, or the
[example notes](https://github.com/factbag/factbag/blob/main/providers/jev/examples/README.md) for the runnable scenarios.

```sh
pnpm --filter @factbag/jev demo
pnpm --filter @factbag/jev test
pnpm --filter @factbag/jev typecheck
```

Demos use the real SDK with MSW HTTP interception; focused unit tests also use
injected clients. Neither needs credentials or live inference.

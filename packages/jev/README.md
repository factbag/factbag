# @factbag/jev

`classifier(corpus, kb, config)` returns a lazy iterator of executable classification
jobs. Constructing and consuming the iterator makes **no remote calls**. The caller
decides when to execute each job and how much work to run concurrently.

The package has three entry points, each exporting one runtime name:

| Entry point               | Export                            |
| ------------------------- | --------------------------------- |
| `@factbag/jev/classifier` | `classifier(corpus, kb, config?)` |
| `@factbag/jev/resolve`    | `resolver(corpus, kb, config?)`   |
| `@factbag/jev/errors`     | `UnsupportedPredicateError`       |

## Usage

```ts
import { enumeration, predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";

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
const run = classifier(corpus, guard(kb).permit("assert", status).permit("deny", status));

for (const job of run) {
  const result = await job.execute();
  console.log(result.assessments);
  // The consumer may await persistence or a rate limiter here.
}

const enriched = run.kb;
// kb is unchanged. enriched contains the original knowledge plus new evidence.
```

## Boundary and registration

Options are optional. Admission defaults to `{ minimumProbability: 0.4, ambiguityMargin: 0 }`:
the strongest ASSERT/DENY outcome must reach 0.4 and outrank IRRELEVANT. An exact
ASSERT/DENY tie admits both. These are convenience defaults, not calibrated probabilities.
A plainly worded record often scores in the 0.45-0.65 band, so 0.5 loses evidence a reader
would call clear; a lower bar writes more, and contradictions surface rather than gaps.

```ts
classifier(corpus, kb);
classifier(corpus, kb, { client });
classifier(corpus, kb, {
  admission: { minimumProbability: 0.8, ambiguityMargin: 0.05 },
});
```

- A **guarded KB** retains its exact permit/block policy. `guard(kb)` is default-deny.
- A **bare KB** exposes assert/deny tools for all predicates referenced in its
  evidence and rules, including rule bodies. There is no global predicate registry.
- Query permissions do not create classifier tools.
- Every exposed predicate is validated synchronously during `classifier(...)`.
  Unsupported predicates fail even if the corpus is empty; blocked predicates are
  not registered.

`UnsupportedPredicateError` (from `@factbag/jev/errors`) identifies the predicate and, where applicable, the
field that cannot be classified. A nonempty metadata description is required.

Supported field domains:

| Schema field                 | Candidate values                               |
| ---------------------------- | ---------------------------------------------- |
| `Boolean`                    | `false`, `true`                                |
| `enumeration("a", "b", ...)` | Explicit enum members                          |
| Entity constructor           | Instances registered in `kb.entities`          |
| `String`, `Number`, `Date`   | Values supplied in `domains`, else unsupported |

An entity domain must contain registered instances. Existing scalar facts do not
turn an open-ended schema into an enum. A scalar field is classified over the
candidate values the request config supplies, typically the values the passages
mention: the values given under the field's name in `domains.fields`, else the
values given for its constructor. A field with neither, or with none, is rejected:

```ts
classifier(corpus, kb, {
  domains: {
    Date: [new Date("2014-07-09T00:00:00Z"), new Date("2015-09-14T00:00:00Z")],
    Number: [33_200, 1_200],
    // Every `year` field takes the years; other Number fields take the amounts.
    fields: { year: [2017, 2018] },
  },
});
```

Dates are sent as ISO strings; evidence carries the original values. To model a
fixed value, declare it explicitly with `enumeration(value)` rather than asking the
classifier to discover it.

Entity candidates include their enumerable properties, including `id`, plus `type`
set to the constructor name. These are JSON snapshots taken at run construction:
nested properties are included, dates become ISO strings, and methods are not sent.
For example, the company above is sent as
`{ type: "Company", id: "company-42", tradingName: "Harbor" }`.
Evidence continues to reference the original registered entity. Related KB facts
are not automatically included in the entity payload.

Fields fan out as a Cartesian product. A predicate with no fields has one candidate
proposition. Every candidate gets an independent `Choice(ASSERT, DENY, IRRELEVANT)`
question. Assert and deny tools for the same predicate share one request per chunk.
No enum exclusivity or Boolean equivalence is assumed; those belong to the ruleset.

## Jobs and execution

`run` is a single-cursor `IterableIterator`. Each yielded job has `source`,
`predicate`, and `execute()`. One execution makes one SDK call, potentially batching
many candidate questions. Re-executing a job makes a fresh attempt; a repeated
success adds fresh evidence.

The consumer can execute jobs sequentially, in batches, or through a concurrency
limiter. Jobs contain no scheduler, rate limiter, retry loop, or error handler.
`config.client` is optional and defaults to `new TypeSafeClient()`, created on the
first request. Pass a configured client to set the model, retry, timeout or
transport, or a scripted one in tests.

Request errors propagate unchanged from `execute()`. All answers in a request are
validated before any of that request's evidence is written. A failure does not
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

The returned assessment retains every candidate atom and full response, including
candidates producing no literals. New literals carry source, outcome probability,
candidate IDs, selected choice, SDK confidence, and the full distribution. SDK confidence remains separate from outcome probability. These
thresholds are application policy, not calibrated defaults.

## Optional staged routing

Set `classifier`'s `routing` option to an object to filter predicates and role
candidates before classifying complete propositions. Routing is **off by default**
because filtering can silently lose recall, including denials. Omit `routing` or
set it to `false` to keep exhaustive classification and the flat job iterator.
The public `factbag` package exposes the same classifier at `factbag/jev/classifier`.
Both strategies use registered entities and supplied scalar domains; neither
discovers new symbols, dates, or amounts.

With routing enabled, the classifier yields `RoutedChunk` plans instead of flat
jobs. Each plan has explicit barriers between dependent passes. This keeps existing
exhaustive consumers unchanged while exposing dependencies only when they exist:

```ts
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { classifier } from "@factbag/jev/classifier";

const client = new TypeSafeClient();
const run = classifier(corpus, kb, {
  client,
  routing: {
    client,
    relevanceThreshold: 0.3,
    participantThreshold: 0.3,
    candidateProductCutoff: 16,
  },
  admission: { minimumProbability: 0.4, ambiguityMargin: 0 },
});

for (const chunk of run) {
  for (const job of chunk.relevance) await job.execute();
  for (const job of chunk.participants()) await job.execute();
  for (const job of chunk.classification()) await job.execute();
  console.log(chunk.inspect());
}
```

1. **Predicate relevance:** Each permitted predicate gets an independent yes/no
   question per chunk. Multiple predicates can survive. Questions explicitly count
   negative evidence as relevant.
2. **Participant filtering:** Each supplied value gets an independent question
   for each non-Boolean argument role. For example, spouse and partner have separate
   candidate sets, even when both roles use `Person`. Scalar and enum values are
   filtered in the same way. Boolean fields remain exhaustive. This pass is skipped
   for zero-argument predicates, Boolean-only schemas, and raw candidate products
   at or below `candidateProductCutoff` (default 16).
3. **Proposition classification:** Surviving role domains are enumerated, excluding
   repeated entities as in exhaustive classification. The existing
   ASSERT/DENY/IRRELEVANT questions, admission policy, permission enforcement, and
   evidence provenance apply unchanged. Only this pass inserts evidence.

Routing uses the installed SDK's `NoulQuestion` (`type: "noul"`) and its
`NoulResponse.noul` yes-probability. It does not use a single exclusive Choice to
select multiple predicates or values. Each routing threshold is inclusive, must
be in `[0, 1]`, and defaults to 0.3. These thresholds are separate from final
admission and are not calibrated guarantees. Setting both to zero retains every
valid routing answer but still incurs routing requests. The product cutoff must
be a nonnegative safe integer; zero disables the small-product bypass.

### Execution and inspection

Construction and iteration make no remote calls. Each job makes at most one SDK
call per attempt, batching up to 64 questions. `participants()` throws until every
relevance job succeeds. `classification()` throws until every participant job
succeeds. Empty passes satisfy their barrier immediately. Accessors return stable
jobs and never execute them. You can run jobs within a pass, or independent chunk
plans, through your own concurrency limiter.

Successful routing jobs memoize their results; concurrent calls to the same job
share an attempt. A transport or validation failure propagates and leaves that job
retryable. The entire response batch must validate before its decisions become
visible. Failed routing does not produce downstream jobs or facts. Final jobs
retain the exhaustive classifier's semantics: each execution is a fresh attempt,
and repeated successes insert fresh evidence. Earlier successful jobs survive a
later failure; the run is not a transaction.

`client` configures final classification; `routing.client` configures the filtering
passes. Each defaults independently to a lazy `TypeSafeClient`. Pass the same SDK
instance to both to share model, timeout, and retry configuration.

`chunk.inspect()` returns:

- Routing decisions with predicate, optional role/value, probability, and whether
  the value survived. Decisions appear in completion order.
- Per-predicate initial and retained Cartesian products, final classification
  candidate counts, and bypass reasons. Initial products include repeated-entity
  combinations; final candidate counts exclude them. Retained and final counts
  become available when you call `classification()`.
- Per-stage request and question counts for attempted SDK calls, including failed
  attempts. Memoized routing results do not increment counts. SDK-internal retries
  are not visible. These are workload counts, not token, latency, or billing totals.

### Comparison and limitations

Run the deterministic comparison without credentials:

```sh
pnpm --filter @factbag/jev demo:staged
```

The scripted fixture checks identical admitted facts for both strategies. It
measures 90 questions in 2 exhaustive requests versus 22 questions in 3 staged
requests, including both filtering passes. It illustrates fewer questions but
more requests; it does not measure live token cost, latency, or model accuracy.

**Filtering can reduce recall.** A false negative in either routing pass prevents
final classification of the affected propositions, including denials. Independent
role filtering also retains cross-combinations that the passage might not support;
the final classifier must reject those. Compare against exhaustive classification
on representative labeled data before choosing thresholds. Small domains can cost
more with staging because relevance still adds a request.

Domains and JSON entity payloads are captured at construction. Permissions, input-KB
isolation, chunk provenance, and corpus traversal follow the exhaustive strategy.
Staging avoids constructing the initial Cartesian product, but a large surviving
product still consumes memory and classification work. Request batching is a
question-count bound, not a token-budget guarantee. There is no automatic fallback
to exhaustive classification after filtering or a failed request.

## Resolving contradictions

Each chunk is classified on its own, so a 2012 removal notice and a 2022
redesignation can leave the same fact asserted and denied. `resolver` reads those
passages together and asks, for each one, whether its account still stands. It works
like `classifier`: construction makes no remote calls, and each job is one request.

```ts
import { resolver } from "@factbag/jev/resolve";

const resolution = resolver(corpus, run.kb);
for (const job of resolution) {
  const { atom, judgments, retracted } = await job.execute();
}
const resolved = resolution.kb;
```

- There is one job per atom with evidence of both signs. Each job has `atom`,
  `passages` (every distinct chunk behind the evidence, from each literal's `source`)
  and `execute()`, which sends all the passages in one request with a KEEP/RETRACT
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
- Each resolution records the atom, one judgment per passage (its standing, the full
  answer and the literals it cost), and the evidence kept and retracted overall.
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

- `classifier.ts`: boundary normalization, KB snapshots and lazy chunk/job traversal.
- `routing.ts`: optional per-chunk routing passes, barriers, memoized routing jobs, and inspection accounting, owned by the classifier.
- `resolve.ts`: finds contradictions, gathers their passages, and creates lazy jobs that apply admission and retract superseded evidence in a fork.
- `types.ts`: shared shapes, including `Tool` (a validated predicate, its permitted actions and candidates) and `ToolResult` (a validated answer, not yet written).
- `tools.ts`: eager predicate validation, role-domain snapshots, shared candidate enumeration, encoding, and 64-question batching. Exhaustive runs enumerate once per predicate; routed runs enumerate filtered domains per chunk.
- `client.ts`: the Jev adapter. Builds Choice requests for a tool and chunk, and KEEP/RETRACT requests for a contradiction's passages, and validates each complete response.
- `jobs.ts`: lazy jobs and evidence application: admission, permission checks and writes to the output KB. Also the shared admission defaults and validation.
- `errors.ts`: `UnsupportedPredicateError`.

Named implementation types belong to their owning modules; they are not additional
package exports. The public factory's signature exposes their structure for inference.

## Examples and checks

Read [Fix one fact, not the whole answer](docs/README.md) for the narrative, or the
[example notes](examples/README.md) for the runnable scenarios.

```sh
pnpm --filter @factbag/jev demo
pnpm --filter @factbag/jev test
pnpm --filter @factbag/jev typecheck
```

Demos use the real SDK with MSW HTTP interception; focused unit tests also use
injected clients. Neither needs credentials or live inference.

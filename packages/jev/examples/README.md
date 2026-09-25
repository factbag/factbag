# Running the Jev examples

Read [Fix one fact, not the whole answer](../docs/README.md) for the explanation.
From the repository root:

```sh
pnpm --filter @factbag/jev demo
pnpm --filter @factbag/jev test
```

The examples use the real `TypeSafeClient`, with MSW intercepting HTTP requests
and returning scripted distributions. They run offline and need no credentials.
Their numbers are demonstration data, not accuracy measurements.

## Where to look

- Start with [`factors-simple.test.ts`](./factors-simple.test.ts): a short Arrange / Act / Assert
  walkthrough of one interview and three reasons. It checks supported, denied, and
  unknown results, plus their source provenance. Run it independently:
  `pnpm --filter @factbag/jev exec vitest run examples/factors-simple.test.ts`.
- `sanctions.ts`: import fictional blocking-list and ownership records by code,
  then use Jev for documentary claims about a nominee arrangement. Review a
  specific conflicting memo and recompute the ownership conclusion.
- `factors.ts`: assess several reported contributors to a cancellation. Each row
  retains support for both polarities, including ambiguous answers. A separate
  KB demonstrates setting evidence aside without modifying the original case.
- `support-score.ts`: a deliberately local weakest-link/strongest-route policy.
- `mock-jev.ts`: MSW intercepts `POST /v1/systemone`, checking the document,
  predicate, and candidate fields before returning an HTTP response. The real SDK
  handles request serialization and response parsing. `using` closes interception
  when each demo exits, including on failure; unhandled requests fail.
- `fixtures.ts`: shared response types and the probability-distribution helper.
- `run.ts`: prints the results. It does not contain the domain logic.
- `walkthrough.test.ts`: verifies the stories and the helper's limitations.

## Parser usage

The simple example is a Vitest test using standard MSW setup/teardown hooks,
`vi.stubEnv`, and an HTTP response defined directly in the Arrange section.
Its `classifier(...)` call needs no options or injected client.

Both demos construct `classifier` with a guarded KB over a filtered view of the
corpus that excludes structured records, then execute the yielded jobs
sequentially. Classifier fields use explicit
finite enums rather than guessed string values. Assessments are the results of
`job.execute()`; `run.kb` is the independent enriched store. The examples choose
their own execution pace, and callers can use the same jobs with a concurrency limiter.

## Scope of the score helper

`supportScore()` summarizes only settled positive atom/AND/OR proofs. An explicit
`scores.support` takes precedence; otherwise the helper uses `scores.probability`.
The sanctions demo gives structured inputs support 1 as a stated modeling
assumption, not a model probability or an estimate of source accuracy. Evidence
alternatives use maximum, conjunctions use minimum, and disjunctions use maximum
over their settled positive children. Rules carry their body's score.

It returns `null` for an unsettled root, unsupported operations, or missing or
invalid scores in the selected positive support. False/unknown/conflicted OR
children do not provide a positive route; their judgments still remain available
for inspection. This is a score over the returned proof, not a search over all
possible proofs or a claim of calibrated probability.

The helper is outside `src` and is not exported by the package. Calibration is a
documentation discussion only. No general scoring or review framework is added
to the runtime API.

## Review and persistence

The sanctions example excludes one specific denial after a scripted human review.
The decision, excluded evidence, original assessments, and source document remain
available in its result. The structured imports and accepted legal confirmation
are not regenerated.
This demonstrates a local correction; it does not implement a durable review
store or prevent a later ingestion from adding the same evidence again.

The corpus stores its text and ranges in memory and exposes synchronous methods.
Only the Jev requests in these examples are asynchronous. An application would
save the corpus, evidence, and review decisions at its own I/O boundary.

## Scope of the sanctions example

The named companies, identifiers, list snapshot, share register, and documents
are all fictional. The snapshot and pre-resolved IDs are treated as complete
for the exact membership checks shown. Source date and method are stored on
each imported literal; a lack of a model score is never implicitly treated as
certainty.

The rule demonstrates a single nominee holding of at least 50% for one blocked
owner, with the arrangement effective at the screening date. It does not implement
aggregation across multiple owners, recursive ownership chains, entity resolution,
licenses, or other sanctions-program restrictions. A negative result is only a
negative result under this bounded demo policy. Board control alone supplies no
ownership evidence. The relevant real-world distinctions are described in
[OFAC FAQ 401](https://ofac.treasury.gov/faqs/401) and
[OFAC FAQ 398](https://ofac.treasury.gov/faqs/398).

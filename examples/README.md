# Reusable scenarios and examples

- [`scenarios`](./scenarios): `@factbag/scenarios` supplies fresh KBs, corpora, and
  independently authored expectations for examples and evals.
- [`jev`](./jev): `@factbag/jev-examples` consumes those scenarios in ordinary
  Vitest/MSW tests, using the default SDK client.
- [`shared`](./shared): `@factbag/eval-shared` holds the benchmark-independent pieces
  the evaluations below share: the staged grounding driver, name scanning, request
  metering, bootstrap intervals and a bounded concurrency pool.
- [`sara`](./sara), [`clutrr`](./clutrr), [`contract-nli`](./contract-nli): evaluations
  of Factbag against published benchmarks, each with a direct-Jev baseline and its
  results under `results/`. They read the datasets from `$FACTBAG_DATA_DIR` and need a
  TypeSafe API key to run; their unit tests do not.

```sh
pnpm --filter @factbag/scenarios test
pnpm --filter @factbag/jev-examples test
```

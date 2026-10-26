# Reusable scenarios and examples

- [`scenarios`](./scenarios): `@factbag/scenarios` supplies fresh KBs, corpora, and
  independently authored expectations for examples and evals.
- [`jev`](./jev): `@factbag/jev-examples` consumes those scenarios in ordinary
  Vitest/MSW tests, using the default SDK client.
- [`shared`](./shared): `@factbag/eval-shared` holds the benchmark-independent pieces
  the evaluations share: the staged grounding driver, name scanning, request metering,
  bootstrap intervals and a bounded concurrency pool.
- [`sara`](./sara): an evaluation of Factbag against the SARA statutory reasoning
  benchmark, with a direct-Jev baseline and its results under `results/`. It reads the
  dataset from `$FACTBAG_DATA_DIR` and needs a TypeSafe API key to run; its unit tests
  do not.

```sh
pnpm --filter @factbag/scenarios test
pnpm --filter @factbag/jev-examples test
```

# Evaluations

Benchmarks that measure Factbag end to end against published datasets, and the systems
run on them. Each is a private workspace package; datasets are not vendored, and runs
that call a model need its credentials.

A benchmark owns its cases and what counts as correct; a system answers one case's input.
The runner joins the two, so any system that takes a benchmark's input can be run on it
and scored the same way.

- [`runner`](./runner): `@factbag/eval-runner`, the contract that benchmark and systems
  packages export, `run`, and the command line they share.
- [`benchmarks/`](./benchmarks): one package per dataset, holding its loader and where it
  comes from. A benchmark knows nothing of the systems run on it.
  - [`sara`](./benchmarks/sara): `@factbag/sara-benchmark`, the StAtutory Reasoning
    Assessment.
- [`systems/`](./systems): one package per benchmark, holding a directory for each system
  that answers it and what those systems share.
  - [`sara`](./systems/sara): `@factbag/sara-systems`: `jev-factbag` and `jev-direct`.

```sh
pnpm --filter "./evals/**" test
pnpm --filter @factbag/sara-systems eval --system jev-factbag
```

# Evaluations

Benchmarks that measure Factbag end to end against published datasets, and the systems
run on them. Each is a private workspace package; datasets are not vendored, and runs
that call a model need its credentials.

A benchmark owns its cases and what counts as correct; a system answers one case's input.
The runner joins the two, so any system that takes a benchmark's input can be run on it
and scored the same way.

- [`runner`](./runner): `@factbag/eval-runner`, the contract that benchmark and systems
  packages export, `run`, and the command line they share.

```sh
pnpm --filter "./evals/**" test
```

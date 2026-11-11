# SARA

SARA, the StAtutory Reasoning Assessment, as a benchmark for the
[eval runner](../../runner). SARA pairs short case descriptions with statements about how
nine sections of the US Internal Revenue Code apply to them, each labelled `Entailment` or
`Contradiction`.

This package holds only the benchmark: how its cases are loaded and what counts as
correct. The systems run on it are in [`systems/sara`](../../systems/sara).

## Source

Nils Holzenberger, Andrew Blair-Stanek and Benjamin Van Durme, "A Dataset for Statutory
Reasoning in Tax Law Entailment and Question Answering", 2020
([arXiv:2005.05257](https://arxiv.org/abs/2005.05257)).

The dataset is MIT licensed and is not vendored: pass the extracted `sara/` directory,
which holds `cases/`, `splits/` and `statutes/`, as `--data`, or put it at
`$FACTBAG_DATA_DIR/sara`.

## What is loaded

- Each case's input is the scenario `text`, the `question` without its answer, and the
  `statute` text of the section that the question cites.
- Cases are tagged with their `section` and, when they cite one, their `citation`.
- Only the English text, the question, the answer and the statute sections are read.
  SARA's Prolog facts and goals are never used.
- The numeric cases, which ask how much tax a person owes, are not loaded.

## Exports

- `benchmark`: the `BenchmarkDefinition` for the runner's `main`, with the flags
  `--split train|test` (train by default) and `--data DIR`.
- `sara({ dataDir, split })`: the cases of one split.
- `citationOf(question)` and `withoutCitations(question)`: the citation a question names,
  and the question without it.

```sh
pnpm --filter @factbag/sara-benchmark test
```

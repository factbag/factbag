# Eval runner

Runs a system over a benchmark's cases and writes the report. It knows nothing of
Factbag or any model, so a system is anything that answers a case's input.

```ts
import { run } from "@factbag/eval-runner";
import type { Benchmark, System } from "@factbag/eval-runner";

await run(benchmark, system, { out: "results", concurrency: 4 });
```

- A `Benchmark` has a `name` and its `cases`, each with an `id`, the system's `input`,
  the `gold` label and `tags` to select cases by and break the score down by.
- A `System` has a `name`, an optional `config` written to the summary, and `solve`, which
  answers one input with a label, or `undefined` when it has none, the `usage` of each
  model it asked, and an optional `detail` kept in the case's record.

A case the system leaves unanswered or throws on counts as wrong; a throw is recorded
with its message and the run goes on. `run` writes `<benchmark>-<system>-<stamp>.jsonl`,
one record per case, and a `.summary.json` beside it with the accuracy and its 95%
bootstrap interval, the score by tag, usage and spend by model, and latency.

## Packages and the command line

Benchmarks and systems live in separate packages, and each exports a definition that
says how to build it from the command line:

- A benchmark package exports a `BenchmarkDefinition`: its `flags` and `load`.
- A systems package exports a `SystemDefinition` for each system: its `flags`, the `env`
  variables that its models need, its default `concurrency` and `create`.

A systems package's run script hands both to `main`:

```ts
import { main } from "@factbag/eval-runner";
import { benchmark } from "@factbag/some-benchmark";

await main({ benchmark, systems: { rules: rulesSystem, direct: directSystem }, out });
```

`main` reads `--system NAME`, the benchmark's flags, the chosen system's flags and the
flags every run shares: `--cases id,...`, `--tag name=value,...` (repeatable),
`--limit N`, `--concurrency N` and `--out DIR`. Before any case is loaded, it refuses an
unknown system, a flag that the chosen system does not take, an unset environment
variable, and a flag that the system rejects. Two systems can declare the same flag with
different defaults; each sees its own.

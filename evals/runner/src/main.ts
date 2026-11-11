/**
 * The command line every systems package shares: pick one of its systems, check what the
 * run needs, load the benchmark and run.
 *
 *   --system NAME [the benchmark's flags] [the system's flags]
 *   [--cases id,...] [--tag name=value,value ...] [--limit N] [--concurrency N] [--out DIR]
 */
import { parseArgs } from "node:util";
import { RUN_ARGS, runOptions } from "./cli";
import { run } from "./run";
import type { RunSummary } from "./run";
import type { BenchmarkDefinition, Flags, FlagValues, SystemDefinition } from "./types";

export type MainOptions<Input, Label extends string> = Readonly<{
  benchmark: BenchmarkDefinition<Input, Label>;
  /** The systems the package offers for the benchmark, by the name --system takes. */
  systems: Readonly<Record<string, SystemDefinition<Input, Label>>>;
  /** The directory reports are written to unless --out says otherwise. */
  out: string;
  /** Defaults to the process's arguments. */
  argv?: readonly string[];
  /** Defaults to the process's environment. */
  env?: Readonly<Record<string, string | undefined>>;
}>;

/**
 * Run the system the command line names on the benchmark. Throws, before any case is
 * read, for an unknown system, a flag the chosen system and the benchmark do not take, an
 * environment variable the system needs that is unset, or a flag the system rejects.
 */
export async function main<Input, Label extends string>(
  options: MainOptions<Input, Label>,
): Promise<RunSummary> {
  const { benchmark, systems, env = process.env } = options;
  const declared = [benchmark.flags, ...Object.values(systems).map((system) => system.flags)];
  // Defaults are applied per definition below: two systems may default one flag differently.
  const known = Object.fromEntries(
    declared.flatMap((flags) => Object.keys(flags)).map((name) => [name, { type: "string" }]),
  );
  const { values } = parseArgs({
    args: [...(options.argv ?? process.argv.slice(2))],
    options: { ...known, ...RUN_ARGS, system: { type: "string" } },
  });
  const system = systems[values.system ?? ""];
  if (system === undefined) {
    throw new Error(`Pass --system ${Object.keys(systems).join("|")}`);
  }
  const given: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string" && name in known) {
      if (!(name in benchmark.flags) && !(name in system.flags)) {
        throw new Error(`--${name} is not a flag of the system ${values.system}`);
      }
      given[name] = value;
    }
  }
  const unset = system.env.filter((name) => (env[name] ?? "") === "");
  if (unset.length > 0) {
    throw new Error(`Set ${unset.join(", ")} in your shell`);
  }
  // Created first, so a flag the system rejects is reported before the data is read.
  const created = system.create(valuesOf(system.flags, given));
  return await run(benchmark.load(valuesOf(benchmark.flags, given)), created, {
    concurrency: system.concurrency,
    ...runOptions(values, options.out),
  });
}

/** A definition's own flags: its defaults under what the command line gave. */
function valuesOf(flags: Flags, given: Readonly<Record<string, string>>): FlagValues {
  return Object.fromEntries(
    Object.entries(flags).map(([name, flag]) => [name, given[name] ?? flag.default]),
  );
}

/**
 * The contract between a benchmark and a system under test. A benchmark owns its cases
 * and what counts as correct; a system answers one case's input. Neither knows about the
 * other's internals, so any system that takes a benchmark's input can be run against it.
 */

/** One case: what the system reads, and the label it should answer. */
export type Case<Input, Label extends string> = Readonly<{
  id: string;
  input: Input;
  gold: Label;
  /** Labels to select cases by and to break the score down by, such as a statute citation. */
  tags: Readonly<Record<string, string>>;
}>;

export type Benchmark<Input, Label extends string> = Readonly<{
  /** Names the report and its files, such as "contracts-train". */
  name: string;
  cases: readonly Case<Input, Label>[];
}>;

/** What one model was asked while answering a case, priced at list price. */
export type Usage = Readonly<{
  model: string;
  requests: number;
  inputTokens: number;
  usd: number;
}>;

export type Solution<Label extends string> = Readonly<{
  /** The system's answer, or undefined when it has none. Unanswered counts as wrong. */
  answer: Label | undefined;
  usage: readonly Usage[];
  /** Anything the system wants kept beside the answer; written to the case's record as-is. */
  detail?: unknown;
}>;

export type System<Input, Label extends string> = Readonly<{
  /** Names the report and its files, such as "factbag-jev". */
  name: string;
  /** The settings the answers depend on, written to the summary as-is. */
  config?: unknown;
  solve: (input: Input) => Promise<Solution<Label>>;
}>;

/** The flags a definition reads from the command line, as `parseArgs` takes them. */
export type Flags = Readonly<Record<string, Readonly<{ type: "string"; default?: string }>>>;

/** The values of a definition's flags: its defaults under what the command line gave. */
export type FlagValues = Readonly<Record<string, string | undefined>>;

/**
 * What a benchmark package exports for `main`: how to load its cases from the command
 * line. A benchmark owns its data and nothing else, so it has no systems of its own.
 */
export type BenchmarkDefinition<Input, Label extends string> = Readonly<{
  flags: Flags;
  load: (flags: FlagValues) => Benchmark<Input, Label>;
}>;

/**
 * What a systems package exports for `main`, once per system: how to build the system
 * from the command line, and what a run of it needs.
 */
export type SystemDefinition<Input, Label extends string> = Readonly<{
  /** The environment variables its models need; `main` refuses to run without them. */
  env: readonly string[];
  /** Cases solved at once unless --concurrency says otherwise. */
  concurrency: number;
  flags: Flags;
  /** Throws for a flag that is missing or malformed. */
  create: (flags: FlagValues) => System<Input, Label>;
}>;

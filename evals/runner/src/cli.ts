/**
 * The flags every run script shares, for `parseArgs`, beside the script's own:
 *
 *   [--cases id,...] [--tag name=value,value ...] [--limit N] [--concurrency N] [--out DIR]
 */
import type { RunOptions } from "./run";

export const RUN_ARGS = {
  cases: { type: "string" },
  tag: { type: "string", multiple: true },
  limit: { type: "string" },
  concurrency: { type: "string" },
  out: { type: "string" },
} as const;

type RunArgs = Readonly<{
  cases?: string;
  tag?: readonly string[];
  limit?: string;
  concurrency?: string;
  out?: string;
}>;

/** The run options the shared flags give, writing to `out` when no --out is passed. */
export function runOptions(args: RunArgs, out: string): RunOptions {
  const tags: Record<string, string[]> = {};
  for (const text of args.tag ?? []) {
    const [name, values] = text.split("=", 2);
    if (name === undefined || name === "" || values === undefined) {
      throw new Error(`Pass --tag name=value,value, not ${text}`);
    }
    (tags[name] ??= []).push(...list(values));
  }
  return {
    out: args.out ?? out,
    ...(args.cases === undefined ? {} : { ids: list(args.cases) }),
    ...(args.tag === undefined ? {} : { tags }),
    ...(args.limit === undefined ? {} : { limit: count("--limit", args.limit) }),
    ...(args.concurrency === undefined
      ? {}
      : { concurrency: count("--concurrency", args.concurrency) }),
  };
}

function list(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function count(flag: string, text: string): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${flag} takes a positive whole number, not ${text}`);
  }
  return value;
}

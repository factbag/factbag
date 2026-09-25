/**
 * Settle contradictions in a knowledge base by reading each one's evidence together.
 *
 * @packageDocumentation
 */
import type { AnyAtom } from "@factbag/core/dsl";
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import type { Chunk, Corpus, Metadata } from "@factbag/corpus";
import { jevAdjudicator } from "./client";
import type { AdjudicatorClient } from "./client";
import { admissionPolicy } from "./jobs";
import type { AdmissionPolicy } from "./jobs";
import type { Standing, StandingChoice } from "./types";

/** Client and admission settings supplied by the consumer. Model, timeout and retry settings belong to the client. */
type ResolutionConfig = {
  /** Defaults to `new TypeSafeClient()`, configured from `TYPESAFE_*` environment variables. */
  readonly client?: AdjudicatorClient;
  /** A passage is retracted only when RETRACT reaches minimumProbability and leads KEEP by more than ambiguityMargin. Defaults to 0.5 and 0. */
  readonly admission?: AdmissionPolicy;
};

/** One passage's judged standing and the evidence it cost. */
type Judgment = Readonly<{
  passage: Chunk;
  standing: Standing;
  answer: StandingChoice;
  retracted: readonly AnyLiteral[];
}>;

/** How one contradiction was settled: a judgment per passage, and the evidence that survived. */
type Resolution = Readonly<{
  atom: AnyAtom;
  judgments: readonly Judgment[];
  kept: readonly AnyLiteral[];
  retracted: readonly AnyLiteral[];
}>;

/** One contradiction to settle. Nothing remote happens until execute() is called. */
type ResolutionJob = Readonly<{
  atom: AnyAtom;
  /** Every distinct passage behind the contradiction, sent together in one request. */
  passages: readonly Chunk[];
  /**
   * Make one request and retract the evidence it supersedes. Errors propagate and the job
   * can be retried; once it has succeeded, calling it again throws.
   */
  execute: () => Promise<Resolution>;
}>;

/** A single-cursor stream of jobs and their shared, independently stored output. */
type ResolutionRun = IterableIterator<ResolutionJob> & {
  /** Independent copy of the input. Successful jobs retract superseded evidence from it. */
  readonly kb: KnowledgeBase;
};

/**
 * Find every atom with evidence of both signs and return a lazy iterator of jobs, one per
 * contradiction. Each job sends all of the contradiction's passages to the model in one
 * request and asks, for each passage, whether its account still stands. Evidence from
 * superseded passages is retracted from `kb`; the rest is kept, so the solver decides what
 * the surviving evidence means. The input KB is not modified. Throws during construction if
 * conflicting evidence has no source, and propagates corpus errors for sources that are not
 * resolvable chunk IDs. The consumer owns pacing and concurrency.
 */
export function resolver<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  kb: KnowledgeBase,
  config: ResolutionConfig = {},
): ResolutionRun {
  const admission = admissionPolicy(config.admission);
  const adjudicator = jevAdjudicator(config.client);
  const output = kb.fork();
  // Gather every passage now, so missing sources fail before any job exists.
  const jobs = contradictions(output.literals()).flatMap((literals) => {
    const [first] = literals;
    if (first === undefined) {
      return [];
    }
    const passages = passagesFor(literals, corpus);
    let state: "ready" | "running" | "settled" = "ready";
    const job: ResolutionJob = {
      atom: first.atom,
      passages,
      async execute() {
        if (state !== "ready") {
          throw new Error(`The contradiction for ${formatAtom(first.atom)} is already ${state}`);
        }
        state = "running";
        try {
          const answers = await adjudicator.adjudicate({ atom: first.atom, passages });
          const judgments = answers.map(({ passage, answer }) => {
            const standing = standingOf(answer, admission);
            const retracted =
              standing === "RETRACT"
                ? literals.filter(({ metadata }) => metadata?.source === passage.id)
                : [];
            return { passage, standing, answer, retracted };
          });
          const retracted = judgments.flatMap(({ retracted: literal }) => literal);
          output.retract(...retracted);
          state = "settled";
          return {
            atom: first.atom,
            judgments,
            kept: literals.filter((literal) => !retracted.includes(literal)),
            retracted,
          };
        } catch (error) {
          state = "ready";
          throw error;
        }
      },
    };
    return [job];
  });
  return Object.assign(jobs.values(), { kb: output });
}

/** Group literals by proposition, keeping only the groups with both signs, in first-seen order. */
function contradictions(literals: readonly AnyLiteral[]): readonly (readonly AnyLiteral[])[] {
  const identities = new Map<unknown, number>();
  const identity = (value: unknown): string => {
    if ((typeof value === "object" && value !== null) || typeof value === "function") {
      if (value instanceof Date) {
        return `date:${value.toISOString()}`;
      }
      const known = identities.get(value) ?? identities.size;
      identities.set(value, known);
      return `ref:${known}`;
    }
    return `${typeof value}:${String(value)}`;
  };
  const groups = new Map<string, AnyLiteral[]>();
  for (const literal of literals) {
    const { predicate, fields } = literal.atom;
    const key = [predicate, ...predicate.paramNames.map((name) => fields[name])]
      .map(identity)
      .join("|");
    groups.set(key, [...(groups.get(key) ?? []), literal]);
  }
  return [...groups.values()].filter(
    (group) => group.some(({ sign }) => sign === "+") && group.some(({ sign }) => sign === "-"),
  );
}

/** The distinct source passages behind a contradiction. */
function passagesFor<M extends Metadata>(
  literals: readonly AnyLiteral[],
  corpus: Corpus<M>,
): readonly Chunk[] {
  const passages = new Map<string, Chunk>();
  for (const { atom, metadata } of literals) {
    const source = metadata?.source;
    if (source === undefined) {
      throw new Error(`Cannot resolve ${formatAtom(atom)}: evidence without a source`);
    }
    const { chunk } = corpus.resolve(source);
    passages.set(chunk.id, chunk);
  }
  return [...passages.values()];
}

function formatAtom({ predicate, fields }: AnyAtom): string {
  const values = predicate.paramNames.map((name) => {
    const value = fields[name];
    return typeof value === "object" && value !== null && "id" in value
      ? String(value.id)
      : String(value);
  });
  return `${predicate.name}(${values.join(", ")})`;
}

function standingOf({ probabilities }: StandingChoice, policy: AdmissionPolicy): Standing {
  return probabilities.RETRACT >= policy.minimumProbability &&
    probabilities.RETRACT - probabilities.KEEP > policy.ambiguityMargin
    ? "RETRACT"
    : "KEEP";
}

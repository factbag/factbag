/**
 * Settle contradictions in a knowledge base by reading each one's evidence together.
 *
 * @packageDocumentation
 */
import { fieldEquals } from "@factbag/core/dsl";
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import type { Chunk, Corpus, Metadata } from "@factbag/corpus";
import { resolveSettings } from "./settings";
import type { Config } from "./types/config";
import type { Job, Run } from "./types/run";
import { formatAtom } from "./utils";

/**
 * Find every atom with evidence of both signs and return a lazy iterator of jobs, one per
 * contradiction. Each job sends all of the contradiction's passages to the model in one
 * request and asks, for each passage, whether its account still stands. Evidence from
 * superseded passages is retracted from `kb`; the rest is kept, so the solver decides what
 * the surviving evidence means. The input KB is not modified. Throws during construction if
 * conflicting evidence has no source, and propagates corpus errors for sources that are not
 * resolvable chunk IDs. The consumer owns pacing and concurrency.
 * @beta
 */
export function resolver<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  kb: KnowledgeBase,
  inputConfig: Config = {},
): Run {
  const config = resolveSettings(inputConfig);
  const output = kb.fork();
  // Gather every passage now, so missing sources fail before any job exists.
  const jobs = contradictions(output.literals()).flatMap((literals) => {
    const [first] = literals;
    if (first === undefined) {
      return [];
    }
    const passages = passagesFor(literals, corpus);
    let state: "ready" | "running" | "settled" = "ready";
    const job: Job = {
      async execute() {
        if (state !== "ready") {
          throw new Error(`The contradiction for ${formatAtom(first.atom)} is already ${state}`);
        }
        state = "running";
        try {
          const answers = await config.model.adjudicate({ atom: first.atom, passages });
          /** Retract a passage's evidence only when RETRACT clears the minimum and leads KEEP. */
          const retracted = answers
            .filter(
              ({ judgement: { probabilities } }) =>
                probabilities.RETRACT >= config.minimumProbability &&
                probabilities.RETRACT - probabilities.KEEP > config.ambiguityMargin,
            )
            .flatMap(({ passage }) =>
              literals.filter(({ metadata }) => metadata?.source === passage.id),
            );
          output.retract(...retracted);
          state = "settled";
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
  const groups: AnyLiteral[][] = [];
  for (const literal of literals) {
    const { predicate, fields } = literal.atom;
    const group = groups.find(
      ([first]) =>
        first?.atom.predicate === predicate &&
        predicate.paramNames.every((name) => fieldEquals(first.atom.fields[name], fields[name])),
    );
    if (group) {
      group.push(literal);
    } else {
      groups.push([literal]);
    }
  }
  return groups.filter(
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

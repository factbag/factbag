import { fieldEquals } from "@factbag/core/dsl";
import type { Entity, GroundAtom, Scalar } from "@factbag/core/dsl";
import type { KnowledgeBase, Literal } from "@factbag/core/kb";
import type { Chunk } from "@factbag/corpus";
import type { Judgement, Outcome } from "../types/model";
import type { Settings } from "../settings";
import type { ClassifiablePredicate } from "./types";

/**
 * Assess the retained propositions against one passage and add admitted evidence to
 * the output KB. This is the third pipeline step, after predicate and symbol filtering.
 * All predicates must be judged before any evidence is written.
 */
export async function extractEvidence({
  chunk,
  predicates,
  symbols,
  config,
  kb,
}: {
  chunk: Chunk;
  predicates: readonly ClassifiablePredicate[];
  symbols: readonly (Scalar | Entity)[];
  config: Settings;
  kb: KnowledgeBase;
}): Promise<void> {
  /**
   * Judge every predicate concurrently and wait for all of them. A failure leaves this
   * chunk's evidence unwritten; successful answers retain predicate and candidate order.
   */
  const evidence = (
    await Promise.all(
      predicates.map(
        async (predicate) => await judgeCandidateFacts({ chunk, predicate, symbols, config }),
      ),
    )
  ).flat();
  for (const { sign, atom, metadata } of evidence) {
    if (sign === "+") {
      kb.asserts(atom, metadata);
    } else {
      kb.denies(atom, metadata);
    }
  }
}

/**
 * Enumerate one predicate's candidate facts, have the model judge each against the passage,
 * and return the evidence that is both admitted and permitted. Nothing is written here.
 */
async function judgeCandidateFacts({
  chunk,
  predicate,
  symbols,
  config,
}: {
  chunk: Chunk;
  predicate: ClassifiablePredicate;
  symbols: readonly (Scalar | Entity)[];
  config: Settings;
}): Promise<readonly Literal[]> {
  const answers = await config.model.classify({
    text: chunk.text,
    predicate: predicate.declaration,
    candidates: enumerateCandidateFacts({ predicate, symbols }),
  });
  return answers.flatMap(({ candidate, judgement }) =>
    admittedOutcomes(judgement, config)
      /** Write only the signs this predicate's guard permits. */
      .filter((outcome) => predicate.actions.has(outcome === "ASSERT" ? "assert" : "deny"))
      /** Keep the source passage, the admitted probability, and the model's own detail. */
      .map((outcome) => ({
        sign: outcome === "ASSERT" ? "+" : "-",
        atom: candidate,
        metadata: {
          source: chunk.id,
          scores: { probability: judgement.probabilities[outcome] },
          annotations: { [config.model.name]: { ...judgement.details, outcome } },
        },
      })),
  );
}

/**
 * Select signed outcomes worth admitting without forcing a single winner.
 * IRRELEVANT wins ties against signed outcomes. Otherwise, each sign must meet the
 * minimum probability and fall within the configured margin of the strongest sign.
 */
function admittedOutcomes(
  { probabilities }: Judgement<Outcome>,
  config: Settings,
): readonly ("ASSERT" | "DENY")[] {
  const strongest = Math.max(probabilities.ASSERT, probabilities.DENY);
  if (probabilities.IRRELEVANT >= strongest) {
    return [];
  }
  const outcomes = ["ASSERT", "DENY"] as const;
  return outcomes.filter(
    (outcome) =>
      probabilities[outcome] >= config.minimumProbability &&
      strongest - probabilities[outcome] <= config.ambiguityMargin,
  );
}

/**
 * Turn a predicate's retained field values into the concrete facts the model will judge.
 * Build every combination, excluding combinations that reuse the same entity in
 * multiple fields. Request IDs and JSON encoding belong to the model.
 *
 * An empty field domain produces no candidates; a predicate with no fields produces
 * one.
 */
function enumerateCandidateFacts({
  predicate,
  symbols,
}: {
  predicate: ClassifiablePredicate;
  symbols: readonly (Scalar | Entity)[];
}): readonly GroundAtom[] {
  return (
    Object.entries(predicate.roles)
      /**
       * Intersect the passage-wide symbol shortlist with each role's original domain.
       * A relevant symbol can only fill roles whose domain already permits it.
       */
      .map(
        ([role, domain]) =>
          [
            role,
            domain.filter((value) => symbols.some((symbol) => fieldEquals(value, symbol))),
          ] as const,
      )
      /**
       * Build the Cartesian product by extending each combination with every value
       * of the next field. Starting with one empty combination also handles predicates
       * with no fields.
       */
      .reduce<Readonly<Record<string, Scalar | Entity>>[]>(
        (combinations, [name, values]) =>
          combinations.flatMap((fields) => values.map((value) => ({ ...fields, [name]: value }))),
        [{}],
      )
      /**
       * Exclude combinations that reuse an entity across fields, such as a party owning
       * itself. These spend question budget without adding useful candidate facts.
       * Repeated scalar values and dates remain valid.
       */
      .filter((values) => {
        const entities = Object.values(values).filter(
          (value) => typeof value === "object" && !(value instanceof Date),
        );
        return entities.every(
          (entity, index) => entities.findIndex((other) => fieldEquals(entity, other)) === index,
        );
      })
      /** Retain the original field values in native ground atoms for the KB. */
      .map((values) => ({
        predicate: predicate.declaration,
        fields: values,
      }))
  );
}

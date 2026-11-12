/**
 * Fill a knowledge base from one case's text: the statute's rules, and
 * whatever facts Jev asserts or denies over the fact vocabulary. Nothing here knows which
 * section the question will ask about.
 *
 * The Jev classifier does the work. Routing filters the predicates the text may bear on,
 * then Clairic reads the passage's values for each open field of those predicates, then
 * routing filters the role values before the final classification. A
 * predicate the passage offers no candidate for in some field has no candidate facts and
 * is not asked about; since the fact predicates are closed, its facts are then false.
 * Jev's resolver then settles any fact left with evidence of both signs.
 */
import { Corpus } from "factbag/corpus";
import { guard } from "factbag/kb";
import type { AnyLiteral, KnowledgeBase } from "factbag/kb";
import { classifier, createConfig, resolver } from "@factbag/jev";
import type { Normalized, Settings } from "@factbag/jev";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { FACT_PREDICATES } from "../statute/schema";
import type { Person } from "../statute/schema";
import { statuteKB } from "../statute";
import { createChunkSymbolExtractor } from "@factbag/symbol-extractor-clairic";
import type { SymbolExtractorConfig } from "@factbag/symbol-extractor-clairic";
import { people } from "./symbols";

/**
 * Jev's settings for grounding: its defaults with routing on, under `overrides`. Throws
 * for a setting Jev rejects, such as a threshold outside 0 to 1.
 */
export function groundingSettings(overrides: Settings = {}): Normalized {
  return createConfig({ routing: true, ...overrides });
}

export type GroundingOptions = Readonly<{
  client: TypeSafeClient;
  /** Reads the candidates for open fields, and the people the text names. */
  clairic: SymbolExtractorConfig;
  /** Overrides of `groundingSettings`. */
  settings?: Settings;
}>;

export type Grounding = Readonly<{
  kb: KnowledgeBase;
  /** Every person the text names, whether or not any fact mentions them. */
  people: readonly Person[];
  /** Every admitted fact literal, for the results file. */
  literals: readonly AnyLiteral[];
}>;

const FACTS = new Set<unknown>(FACT_PREDICATES);

export async function ground(text: string, options: GroundingOptions): Promise<Grounding> {
  const corpus = new Corpus();
  corpus.add([{ documentId: "case", text }]);
  const input = guard(statuteKB())
    .permit("assert", ...FACT_PREDICATES)
    .permit("deny", ...FACT_PREDICATES);
  const config = { ...groundingSettings(options.settings), client: options.client };
  const run = classifier({
    corpus,
    input,
    config,
    createChunkSymbolExtractor: (chunks) => createChunkSymbolExtractor(chunks, options.clairic),
  });
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- SARA's texts are one chunk, so one job.
    await job.execute();
  }
  // A fact left both asserted and denied is settled by Jev, one request for each. A
  // case is one passage, judged once for each candidate fact, so there is rarely any.
  const resolution = resolver(corpus, run.kb, config);
  for (const job of resolution) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Contradictions are few, and each is one request.
    await job.execute();
  }
  return {
    kb: resolution.kb,
    people: await people(options.clairic, text),
    literals: resolution.kb.literals((literal) => FACTS.has(literal.atom.predicate)),
  };
}

/**
 * Fill a knowledge base from one story: the kinship rules, the people the story names as
 * entities, and whatever facts Jev admits over them. Nothing here knows which pair the
 * question will ask about.
 *
 * Entity discovery is the shared name scanner, unchanged from SARA: a name is a run of
 * capitalised words. Extraction is the shared staged driver: a relevance pass over the
 * predicates, a participant pass over the people, then the final classification of the
 * candidates that remain. The fact predicates are closed, so a relation Jev does not admit
 * is taken not to hold.
 */
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import type { Corpus } from "@factbag/corpus";
import type { MeteredClient } from "@factbag/eval-shared/meter";
import { names } from "@factbag/eval-shared/names";
import { groundStaged } from "@factbag/eval-shared/staged";
import type { Routing, RoutingAudit } from "@factbag/eval-shared/staged";
import type { AdmissionPolicy, Assessment } from "@factbag/jev/classifier";
import { kinshipKB } from "./kinship";
import { defineViolations } from "./violations";
import { FACT_PREDICATES, Person } from "./schema";

export { DEFAULT_ROUTING, renderFields } from "@factbag/eval-shared/staged";
export type { RoutingAudit } from "@factbag/eval-shared/staged";

export type GroundingOptions = Readonly<{
  client: MeteredClient;
  /** Routing thresholds; whatever is left out takes {@link DEFAULT_ROUTING}. */
  routing?: Partial<Routing>;
  admission?: AdmissionPolicy;
  /** Requests in flight for one story. */
  concurrency?: number;
}>;

export type Grounding = Readonly<{
  kb: KnowledgeBase;
  /** The one-document corpus the facts were read from; their sources are its chunk ids. */
  corpus: Corpus;
  /** The people the scanner found, in order of first mention. */
  people: readonly Person[];
  /** Fact predicates left out because the story names too few people for them. */
  unclassified: readonly string[];
  /** Every admitted literal, for the results file. */
  literals: readonly AnyLiteral[];
  assessments: readonly Assessment[];
  requests: number;
  routing: readonly RoutingAudit[];
}>;

export async function ground(text: string, options: GroundingOptions): Promise<Grounding> {
  const people = names(text).people.map((name) => new Person(name));
  const kb = kinshipKB();
  defineViolations(kb);
  kb.entities.add(...people);
  const grounding = await groundStaged(text, {
    client: options.client,
    kb,
    predicates: FACT_PREDICATES,
    entityType: Person,
    entities: people.length,
    // Every scalar field is an enumeration, which Jev enumerates itself.
    domains: {},
    ...(options.routing === undefined ? {} : { routing: options.routing }),
    ...(options.admission === undefined ? {} : { admission: options.admission }),
    ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
  });
  return { ...grounding, people };
}

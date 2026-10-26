/**
 * Fill a knowledge base from one case's text: the statute's rules and calendar, the people
 * the text names as entities, and whatever facts Jev admits over the people and the dates
 * the text mentions. Nothing here knows which section the question will ask about.
 *
 * Extraction is staged: a relevance pass over the predicates, a participant pass over the
 * role values, then the final classification of the candidates that remain, run by the
 * shared driver in `@factbag/eval-shared/staged`. The library's exhaustive classifier is
 * untouched; this example no longer runs it, since the staged filter matched it answer for
 * answer on the test split at a third of the requests. The exhaustive runs kept under
 * `results/` remain comparable through `compare-strategies`.
 */
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import type { MeteredClient } from "@factbag/eval-shared/meter";
import { groundStaged } from "@factbag/eval-shared/staged";
import type { Routing, RoutingAudit } from "@factbag/eval-shared/staged";
import type { AdmissionPolicy, Assessment, ScalarDomains } from "@factbag/jev/classifier";
import { mentions } from "./mentions";
import type { Mentions } from "./mentions";
import { FACT_PREDICATES, Person } from "./schema";
import { statuteKB } from "./statute";

export { DEFAULT_ROUTING } from "@factbag/eval-shared/staged";
export { renderFields } from "@factbag/eval-shared/staged";
export type { RoutingAudit } from "@factbag/eval-shared/staged";

export type GroundingOptions = Readonly<{
  client: MeteredClient;
  /** Routing thresholds; whatever is left out takes {@link DEFAULT_ROUTING}. */
  routing?: Partial<Routing>;
  admission?: AdmissionPolicy;
  /** Requests in flight for one case. */
  concurrency?: number;
}>;

export type Grounding = Readonly<{
  kb: KnowledgeBase;
  people: readonly Person[];
  domains: ScalarDomains;
  /** Fact predicates left out because the text offers no candidates for one of their fields. */
  unclassified: readonly string[];
  /** Every admitted literal, for the results file. */
  literals: readonly AnyLiteral[];
  assessments: readonly Assessment[];
  requests: number;
  routing: readonly RoutingAudit[];
}>;

export async function ground(text: string, options: GroundingOptions): Promise<Grounding> {
  const found = mentions(text);
  const people = found.people.map((name) => new Person(name));
  const domains = domainsOf(found);
  const kb = statuteKB();
  kb.entities.add(...people);
  const grounding = await groundStaged(text, {
    client: options.client,
    kb,
    predicates: FACT_PREDICATES,
    entityType: Person,
    entities: people.length,
    domains,
    ...(options.routing === undefined ? {} : { routing: options.routing }),
    ...(options.admission === undefined ? {} : { admission: options.admission }),
    ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
  });
  return { ...grounding, people, domains };
}

/**
 * Candidate values for the scalar fields: the days the text writes out in full, the years
 * it names, and the amounts. A range the text states as one names every year in it:
 * "from 2015 to 2019" offers 2015 through 2019, and Jev judges each year's facts on the
 * text; two years the text does not join offer nothing in between. A year's bounds are
 * deliberately not offered as days: offered them, the model marks the start and end of
 * every year as starts and ends of the state.
 */
function domainsOf(found: Mentions): ScalarDomains {
  return {
    Date: [...found.dates],
    Number: [...found.amounts],
    // Years are not amounts: every `year` field takes the years, the other Number fields
    // the amounts.
    fields: { year: [...found.years] },
  };
}

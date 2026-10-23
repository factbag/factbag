/**
 * Fill a knowledge base from one case's text: the statute's rules and calendar, the people
 * the text names as entities, and whatever facts Jev admits over the people and the dates
 * the text mentions. Nothing here knows which section the question will ask about.
 */
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import type {
  AdmissionPolicy,
  Assessment,
  ClassifierClient,
  ScalarDomains,
} from "@factbag/jev/classifier";
import { mentions } from "./mentions";
import type { Mentions } from "./mentions";
import { pool } from "./pool";
import { FACT_PREDICATES, Person } from "./schema";
import { statuteKB } from "./statute";

export type GroundingOptions = Readonly<{
  client: ClassifierClient;
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
}>;

export async function ground(text: string, options: GroundingOptions): Promise<Grounding> {
  const found = mentions(text);
  const people = found.people.map((name) => new Person(name));
  const domains = domainsOf(found);
  const kb = statuteKB();
  kb.entities.add(...people);
  let access = guard(kb);
  const unclassified: string[] = [];
  for (const declaration of FACT_PREDICATES) {
    if (classifiable(declaration, domains, people.length)) {
      access = access.permit("assert", declaration).permit("deny", declaration);
    } else {
      unclassified.push(declaration.name);
    }
  }
  const corpus = new Corpus();
  corpus.add({ documentId: "text", text });
  const run = classifier(corpus, access, {
    client: options.client,
    ...(options.admission === undefined ? {} : { admission: options.admission }),
    domains,
  });
  const jobs = [...run];
  const assessments: Assessment[] = [];
  await pool(jobs, options.concurrency ?? 4, async (job) => {
    assessments.push(await job.execute());
  });
  const facts = new Set<string>(FACT_PREDICATES.map((declaration) => declaration.name));
  return {
    kb: run.kb,
    people,
    domains,
    unclassified,
    literals: run.kb.literals((literal) => facts.has(literal.atom.predicate.name)),
    assessments,
    requests: jobs.length,
  };
}

/** The longest run of consecutive years a text may be taken to speak about. */
const MAX_YEAR_SPAN = 40;

/**
 * Candidate values for the scalar fields: the days the text writes out; every year from
 * the earliest it names to the latest, so "from 2015 to 2019" covers 2016; and the amounts.
 * A year's bounds are deliberately not offered as days: offered them, the model marks the
 * start and end of every year in a range as starts and ends of the state.
 */
function domainsOf(found: Mentions): ScalarDomains {
  const years: bigint[] = [];
  if (found.years.length > 0) {
    const earliest = found.years[0] ?? 0;
    const latest = found.years.at(-1) ?? 0;
    if (latest - earliest < MAX_YEAR_SPAN) {
      for (let year = earliest; year <= latest; year += 1) {
        years.push(BigInt(year));
      }
    } else {
      years.push(...found.years.map(BigInt));
    }
  }
  return {
    Date: [...found.dates],
    BigInt: years,
    Number: [...found.amounts],
  };
}

/**
 * Jev rejects a predicate with no candidates: one whose scalar field has an empty domain,
 * or one naming more distinct people than the text does. Such facts stay unknown.
 */
function classifiable(
  declaration: (typeof FACT_PREDICATES)[number],
  domains: ScalarDomains,
  people: number,
): boolean {
  const persons = Object.values(declaration.params).filter((type) => type === Person).length;
  if (persons > people) {
    return false;
  }
  return Object.values(declaration.params).every((type) => {
    const candidates =
      type === Date
        ? domains.Date
        : type === BigInt
          ? domains.BigInt
          : type === Number
            ? domains.Number
            : type === String
              ? domains.String
              : undefined;
    return candidates === undefined || candidates.length > 0;
  });
}

/** Render an atom's fields for logs and results: names, ISO days, decimal years. */
export function renderFields(fields: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, renderValue(value)]),
  );
}

function renderValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value instanceof Person) {
    return value.id;
  }
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

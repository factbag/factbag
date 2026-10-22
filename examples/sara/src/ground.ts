/**
 * Fill a knowledge base from one case's text: the statute's rules and calendar, the people
 * the text names as entities, and whatever facts Jev admits over the people and the dates
 * the text mentions. Nothing here knows which section the question will ask about.
 */
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import type { AdmissionPolicy, Assessment, ClassifierClient } from "@factbag/jev/classifier";
import { mentions } from "./mentions";
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
  /** Every admitted literal, for the results file. */
  literals: readonly AnyLiteral[];
  assessments: readonly Assessment[];
  requests: number;
}>;

export async function ground(text: string, options: GroundingOptions): Promise<Grounding> {
  const found = mentions(text);
  const people = found.people.map((name) => new Person(name));
  const kb = statuteKB();
  kb.entities.add(...people);
  let access = guard(kb);
  for (const declaration of FACT_PREDICATES) {
    access = access.permit("assert", declaration).permit("deny", declaration);
  }
  const corpus = new Corpus();
  corpus.add({ documentId: "text", text });
  const run = classifier(corpus, access, {
    client: options.client,
    ...(options.admission === undefined ? {} : { admission: options.admission }),
    domains: { Date: found.dates },
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
    literals: run.kb.literals((literal) => facts.has(literal.atom.predicate.name)),
    assessments,
    requests: jobs.length,
  };
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

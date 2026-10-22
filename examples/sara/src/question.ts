/**
 * Turn a question into a query atom. The citation picks the provision, which fixes the
 * predicate and its roles; Jev then reads the question to say which named person fills
 * which role and which year is asked about. No case-specific parsing beyond the citation.
 */
import { closedPredicate } from "@factbag/core/dsl";
import type { GroundAtom, PredicateSchema } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import type { ClassifierClient } from "@factbag/jev/classifier";
import { mentions } from "./mentions";
import { Person } from "./schema";
import { PROVISIONS, provisionAtom } from "./statute";
import type { Provision } from "./statute";

const CITATION = /[Ss]ection\s+(\d+)((?:\([A-Za-z0-9]+\))*)/u;

/** The citation a question names, such as "2(a)(1)(A)", or undefined when it names none. */
export function citationOf(question: string): string | undefined {
  const match = CITATION.exec(question);
  return match === null ? undefined : `${match[1] ?? ""}${match[2] ?? ""}`;
}

export function provisionFor(question: string): Provision | undefined {
  const citation = citationOf(question);
  return PROVISIONS.find((provision) => provision.citation === citation);
}

export type QuestionReading = Readonly<{
  provision: Provision;
  atom: GroundAtom | undefined;
  /** Why no atom was read, when none was. */
  reason?: string;
  requests: number;
}>;

/**
 * Ask Jev which people and year the question puts into the provision's roles. The
 * candidates are every assignment of the question's named people to the roles, times the
 * years it mentions; the strongest ASSERT wins.
 */
export async function readQuestion(
  question: string,
  provision: Provision,
  people: readonly Person[],
  client: ClassifierClient,
): Promise<QuestionReading> {
  const found = mentions(question);
  const named = people.filter((person) => found.people.includes(person.id));
  const candidates = named.length >= provision.people.length ? named : people;
  if (candidates.length < provision.people.length) {
    return { provision, atom: undefined, reason: "too few people named", requests: 0 };
  }
  if (provision.year && found.years.length === 0) {
    return { provision, atom: undefined, reason: "no year named", requests: 0 };
  }
  const schema: Record<string, PredicateSchema[string]> = {};
  for (const role of provision.people) {
    schema[role] = Person;
  }
  if (provision.year) {
    schema["year"] = BigInt;
  }
  const roles = provision.people.map((role) => `'${role}'`).join(", ");
  const asks = closedPredicate(`asks_${provision.predicate.name}`, schema, {
    description: provision.description,
    instructions: `The document is a question about a United States tax statute. ASSERT the one candidate whose fields name exactly the people the question puts in the roles ${roles}${provision.year ? " and the taxable year it asks about" : ""}. DENY a candidate that puts a named person in the wrong role or names the wrong year. IRRELEVANT only for people the question does not mention.`,
  });
  const kb = new KnowledgeBase();
  kb.entities.add(...candidates);
  const corpus = new Corpus();
  corpus.add({ documentId: "question", text: question });
  const run = classifier(corpus, guard(kb).permit("assert", asks), {
    client,
    domains: { BigInt: found.years.map((year) => BigInt(year)) },
  });
  const jobs = [...run];
  let best: { atom: GroundAtom; probability: number } | undefined;
  for (const job of jobs) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A question has one or two requests.
    const result = await job.execute();
    for (const { atom, answer } of result.assessments) {
      const probability = answer.probabilities.ASSERT;
      if (answer.choice === "ASSERT" && (best === undefined || probability > best.probability)) {
        best = { atom, probability };
      }
    }
  }
  if (best === undefined) {
    return { provision, atom: undefined, reason: "no reading asserted", requests: jobs.length };
  }
  const chosen = provision.people.map((role) => best.atom.fields[role]);
  if (!chosen.every((value): value is Person => value instanceof Person)) {
    throw new Error("Question reading produced a non-person role");
  }
  const year = best.atom.fields["year"];
  return {
    provision,
    atom: provisionAtom(provision, chosen, typeof year === "bigint" ? year : undefined),
    requests: jobs.length,
  };
}

/**
 * Read the answer to a CLUTRR question off a grounded knowledge base: the relations the
 * rules derive from the first queried person to the second, and the second's gender as the
 * story gives it, make the gendered label the benchmark expects. The question is answered
 * only when exactly one relation is derived and the gender is settled; otherwise the case
 * is unanswered, with the reason recorded, and scores as wrong.
 */
import { variable } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { queryAll } from "@factbag/core/query";
import { labelFor, relationsBetween } from "./kinship";
import type { Gender, RelationKey } from "./kinship";
import { gender as genderOf } from "./schema";
import type { Person } from "./schema";

export type Answer = Readonly<{
  predicted: string | undefined;
  /** The keys derived from the first person to the second: how the second is related. */
  keys: readonly RelationKey[];
  /** The second person's gender as extracted, when exactly one was. */
  gender: Gender | undefined;
  /** Why there is no prediction, when there is none. */
  failure?: string;
  /** The stated facts each derived relation rests on, by key. */
  supporting: Readonly<Record<string, readonly string[]>>;
  /** Whether the answer needed a composition: it rests on more than one stated fact. */
  derived?: boolean;
  solverMs: number;
}>;

const G = variable("G");

/** The genders the facts give a person. */
function gendersOf(kb: KnowledgeBase, person: Person): readonly Gender[] {
  return queryAll(kb, genderOf({ person, gender: G }))
    .filter((judgment) => judgment.value === "true")
    .map((judgment) => judgment.goal.atom.fields["gender"])
    .filter((value): value is Gender => typeof value === "string");
}

export function answer(
  kb: KnowledgeBase,
  people: ReadonlyMap<string, Person>,
  first: string,
  second: string,
): Answer {
  const a = people.get(first);
  const b = people.get(second);
  const began = performance.now();
  if (a === undefined || b === undefined) {
    return {
      predicted: undefined,
      keys: [],
      gender: undefined,
      failure: `person not found: ${[first, second].filter((name) => !people.has(name)).join(", ")}`,
      supporting: {},
      solverMs: performance.now() - began,
    };
  }
  const relations = relationsBetween(kb, a, b);
  const genders = gendersOf(kb, b);
  const solverMs = performance.now() - began;
  const keys = relations.map((entry) => entry.key);
  const supporting = Object.fromEntries(relations.map((entry) => [entry.key, entry.stated]));
  const [gender] = genders;
  const [only] = relations;
  const base = { keys, gender: genders.length === 1 ? gender : undefined, supporting, solverMs };
  if (relations.length === 0) {
    return { ...base, predicted: undefined, failure: "no relation derived" };
  }
  if (relations.length > 1 || only === undefined) {
    return { ...base, predicted: undefined, failure: `several relations: ${keys.join("|")}` };
  }
  if (genders.length === 0) {
    return {
      ...base,
      predicted: undefined,
      failure: "gender unknown",
      derived: only.stated.length > 1,
    };
  }
  if (genders.length > 1 || gender === undefined) {
    return {
      ...base,
      predicted: undefined,
      failure: "gender conflicting",
      derived: only.stated.length > 1,
    };
  }
  return { ...base, predicted: labelFor(only.key, gender), derived: only.stated.length > 1 };
}

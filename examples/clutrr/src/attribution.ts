/**
 * Where a wrong or unanswered case went wrong, read after the fact against the generator's
 * own proof of the story: the stated facts the gold answer rests on, and the gender it
 * uses. The attribution never reaches either system; it only explains the score.
 */
import type { Edge, Story } from "./data";
import { keyOfLabel } from "./kinship";
import type { RelationKey } from "./kinship";
import type { SavedFact } from "./saved";

/**
 * One stated relation in a canonical spelling, so the generator's edges and Jev's facts
 * compare: ordered predicates by their ordered fields, unordered ones by sorted names.
 */
export function canonical(from: string, key: RelationKey, to: string): string {
  const ordered = (predicate: string, older: string, younger: string): string =>
    `${predicate}(${older}, ${younger})`;
  const unordered = (predicate: string): string =>
    `${predicate}(${[from, to].sort((a, b) => a.localeCompare(b)).join(", ")})`;
  const spellings: Readonly<Record<RelationKey, () => string>> = {
    child: () => ordered("parent_of", from, to),
    "inv-child": () => ordered("parent_of", to, from),
    SO: () => unordered("spouse_of"),
    sibling: () => unordered("sibling_of"),
    grand: () => ordered("grandparent_of", from, to),
    "inv-grand": () => ordered("grandparent_of", to, from),
    "in-law": () => ordered("parent_in_law_of", from, to),
    "inv-in-law": () => ordered("parent_in_law_of", to, from),
    "sibling-in-law": () => unordered("sibling_in_law_of"),
    un: () => ordered("uncle_or_aunt_of", from, to),
    "inv-un": () => ordered("uncle_or_aunt_of", to, from),
  };
  return spellings[key]();
}

/** The generator's supporting facts in canonical spelling. */
export function goldFacts(edges: readonly Edge[]): readonly string[] {
  return edges.map(([from, label, to]) => canonical(from, keyOfLabel(label).key, to));
}

/** The asserted relation facts of a run in canonical spelling, genders aside. */
export function extractedFacts(facts: readonly SavedFact[]): readonly string[] {
  const spelled: string[] = [];
  for (const fact of facts) {
    if (fact.sign !== "+" || fact.predicate === "gender") {
      continue;
    }
    const values = Object.values(fact.fields);
    const [first = "", second = ""] = values;
    const unordered =
      fact.predicate === "spouse_of" ||
      fact.predicate === "sibling_of" ||
      fact.predicate === "sibling_in_law_of";
    const text = unordered
      ? `${fact.predicate}(${[first, second].sort((a, b) => a.localeCompare(b)).join(", ")})`
      : `${fact.predicate}(${first}, ${second})`;
    if (!spelled.includes(text)) {
      spelled.push(text);
    }
  }
  return spelled;
}

export type Attribution = Readonly<{
  /** Gold facts the extraction did not state. */
  missed: readonly string[];
  /** Extracted relation facts that are not gold facts. */
  extra: readonly string[];
  /** Whether the extraction gave the queried second person the generator's gender. */
  genderRight: boolean;
  /** The failure's category, for a case that scored wrong. */
  category: string;
}>;

export function attribute(
  story: Story,
  record: Readonly<{
    predicted: string | undefined;
    failure?: string;
    people?: readonly string[];
    facts?: readonly SavedFact[];
  }>,
): Attribution {
  const gold = goldFacts(story.edges);
  const extracted = extractedFacts(record.facts ?? []);
  const missed = gold.filter((fact) => !extracted.includes(fact));
  const extra = extracted.filter((fact) => !gold.includes(fact));
  const [, second] = story.query;
  const genders = (record.facts ?? [])
    .filter((fact) => fact.sign === "+" && fact.predicate === "gender")
    .filter((fact) => fact.fields["person"] === second)
    .map((fact) => fact.fields["gender"]);
  const genderRight = genders.length === 1 && genders[0] === story.genders[second];
  const people = record.people ?? [];
  const named = [...new Set(story.edges.flatMap(([from, , to]) => [from, to]))];
  const unfound = named.filter((name) => !people.includes(name));
  let category: string;
  if (record.predicted === story.target) {
    category = "correct";
  } else if (record.failure === "error") {
    category = "error";
  } else if (unfound.length > 0) {
    category = "scanner: a named person not found";
  } else if (missed.length > 0 && extra.length > 0) {
    category = "extraction: gold facts missed and others added";
  } else if (missed.length > 0) {
    category = "extraction: gold facts missed";
  } else if (extra.length > 0) {
    category = "extraction: facts added";
  } else if (!genderRight) {
    category = "extraction: gender";
  } else if (record.failure?.startsWith("several relations") === true) {
    category = "ambiguous under the benchmark's rules";
  } else {
    category = "rules";
  }
  return { missed, extra, genderRight, category };
}

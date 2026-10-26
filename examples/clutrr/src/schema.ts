/**
 * The fact vocabulary Jev fills from a CLUTRR story: the kinship relations the text states
 * between two named people, and each person's gender as the text's words give it. Every
 * predicate is closed: what the story does not state is false.
 *
 * The seven relation predicates are the benchmark's eleven relation keys with each inverse
 * pair folded into one ordered predicate, so "Kristin's son Justin" and "Justin's mother
 * Kristin" are one fact, `parent_of(Kristin, Justin)`. The symmetric relations take either
 * order. Nothing here composes relations: that is the rules' work in `kinship.ts`.
 */
import { closedPredicate, enumeration } from "@factbag/core/dsl";
import type { Entity } from "@factbag/core/dsl";

/** A named individual mentioned in the story. */
export class Person implements Entity {
  constructor(readonly id: string) {}
}

const GENDERS = enumeration("male", "female");

const NAMES = "People are referred to by name.";

const STATED =
  "Only a relationship the story states in words counts, in either of its two names: do " +
  "not infer one from other relationships in the story, and a relationship the words join " +
  "to one pair of people says nothing about a third person named in the same sentence. " +
  "IRRELEVANT for any other relationship between the two, for the opposite direction, and " +
  "for a pair the story does not relate in this way.";

export const parent_of = closedPredicate(
  "parent_of",
  { parent: Person, child: Person },
  {
    description:
      "The first person is the father or mother of the second, who is their son or daughter, " +
      "by birth or by adoption.",
    instructions:
      `ASSERT when the story says the parent is the child's father, mother, dad or mom, or ` +
      `that the child is the parent's son or daughter, whether by birth or by adoption: an ` +
      `adoptive mother or father is a parent, and an adopted son or daughter is a child ` +
      `('his adopted daughter X', 'X, who adopted Y'). The fields are ordered: 'parent' is ` +
      `the older generation, 'child' the younger. A grandmother, grandfather, aunt, uncle, ` +
      `mother-in-law, father-in-law, stepmother or stepfather is not a parent. ${STATED} ${NAMES}`,
  },
);

export const spouse_of = closedPredicate(
  "spouse_of",
  { a: Person, b: Person },
  {
    description: "The two people are married to each other: husband and wife.",
    instructions:
      `ASSERT when the story says one of the two is the other's husband or wife, or that ` +
      `they are married. The order of the two does not matter. ${STATED} ${NAMES}`,
  },
);

export const sibling_of = closedPredicate(
  "sibling_of",
  { a: Person, b: Person },
  {
    description: "The two people are siblings: brother or sister of each other.",
    instructions:
      `ASSERT when the story says one of the two is the other's brother or sister, or that ` +
      `they are siblings. The order of the two does not matter. ${STATED} ${NAMES}`,
  },
);

export const grandparent_of = closedPredicate(
  "grandparent_of",
  { grandparent: Person, grandchild: Person },
  {
    description:
      "The first person is the grandfather or grandmother of the second, who is their " +
      "grandson or granddaughter.",
    instructions:
      `ASSERT when the story says the grandparent is the grandchild's grandfather or ` +
      `grandmother, or that the grandchild is the grandparent's grandson or granddaughter. ` +
      `The fields are ordered: 'grandparent' is the older generation. A mother or father is ` +
      `not a grandparent. ${STATED} ${NAMES}`,
  },
);

export const parent_in_law_of = closedPredicate(
  "parent_in_law_of",
  { parent_in_law: Person, child_in_law: Person },
  {
    description:
      "The first person is the father-in-law or mother-in-law of the second, who is their " +
      "son-in-law or daughter-in-law.",
    instructions:
      `ASSERT when the story says the first is the second's father-in-law or mother-in-law, ` +
      `or that the second is the first's son-in-law or daughter-in-law. The fields are ` +
      `ordered: 'parent_in_law' is the older generation. ${STATED} ${NAMES}`,
  },
);

export const sibling_in_law_of = closedPredicate(
  "sibling_in_law_of",
  { a: Person, b: Person },
  {
    description: "The two people are brother-in-law or sister-in-law of each other.",
    instructions:
      `ASSERT when the story says one of the two is the other's brother-in-law or ` +
      `sister-in-law. The order of the two does not matter. ${STATED} ${NAMES}`,
  },
);

export const uncle_or_aunt_of = closedPredicate(
  "uncle_or_aunt_of",
  { uncle_or_aunt: Person, nibling: Person },
  {
    description:
      "The first person is the uncle or aunt of the second, who is their nephew or niece.",
    instructions:
      `ASSERT when the story says the first is the second's uncle or aunt, or that the ` +
      `second is the first's nephew or niece. The fields are ordered: 'uncle_or_aunt' is the ` +
      `older generation, 'nibling' the nephew or niece. ${STATED} ${NAMES}`,
  },
);

export const gender = closedPredicate(
  "gender",
  { person: Person, gender: GENDERS },
  {
    description: "The person's gender, as the words the story uses for them give it.",
    instructions:
      "ASSERT 'male' when the story calls the person a son, father, dad, brother, husband, " +
      "grandson, grandfather, uncle, nephew, son-in-law, father-in-law or brother-in-law, " +
      "or refers to them as he, him or his. ASSERT 'female' for daughter, mother, mom, " +
      "sister, wife, granddaughter, grandmother, aunt, niece, daughter-in-law, " +
      "mother-in-law or sister-in-law, or she or her. IRRELEVANT when the story gives no " +
      `such word for the person, and for the gender the words do not support. ${NAMES}`,
  },
);

/** The predicates Jev fills, in the order the results list them. */
export const FACT_PREDICATES = [
  parent_of,
  spouse_of,
  sibling_of,
  grandparent_of,
  parent_in_law_of,
  sibling_in_law_of,
  uncle_or_aunt_of,
  gender,
] as const;

/** Bump when a predicate, its wording, or the scanner changes. */
export const EXTRACTION_VERSION = "kin-4-2026-10-25";

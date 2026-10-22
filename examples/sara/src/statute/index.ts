/**
 * The statute as rules, and the registry that maps a section citation in a question to the
 * predicate that decides it. Each registry entry says which people the question names, in
 * order, and whether it names a taxable year.
 */
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { yearBoundsFacts } from "../schema";
import type { Person } from "../schema";
import { defineHelpers } from "./helpers";
import { defineS152, s152_c_2, s152_c_2_A, s152_c_2_B, s152_c_3 } from "./s152";
import { defineS2, s2_a_1_A, s2_a_2_A, s2_a_2_B, s2_b_2_A, s2_b_2_B, s2_b_2_C } from "./s2";
import { defineS7703, s7703_a_1, s7703_a_2 } from "./s7703";

export type Provision = Readonly<{
  /** The citation as it appears in questions, such as "2(a)(1)(A)". */
  citation: string;
  predicate: PredicateDeclaration;
  /** The person fields, in the order the question names people. */
  people: readonly string[];
  /** Whether the predicate takes the taxable year named in the question. */
  year: boolean;
  /** What the question asks, for grounding its arguments. */
  description: string;
}>;

export const PROVISIONS: readonly Provision[] = [
  {
    citation: "7703(a)(1)",
    predicate: s7703_a_1,
    people: ["taxpayer", "spouse"],
    year: true,
    description:
      "Whether section 7703(a)(1) applies to the taxpayer and spouse for the taxable year.",
  },
  {
    citation: "7703(a)(2)",
    predicate: s7703_a_2,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 7703(a)(2) applies to the taxpayer for the taxable year.",
  },
  {
    citation: "2(a)(1)(A)",
    predicate: s2_a_1_A,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(a)(1)(A) applies to the taxpayer in the taxable year.",
  },
  {
    citation: "2(a)(2)(A)",
    predicate: s2_a_2_A,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(a)(2)(A) applies to the taxpayer in the taxable year.",
  },
  {
    citation: "2(a)(2)(B)",
    predicate: s2_a_2_B,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(a)(2)(B) applies to the taxpayer in the taxable year.",
  },
  {
    citation: "2(b)(2)(A)",
    predicate: s2_b_2_A,
    people: ["a", "b"],
    year: true,
    description: "Whether section 2(b)(2)(A) applies to the two spouses in the taxable year.",
  },
  {
    citation: "2(b)(2)(B)",
    predicate: s2_b_2_B,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(b)(2)(B) applies to the taxpayer in the taxable year.",
  },
  {
    citation: "2(b)(2)(C)",
    predicate: s2_b_2_C,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(b)(2)(C) applies to the taxpayer in the taxable year.",
  },
  {
    citation: "152(c)(2)(A)",
    predicate: s152_c_2_A,
    people: ["individual", "taxpayer"],
    year: false,
    description:
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2)(A).",
  },
  {
    citation: "152(c)(2)(B)",
    predicate: s152_c_2_B,
    people: ["individual", "taxpayer"],
    year: false,
    description:
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2)(B).",
  },
  {
    citation: "152(c)(2)",
    predicate: s152_c_2,
    people: ["individual", "taxpayer"],
    year: false,
    description:
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2).",
  },
  {
    citation: "152(c)(3)",
    predicate: s152_c_3,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether the individual satisfies section 152(c)(3) with the taxpayer claiming the " +
      "individual as a qualifying child for the taxable year.",
  },
];

/** The ground atom a question about a provision resolves to. */
export function provisionAtom(
  provision: Provision,
  people: readonly Person[],
  year: bigint | undefined,
): GroundAtom {
  if (people.length !== provision.people.length) {
    throw new Error(`Section ${provision.citation} names ${provision.people.length} people`);
  }
  if (provision.year !== (year !== undefined)) {
    throw new Error(`Section ${provision.citation} ${provision.year ? "needs" : "takes no"} year`);
  }
  const fields: Record<string, Person | bigint> = {};
  for (const [index, name] of provision.people.entries()) {
    const person = people[index];
    if (person !== undefined) {
      fields[name] = person;
    }
  }
  if (year !== undefined) {
    fields["year"] = year;
  }
  return { predicate: provision.predicate, fields };
}

/** A fresh knowledge base holding the calendar and every rule, ready for one case's facts. */
export function statuteKB(): KnowledgeBase {
  const kb = new KnowledgeBase();
  for (const fact of yearBoundsFacts()) {
    kb.asserts(fact);
  }
  defineHelpers(kb);
  defineS7703(kb);
  defineS2(kb);
  defineS152(kb);
  return kb;
}

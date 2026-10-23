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
import {
  defineS152,
  s152_c_2,
  s152_c_2_A,
  s152_c_2_B,
  s152_c_3,
  s152_d_2,
  s152_d_2_A,
  s152_d_2_B,
  s152_d_2_C,
  s152_d_2_D,
  s152_d_2_E,
  s152_d_2_F,
  s152_d_2_G,
  s152_d_2_H,
} from "./s152";
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

/** A §152 relationship description, with how those questions are phrased. */
function bears(text: string): string {
  return `${text} The question reads 'X bears a relationship to Y': X is the individual and Y is the taxpayer.`;
}

/** What each role name means, for reading a question's people into roles. */
export const ROLE_MEANINGS: Readonly<Record<string, string>> = {
  taxpayer: "the taxpayer the provision is applied to: the person it is asked about",
  spouse: "the taxpayer's spouse",
  individual:
    "the individual whose relationship to, or status with respect to, the taxpayer is asked " +
    "about: the dependent, child or relative, not the taxpayer",
  a: "one of the two people the provision is applied to",
  b: "the other of the two people",
};

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
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2)(A).",
    ),
  },
  {
    citation: "152(c)(2)(B)",
    predicate: s152_c_2_B,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2)(B).",
    ),
  },
  {
    citation: "152(c)(2)",
    predicate: s152_c_2,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section 152(c)(2).",
    ),
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
  {
    citation: "152(d)(2)(A)",
    predicate: s152_d_2_A,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(A): a child of the taxpayer or a descendant of a child. ",
    ),
  },
  {
    citation: "152(d)(2)(B)",
    predicate: s152_d_2_B,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(B): a brother, sister, stepbrother or stepsister of the taxpayer. ",
    ),
  },
  {
    citation: "152(d)(2)(C)",
    predicate: s152_d_2_C,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(C): the father or mother of the taxpayer, or an ancestor of either. ",
    ),
  },
  {
    citation: "152(d)(2)(D)",
    predicate: s152_d_2_D,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(D): a stepfather or stepmother of the taxpayer. ",
    ),
  },
  {
    citation: "152(d)(2)(E)",
    predicate: s152_d_2_E,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(E): a son or daughter of a brother or sister of the taxpayer. ",
    ),
  },
  {
    citation: "152(d)(2)(F)",
    predicate: s152_d_2_F,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(F): a brother or sister of the father or mother of the taxpayer. ",
    ),
  },
  {
    citation: "152(d)(2)(G)",
    predicate: s152_d_2_G,
    people: ["individual", "taxpayer"],
    year: false,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(G): an in-law of the taxpayer. ",
    ),
  },
  {
    citation: "152(d)(2)(H)",
    predicate: s152_d_2_H,
    people: ["individual", "taxpayer"],
    year: true,
    description: bears(
      "Whether the individual bears a relationship to the taxpayer under section " +
        "152(d)(2)(H) for the taxable year: a member of the taxpayer's household who is not " +
        "the taxpayer's spouse. ",
    ),
  },
  {
    citation: "152(d)(2)",
    predicate: s152_d_2,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether the individual bears any of the relationships to the taxpayer described in " +
      "section 152(d)(2) for the taxable year.",
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

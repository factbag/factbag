/**
 * The statute as rules, and the registry that maps a section citation in a question to the
 * predicate that decides it. Each registry entry says which people the question names, in
 * order, and whether it names a taxable year.
 */
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { yearBoundsFacts, yearMarksFacts } from "../schema";
import type { Person } from "../schema";
import { defineHelpers } from "./helpers";
import { defineS151, s151_b, s151_c } from "./s151";
import {
  defineS152,
  s152_b_1,
  s152_b_2,
  s152_c_1,
  s152_c_1_B,
  s152_c_1_E,
  s152_c_2,
  s152_c_2_A,
  s152_c_2_B,
  s152_c_3,
  s152_d_1,
  s152_d_1_B,
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
import {
  defineS2,
  head_of_household,
  s2_a_1_A,
  s2_a_1_B,
  s2_a_2_A,
  s2_a_2_B,
  s2_b_1,
  s2_b_1_A,
  s2_b_1_B,
  s2_b_2_A,
  s2_b_2_B,
  s2_b_2_C,
  s2_b_3_A,
  s2_b_3_B,
  surviving_spouse,
} from "./s2";
import {
  defineS7703,
  married_7703,
  s7703_a_1,
  s7703_a_2,
  s7703_b,
  s7703_b_1,
  s7703_b_2,
  s7703_b_3,
} from "./s7703";

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
  dependent: "the dependent the exemption or deduction is for",
};

const TAXPAYER_YEAR = ["taxpayer"] as const;

function applies(citation: string, predicate: PredicateDeclaration, subject: string): Provision {
  return {
    citation,
    predicate,
    people: [...TAXPAYER_YEAR],
    year: true,
    description: `Whether section ${citation} applies to the taxpayer for the taxable year: ${subject}.`,
  };
}

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
  applies("7703(b)(1)", s7703_b_1, "married, filing separately, keeping a home for a child"),
  applies("7703(b)(2)", s7703_b_2, "furnishing over half the cost of the household"),
  applies(
    "7703(b)(3)",
    s7703_b_3,
    "the spouse not a member of the household in the last six months",
  ),
  applies("7703(b)", s7703_b, "a married individual living apart, not considered married"),
  applies("7703", married_7703, "the taxpayer is married under section 7703"),
  {
    citation: "2(a)(1)(A)",
    predicate: s2_a_1_A,
    people: ["taxpayer"],
    year: true,
    description: "Whether section 2(a)(1)(A) applies to the taxpayer in the taxable year.",
  },
  applies("2(a)(1)(B)", s2_a_1_B, "maintaining a home for a dependent son or daughter"),
  applies("2(a)", surviving_spouse, "the taxpayer is a surviving spouse"),
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
  applies("2(b)(1)", s2_b_1, "the head of household test before the limitations of (b)(3)"),
  applies("2(b)(1)(A)", s2_b_1_A, "keeping a home for a qualifying child or dependent"),
  applies("2(b)(1)(B)", s2_b_1_B, "keeping a household for a dependent father or mother"),
  applies("2(b)", head_of_household, "the taxpayer is a head of household"),
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
  applies("2(b)(3)(A)", s2_b_3_A, "a nonresident alien at any time during the year"),
  {
    citation: "2(b)(3)(B)",
    predicate: s2_b_3_B,
    people: ["taxpayer", "individual"],
    year: true,
    description:
      "Whether section 2(b)(3)(B) applies to the taxpayer and the individual for the taxable " +
      "year: the individual would not be a dependent of the taxpayer but for section " +
      "152(d)(2)(H).",
  },
  {
    citation: "151(b)",
    predicate: s151_b,
    people: ["taxpayer", "spouse"],
    year: true,
    description:
      "Whether the taxpayer can receive an exemption for the spouse under section 151(b) for " +
      "the taxable year.",
  },
  {
    citation: "151(c)",
    predicate: s151_c,
    people: ["taxpayer", "dependent"],
    year: true,
    description:
      "Whether the taxpayer can claim an exemption for the dependent under section 151(c) " +
      "for the taxable year.",
  },
  applies("152(b)(1)", s152_b_1, "the taxpayer is a dependent of another, so has no dependents"),
  {
    citation: "152(b)(2)",
    predicate: s152_b_2,
    people: ["individual"],
    year: true,
    description:
      "Whether section 152(b)(2) applies to the individual for the taxable year: the " +
      "individual made a joint return with their spouse.",
  },
  {
    citation: "152(c)(1)",
    predicate: s152_c_1,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether the individual is a qualifying child of the taxpayer under section 152(c)(1) " +
      "for the taxable year. The question reads 'X is a qualifying child of Y': X is the " +
      "individual and Y is the taxpayer.",
  },
  {
    citation: "152(c)(1)(B)",
    predicate: s152_c_1_B,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether section 152(c)(1)(B) applies to the individual with the taxpayer as the " +
      "taxpayer for the taxable year: the same principal place of abode for more than half " +
      "the year.",
  },
  {
    citation: "152(c)(1)(E)",
    predicate: s152_c_1_E,
    people: ["individual"],
    year: true,
    description:
      "Whether section 152(c)(1)(E) applies to the individual for the taxable year: the " +
      "individual has not filed a joint return with their spouse.",
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
    citation: "152(d)(1)",
    predicate: s152_d_1,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether the individual is a qualifying relative of the taxpayer under section " +
      "152(d)(1) for the taxable year.",
  },
  {
    citation: "152(d)(1)(B)",
    predicate: s152_d_1_B,
    people: ["individual"],
    year: true,
    description:
      "Whether section 152(d)(1)(B) applies to the individual for the taxable year: the " +
      "individual has no income for the year.",
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
  for (const fact of yearMarksFacts()) {
    kb.asserts(fact);
  }
  defineHelpers(kb);
  defineS152(kb);
  defineS151(kb);
  defineS7703(kb);
  defineS2(kb);
  return kb;
}

/**
 * The statute as rules, and the registry that maps a section citation in a question to the
 * predicate that decides it. Each registry entry says which people the question names, in
 * order, and whether it names a taxable year.
 */
import { variable } from "@factbag/core/dsl";
import type { Atom, PredicateDeclaration, Var } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { yearBoundsFacts, yearMarksFacts } from "../schema";
import type { Person } from "../schema";
import { defineHelpers } from "./helpers";
import { defineTax, tax_owed } from "./tax";
import {
  defineS1,
  s1_a,
  s1_a_i,
  s1_a_ii,
  s1_a_iii,
  s1_a_iv,
  s1_a_v,
  s1_b,
  s1_b_i,
  s1_b_ii,
  s1_b_iii,
  s1_b_iv,
  s1_b_v,
  s1_c,
  s1_c_i,
  s1_c_ii,
  s1_c_iii,
  s1_c_iv,
  s1_c_v,
  s1_d,
  s1_d_i,
  s1_d_ii,
  s1_d_iii,
  s1_d_iv,
  s1_d_v,
  s1_tax,
} from "./s1";
import {
  defineS63,
  s63_a,
  s63_b,
  s63_c,
  s63_c_1,
  s63_c_2,
  s63_c_2_A,
  s63_c_2_A_amount,
  s63_c_2_A_i,
  s63_c_2_A_ii,
  s63_c_2_B,
  s63_c_2_B_amount,
  s63_c_2_C,
  s63_c_2_C_amount,
  s63_c_3,
  s63_c_5,
  s63_c_5_amount,
  s63_c_6,
  s63_c_6_A,
  s63_c_6_B,
  s63_c_6_D,
  s63_c_7_i_amount,
  s63_c_7_ii_amount,
  s63_d,
  s63_d_2,
  s63_f,
  s63_f_1_A,
  s63_f_1_B,
  s63_f_2_A,
  s63_f_2_B,
  s63_f_3,
  s63_f_3_amount,
  taxable_income_of,
} from "./s63";
import {
  applicable_amount,
  defineS68,
  s68_a,
  s68_a_1,
  s68_a_2,
  s68_applies,
  s68_b_1_A,
  s68_b_1_A_amount,
  s68_b_1_B,
  s68_b_1_B_amount,
  s68_b_1_C,
  s68_b_1_C_amount,
  s68_b_1_D,
  s68_b_1_D_amount,
  s68_f,
} from "./s68";
import {
  defineS3306,
  s3301,
  s3306_a,
  s3306_a_1,
  s3306_a_1_A,
  s3306_a_1_B,
  s3306_a_2,
  s3306_a_2_A,
  s3306_a_2_B,
  s3306_a_3,
  s3306_b,
  s3306_b_2,
  s3306_b_2_A,
  s3306_b_2_C,
  s3306_b_7,
  s3306_b_10,
  s3306_b_10_A,
  s3306_b_10_B,
  s3306_b_11,
  s3306_b_15,
  s3306_c,
  s3306_c_1,
  s3306_c_1_A,
  s3306_c_1_A_i,
  s3306_c_1_A_ii,
  s3306_c_1_B,
  s3306_c_2,
  s3306_c_5,
  s3306_c_5_A,
  s3306_c_5_B,
  s3306_c_6,
  s3306_c_7,
  s3306_c_10,
  s3306_c_10_A,
  s3306_c_10_A_i,
  s3306_c_10_A_ii,
  s3306_c_10_B,
  s3306_c_11,
  s3306_c_13,
  s3306_c_16,
  s3306_c_21,
  s3306_c_A,
  s3306_c_B,
} from "./s3306";
import {
  defineS151,
  exemption_amount,
  s151_a,
  s151_b,
  s151_c,
  s151_d_1,
  s151_d_2,
  s151_d_2_amount,
  s151_d_3_A,
  s151_d_3_B,
  s151_d_5,
  s151_d_5_amount,
} from "./s151";
import {
  defineS152,
  s152_a,
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
  s152_d_1_D,
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
  s2_b_1_A_i,
  s2_b_1_A_i_I,
  s2_b_1_A_i_II,
  s2_b_1_A_ii,
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
  /** The predicate for a yes-or-no question, when the provision has one. */
  predicate?: PredicateDeclaration;
  /**
   * The predicate for a question that names an amount, with an `amount` field: "is equal
   * to $4,000", "have to pay $7,208". When the provision has only this form, a question
   * without an amount cannot be read.
   */
  valued?: PredicateDeclaration;
  /** The question asks for the amount rather than naming it: the valued form is queried open. */
  open?: true;
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
  child:
    "the qualifying child the clause is about: 'with X as the qualifying child', or the " +
    "child the clause is applied to",
  employer: "the employer: the person who employed the other, or paid for their work",
  employee: "the employee: the person who did the work for the employer",
  payer: "the person who made the payment",
  payee: "the person the payment was made to, or for",
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

/** A provision whose question names an amount: whether the amount under it is the one named. */
function amounts(citation: string, valued: PredicateDeclaration, subject: string): Provision {
  return {
    citation,
    valued,
    people: [...TAXPAYER_YEAR],
    year: true,
    description:
      `Whether ${subject} under section ${citation} for the taxpayer and taxable year is the ` +
      "amount the question names.",
  };
}

/** A provision with both forms: whether it applies, and whether its amount is the one named. */
function both(
  citation: string,
  predicate: PredicateDeclaration,
  valued: PredicateDeclaration,
  subject: string,
): Provision {
  return {
    citation,
    predicate,
    valued,
    people: [...TAXPAYER_YEAR],
    year: true,
    description:
      `Whether section ${citation} applies to the taxpayer for the taxable year, or, when ` +
      `the question names an amount, whether ${subject} under it is that amount.`,
  };
}

/** A §3306(a) provision: whether the person is an employer for the year. */
function employer(citation: string, predicate: PredicateDeclaration, subject: string): Provision {
  return {
    citation,
    predicate,
    people: ["employer"],
    year: true,
    description:
      `Whether section ${citation} makes the employer an employer for the calendar year: ` +
      `${subject}. The question reads 'X is an employer' or 'makes X an employer': X is the employer.`,
  };
}

/** A §3306(c) provision about one person employing another. */
function employing(
  citation: string,
  predicate: PredicateDeclaration,
  subject: string,
  year = true,
): Provision {
  return {
    citation,
    predicate,
    people: ["employer", "employee"],
    year,
    description:
      `Whether section ${citation} applies to the employer employing the employee` +
      `${year ? " for the calendar year" : ""}: ${subject}. The question reads 'X employing Y': ` +
      "X is the employer and Y is the employee.",
  };
}

/** A §3306(c) provision about one person's employment situation. */
function situation(citation: string, predicate: PredicateDeclaration, subject: string): Provision {
  return {
    citation,
    predicate,
    people: ["employee"],
    year: true,
    description:
      `Whether section ${citation} applies to the employee's employment situation in the ` +
      `calendar year: ${subject}. The question reads "X's employment situation": X is the employee.`,
  };
}

/** A §3306(b) provision about a payment one person made to another. */
function paymentTo(
  citation: string,
  predicate: PredicateDeclaration,
  subject: string,
  year = true,
): Provision {
  return {
    citation,
    predicate,
    people: ["payer", "payee"],
    year,
    description:
      `Whether section ${citation} applies to the payment the payer made to the payee` +
      `${year ? " for the calendar year" : ""}: ${subject}. The question reads 'the payment X made ` +
      "to Y' or 'paid by X to Y': X is the payer and Y is the payee. When the question names a " +
      "fund or plan rather than a person as what was paid to, the payee is the person the fund " +
      "is for.",
  };
}

/** A §3306(b)(10) provision about a payment of a named amount. */
function paymentOf(citation: string, valued: PredicateDeclaration, subject: string): Provision {
  return {
    citation,
    valued,
    people: ["payer"],
    year: true,
    description:
      `Whether section ${citation} applies to the payment of the amount the question names ` +
      `that the payer made in the calendar year: ${subject}.`,
  };
}

/** The roman numerals of the five brackets of each §1 schedule. */
const BRACKETS = ["i", "ii", "iii", "iv", "v"] as const;

function schedule(
  letter: string,
  whole: PredicateDeclaration,
  brackets: readonly PredicateDeclaration[],
  who: string,
): readonly Provision[] {
  return [
    amounts(`1(${letter})`, whole, `the tax on the taxable income of ${who}`),
    ...brackets.map((predicate, index) =>
      amounts(
        `1(${letter})(${BRACKETS[index] ?? ""})`,
        predicate,
        `the tax on the taxable income of ${who}, when the income falls in this bracket`,
      ),
    ),
  ];
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
  {
    citation: "2(b)(1)(A)(i)",
    predicate: s2_b_1_A_i,
    people: ["child"],
    year: true,
    description:
      "Whether section 2(b)(1)(A)(i) applies to the child in the taxable year: the child is a " +
      "qualifying child of some taxpayer, and not one that subclauses (I) and (II) leave out. " +
      "The question reads 'applies to X': X is the child.",
  },
  {
    citation: "2(b)(1)(A)(i)(I)",
    predicate: s2_b_1_A_i_I,
    people: ["child"],
    year: true,
    description:
      "Whether section 2(b)(1)(A)(i)(I) applies to the child in the taxable year: the child " +
      "is married at the close of the year. The question reads 'applies to X': X is the child.",
  },
  {
    citation: "2(b)(1)(A)(i)(II)",
    predicate: s2_b_1_A_i_II,
    people: ["taxpayer", "child"],
    year: true,
    description:
      "Whether section 2(b)(1)(A)(i)(II) applies to the taxpayer and child in the taxable " +
      "year: the child is not a dependent of the taxpayer by reason of section 152(b)(2), a " +
      "joint return with the child's spouse. The question reads 'applies to X with Y as the " +
      "qualifying child': X is the taxpayer and Y is the child.",
  },
  {
    citation: "2(b)(1)(A)(ii)",
    predicate: s2_b_1_A_ii,
    people: ["dependent"],
    year: true,
    description:
      "Whether section 2(b)(1)(A)(ii) applies to the dependent in the taxable year: a " +
      "dependent of some taxpayer, other than a qualifying child, for whom that taxpayer is " +
      "entitled to a deduction under section 151. The question reads 'applies to X as the " +
      "dependent': X is the dependent.",
  },
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
  {
    citation: "152(a)",
    predicate: s152_a,
    people: ["individual", "taxpayer"],
    year: true,
    description:
      "Whether the individual is a dependent of the taxpayer under section 152(a) for the " +
      "taxable year: a qualifying child or a qualifying relative, subject to the exceptions " +
      "of subsection (b). The question reads 'X is a dependent of Y': X is the individual " +
      "and Y is the taxpayer.",
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
    citation: "152(d)(1)(D)",
    predicate: s152_d_1_D,
    people: ["individual"],
    year: true,
    description:
      "Whether section 152(d)(1)(D) applies to the individual for the taxable year: the " +
      "individual is not a qualifying child of any taxpayer for the year.",
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

  // --- §151(a) and (d): exemption amounts ---
  amounts("151(a)", s151_a, "the taxpayer's total exemptions"),
  amounts("151(d)", exemption_amount, "the exemption amount"),
  {
    citation: "151(d)(1)",
    valued: s151_d_1,
    people: ["taxpayer"],
    year: false,
    description:
      "Whether the exemption amount under section 151(d)(1), $2,000 before the rest of the " +
      "subsection, is the amount the question names. The paragraph names no year and the " +
      "question needs none.",
  },
  both("151(d)(2)", s151_d_2, s151_d_2_amount, "the exemption amount, which is zero"),
  amounts(
    "151(d)(3)(A)",
    s151_d_3_A,
    "the exemption amount as reduced by the applicable percentage, when adjusted gross " +
      "income exceeds the applicable amount",
  ),
  amounts("151(d)(3)(B)", s151_d_3_B, "the applicable percentage"),
  both(
    "151(d)(5)",
    s151_d_5,
    s151_d_5_amount,
    "the exemption amount, zero for taxable years 2018 through 2025",
  ),

  // --- §68: overall limitation on itemized deductions ---
  amounts("68(a)", s68_a, "the reduction of the itemized deductions"),
  amounts("68(a)(1)", s68_a_1, "the reduction of the itemized deductions, 3 percent of the excess"),
  amounts("68(a)(2)", s68_a_2, "80 percent of the itemized deductions"),
  both("68", s68_applies, s68_a, "the reduction of the itemized deductions"),
  amounts("68(b)", applicable_amount, "the applicable amount"),
  both("68(b)(1)(A)", s68_b_1_A, s68_b_1_A_amount, "the applicable amount"),
  both("68(b)(1)(B)", s68_b_1_B, s68_b_1_B_amount, "the applicable amount"),
  both("68(b)(1)(C)", s68_b_1_C, s68_b_1_C_amount, "the applicable amount"),
  both("68(b)(1)(D)", s68_b_1_D, s68_b_1_D_amount, "the applicable amount"),
  applies("68(f)", s68_f, "the section does not apply, the year being 2018 through 2025"),

  // --- §63: taxable income and the standard deduction ---
  amounts("63(a)", s63_a, "taxable income"),
  amounts("63(b)", s63_b, "taxable income of one who does not itemize"),
  amounts("63(c)", s63_c, "the standard deduction"),
  amounts("63(c)(1)", s63_c_1, "the standard deduction"),
  amounts("63(c)(2)", s63_c_2, "the basic standard deduction"),
  applies("63(c)(2)(A)(i)", s63_c_2_A_i, "a joint return for the year"),
  applies("63(c)(2)(A)(ii)", s63_c_2_A_ii, "a surviving spouse as defined in section 2(a)"),
  both("63(c)(2)(A)", s63_c_2_A, s63_c_2_A_amount, "the basic standard deduction"),
  both("63(c)(2)(B)", s63_c_2_B, s63_c_2_B_amount, "the basic standard deduction"),
  both("63(c)(2)(C)", s63_c_2_C, s63_c_2_C_amount, "the basic standard deduction"),
  amounts("63(c)(3)", s63_c_3, "the additional standard deduction"),
  both(
    "63(c)(5)",
    s63_c_5,
    s63_c_5_amount,
    "the limit on the basic standard deduction of a dependent",
  ),
  applies("63(c)(6)", s63_c_6, "the standard deduction is zero"),
  applies("63(c)(6)(A)", s63_c_6_A, "married filing separately where either spouse itemizes"),
  applies("63(c)(6)(B)", s63_c_6_B, "a nonresident alien"),
  applies(
    "63(c)(6)(D)",
    s63_c_6_D,
    "an estate or trust, common trust fund, or partnership rather than an individual",
  ),
  amounts("63(c)(7)(i)", s63_c_7_i_amount, "the basic standard deduction of a head of household"),
  amounts("63(c)(7)(ii)", s63_c_7_ii_amount, "the basic standard deduction in any other case"),
  applies("63(d)", s63_d, "the taxpayer's deduction is an itemized deduction"),
  applies(
    "63(d)(2)",
    s63_d_2,
    "the taxpayer's deduction is one for personal exemptions under §151",
  ),
  amounts("63(f)", s63_f, "the additional amounts for the aged and blind"),
  applies("63(f)(1)(A)", s63_f_1_A, "the taxpayer has attained age 65"),
  {
    citation: "63(f)(1)(B)",
    predicate: s63_f_1_B,
    people: ["taxpayer", "spouse"],
    year: true,
    description:
      "Whether section 63(f)(1)(B) applies to the taxpayer with the spouse as the spouse for " +
      "the taxable year: the spouse has attained age 65 and an exemption is allowable for them.",
  },
  applies("63(f)(2)(A)", s63_f_2_A, "the taxpayer is blind at the close of the year"),
  {
    citation: "63(f)(2)(B)",
    predicate: s63_f_2_B,
    people: ["taxpayer", "spouse"],
    year: true,
    description:
      "Whether section 63(f)(2)(B) applies to the taxpayer with the spouse as the spouse for " +
      "the taxable year: the spouse is blind and an exemption is allowable for them.",
  },
  both("63(f)(3)", s63_f_3, s63_f_3_amount, "the additional standard deduction at $750"),
  amounts("63", taxable_income_of, "taxable income"),

  // --- §1: tax imposed ---
  amounts("1", s1_tax, "the tax"),
  ...schedule(
    "a",
    s1_a,
    [s1_a_i, s1_a_ii, s1_a_iii, s1_a_iv, s1_a_v],
    "a married individual filing jointly or a surviving spouse",
  ),
  ...schedule("b", s1_b, [s1_b_i, s1_b_ii, s1_b_iii, s1_b_iv, s1_b_v], "a head of household"),
  ...schedule("c", s1_c, [s1_c_i, s1_c_ii, s1_c_iii, s1_c_iv, s1_c_v], "an unmarried individual"),
  ...schedule(
    "d",
    s1_d,
    [s1_d_i, s1_d_ii, s1_d_iii, s1_d_iv, s1_d_v],
    "a married individual filing separately",
  ),

  // --- §3306 and §3301: employment ---
  employer(
    "3306(a)(1)(A)",
    s3306_a_1_A,
    "paid $1,500 or more of wages in the year or the year before",
  ),
  employer("3306(a)(1)(B)", s3306_a_1_B, "employed someone on ten days in ten different weeks"),
  employer("3306(a)(1)", s3306_a_1, "an employer in general"),
  employer("3306(a)(2)(A)", s3306_a_2_A, "paid $20,000 or more of wages for agricultural labor"),
  employer(
    "3306(a)(2)(B)",
    s3306_a_2_B,
    "employed five or more in agricultural labor on ten days in ten different weeks",
  ),
  employer("3306(a)(2)", s3306_a_2, "an employer of agricultural labor"),
  employer("3306(a)(3)", s3306_a_3, "paid $1,000 or more in cash for domestic service"),
  employer("3306(a)", s3306_a, "an employer"),
  paymentTo("3306(b)", s3306_b, "the payment is wages: remuneration for employment, not excluded"),
  paymentTo(
    "3306(b)(2)(A)",
    s3306_b_2_A,
    "a payment under a plan on account of sickness or accident disability",
  ),
  paymentTo("3306(b)(2)(C)", s3306_b_2_C, "a payment under a plan on account of death"),
  paymentTo(
    "3306(b)(2)",
    s3306_b_2,
    "a payment under a plan on account of sickness, disability or death",
  ),
  paymentTo(
    "3306(b)(7)",
    s3306_b_7,
    "remuneration in kind for service outside the employer's trade or business",
    false,
  ),
  paymentOf(
    "3306(b)(10)(A)",
    s3306_b_10_A,
    "paid upon or after termination because of death or retirement for disability",
  ),
  paymentOf(
    "3306(b)(10)(B)",
    s3306_b_10_B,
    "paid under a plan established by the employer for employees generally",
  ),
  paymentOf("3306(b)(10)", s3306_b_10, "a termination payment under an employer's plan"),
  paymentTo("3306(b)(11)", s3306_b_11, "remuneration for agricultural labor paid in kind"),
  paymentTo(
    "3306(b)(15)",
    s3306_b_15,
    "a payment to a survivor of a former employee after the year of the death",
  ),
  employing("3306(c)(A)", s3306_c_A, "service performed within the United States", false),
  employing("3306(c)(B)", s3306_c_B, "service abroad by a citizen for an American employer", false),
  employing(
    "3306(c)(1)(A)(i)",
    s3306_c_1_A_i,
    "the employer paid $20,000 or more in cash for agricultural labor",
  ),
  employing(
    "3306(c)(1)(A)(ii)",
    s3306_c_1_A_ii,
    "the employer had five or more in agricultural labor on ten days in ten weeks",
  ),
  employing("3306(c)(1)(A)", s3306_c_1_A, "the employer meets (i) or (ii)"),
  employing(
    "3306(c)(1)(B)",
    s3306_c_1_B,
    "the labor is not by an alien admitted for agricultural labor",
    false,
  ),
  employing("3306(c)(1)", s3306_c_1, "agricultural labor that is not employment"),
  employing("3306(c)(2)", s3306_c_2, "domestic service that is not employment"),
  employing(
    "3306(c)(5)(A)",
    s3306_c_5_A,
    "service in the employ of a son, daughter or spouse",
    false,
  ),
  employing("3306(c)(5)(B)", s3306_c_5_B, "service by a child under 21 in the employ of a parent"),
  employing("3306(c)(5)", s3306_c_5, "service for a close relative that is not employment"),
  employing("3306(c)", s3306_c, "the service is employment"),
  situation("3306(c)(6)", s3306_c_6, "service in the employ of the United States Government"),
  situation("3306(c)(7)", s3306_c_7, "service in the employ of a State or its subdivision"),
  situation(
    "3306(c)(10)(A)(i)",
    s3306_c_10_A_i,
    "service for a school by a student enrolled and attending there",
  ),
  situation(
    "3306(c)(10)(A)(ii)",
    s3306_c_10_A_ii,
    "service for a school by the spouse of such a student",
  ),
  situation(
    "3306(c)(10)(A)",
    s3306_c_10_A,
    "service for a school by a student or a student's spouse",
  ),
  situation("3306(c)(10)(B)", s3306_c_10_B, "service for a hospital by a patient of it"),
  situation(
    "3306(c)(10)",
    s3306_c_10,
    "service for a school or hospital by a student, spouse or patient",
  ),
  situation("3306(c)(11)", s3306_c_11, "service in the employ of a foreign government"),
  situation("3306(c)(13)", s3306_c_13, "service as a student nurse"),
  situation("3306(c)(16)", s3306_c_16, "service in the employ of an international organization"),
  situation("3306(c)(21)", s3306_c_21, "service by a person committed to a penal institution"),
  {
    citation: "3301",
    valued: s3301,
    people: ["employer"],
    year: true,
    description:
      "Whether the tax under section 3301 on the employer for the calendar year is the amount " +
      "the question names: 6 percent of the wages paid with respect to employment.",
  },
];

/** The amount an open question asks for. */
const AMOUNT = variable("Amount");

/** The numeric question, "How much tax does X have to pay in Y?", as a provision. */
export const TAX_QUESTION: Provision = {
  citation: "tax",
  valued: tax_owed,
  people: ["taxpayer"],
  year: true,
  open: true,
  description:
    "How much tax the taxpayer has to pay for the year: the income tax of section 1 plus the " +
    "unemployment tax of section 3301.",
};

/**
 * The ground atom a question about a provision resolves to: the valued form when the
 * question names an amount and the provision has one, else the yes-or-no form.
 */
export function provisionAtom(
  provision: Provision,
  people: readonly Person[],
  year: number | undefined,
  amount?: number,
): Atom {
  if (people.length !== provision.people.length) {
    throw new Error(`Section ${provision.citation} names ${provision.people.length} people`);
  }
  if (provision.year !== (year !== undefined)) {
    throw new Error(`Section ${provision.citation} ${provision.year ? "needs" : "takes no"} year`);
  }
  const open = amount === undefined && provision.open === true;
  const predicate = amount === undefined && !open ? provision.predicate : provision.valued;
  if (predicate === undefined) {
    throw new Error(
      `Section ${provision.citation} ${amount === undefined ? "needs" : "takes no"} amount`,
    );
  }
  const fields: Record<string, Person | number | Var> = {};
  for (const [index, name] of provision.people.entries()) {
    const person = people[index];
    if (person !== undefined) {
      fields[name] = person;
    }
  }
  if (year !== undefined) {
    fields["year"] = year;
  }
  if (amount !== undefined) {
    fields["amount"] = amount;
  } else if (open) {
    fields["amount"] = AMOUNT;
  }
  return { predicate, fields };
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
  defineS68(kb);
  defineS63(kb);
  defineS1(kb);
  defineS3306(kb);
  defineTax(kb);
  return kb;
}

/**
 * The rules against hand-authored facts: each test is a train-split case with its facts
 * written down directly, so a failure here is a rule error, not a grounding error.
 */
import { query } from "@factbag/core/query";
import type { GroundAtom } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { describe, expect, test } from "vitest";
import { day as d } from "../calendar";
import {
  additional_amount_63f,
  blind,
  born,
  child_of,
  deduction_151c,
  dependent_152,
  died,
  exemption_151b,
  gross_income,
  head_of_household_stated,
  home_cost_share,
  joint_return,
  legally_separated,
  maintains_home,
  married_on,
  married_stated,
  married_undated,
  nonresident_alien,
  nonresident_alien_since,
  nonresident_alien_until,
  Person,
  qualifying_child_152c,
  satisfies_152c2,
  satisfies_152c3,
  separate_return,
  shares_home,
  sibling_of,
  stated_amount,
  stepchild_of,
  surviving_spouse_stated,
  taxable_income,
} from "../schema";
import { PROVISIONS, provisionAtom, statuteKB } from "./index";

const alice = new Person("Alice");
const bob = new Person("Bob");
const charlie = new Person("Charlie");

type Fact = ReturnType<typeof married_on> | ReturnType<typeof died>;

/** A KB with the statute plus these facts. */
function kbWith(facts: readonly GroundAtom[]): KnowledgeBase {
  const kb = statuteKB();
  kb.entities.add(alice, bob, charlie);
  for (const fact of facts) {
    kb.asserts(fact);
  }
  return kb;
}

function ask(
  kb: KnowledgeBase,
  citation: string,
  people: readonly Person[],
  year?: number,
  amount?: number,
): string {
  const provision = PROVISIONS.find((entry) => entry.citation === citation);
  if (provision === undefined) {
    throw new Error(`No provision ${citation}`);
  }
  return query(
    kb,
    provisionAtom(provision, people, year === undefined ? undefined : BigInt(year), amount),
  ).value;
}

const marriedIn1992: readonly Fact[] = [married_on({ a: alice, b: bob, day: d("1992-02-03") })];
const aliceDied2014: readonly Fact[] = [died({ person: alice, day: d("2014-07-09") })];

describe("§7703(a)", () => {
  const separated = kbWith([
    married_on({ a: alice, b: bob, day: d("2012-04-05") }),
    legally_separated({ a: alice, b: bob, decree: "divorce", day: d("2017-09-16") }),
  ]);
  test("(a)(2) applies once the decree is in", () => {
    expect(ask(separated, "7703(a)(2)", [alice], 2018)).toBe("true");
    expect(ask(separated, "7703(a)(2)", [alice], 2012)).toBe("false");
  });
  test("(a)(1) married at the close of the year, or at a spouse's death", () => {
    const kb = kbWith([...marriedIn1992, ...aliceDied2014]);
    expect(ask(kb, "7703(a)(1)", [bob, alice], 2013)).toBe("true");
    expect(ask(kb, "7703(a)(1)", [bob, alice], 2014)).toBe("true");
    expect(ask(kb, "7703(a)(1)", [bob, alice], 2015)).toBe("false");
    expect(ask(kb, "7703(a)(1)", [bob, alice], 1991)).toBe("false");
    expect(ask(separated, "7703(a)(1)", [alice, bob], 2018)).toBe("false");
    expect(ask(separated, "7703(a)(1)", [alice, bob], 2017)).toBe("false");
    expect(ask(separated, "7703(a)(1)", [alice, bob], 2016)).toBe("true");
  });
  test("an undated marriage counts from the start of time", () => {
    const kb = kbWith([married_undated({ a: bob, b: alice })]);
    expect(ask(kb, "7703(a)(1)", [alice, bob], 1990)).toBe("true");
  });
});

describe("§2(a)", () => {
  test("(a)(1)(A): spouse died in one of the two preceding years", () => {
    const kb = kbWith([...marriedIn1992, ...aliceDied2014]);
    expect(ask(kb, "2(a)(1)(A)", [bob], 2015)).toBe("true");
    expect(ask(kb, "2(a)(1)(A)", [bob], 2016)).toBe("true");
    expect(ask(kb, "2(a)(1)(A)", [bob], 2014)).toBe("false");
    expect(ask(kb, "2(a)(1)(A)", [bob], 2017)).toBe("false");
  });
  test("(a)(2)(A): remarried before the close of the year", () => {
    const kb = kbWith([
      ...marriedIn1992,
      ...aliceDied2014,
      married_on({ a: bob, b: charlie, day: d("2015-09-14") }),
    ]);
    expect(ask(kb, "2(a)(2)(A)", [bob], 2015)).toBe("true");
    expect(ask(kb, "2(a)(2)(A)", [bob], 2014)).toBe("false");
  });
  test("(a)(2)(B): a joint return could have been made", () => {
    expect(ask(kbWith([...marriedIn1992, ...aliceDied2014]), "2(a)(2)(B)", [bob], 2014)).toBe(
      "true",
    );
    const nra = kbWith([
      ...marriedIn1992,
      ...aliceDied2014,
      nonresident_alien_since({ person: alice, day: d("1990-03-04") }),
    ]);
    expect(ask(nra, "2(a)(2)(B)", [bob], 2014)).toBe("false");
  });
});

describe("§2(b)(2)", () => {
  test("(A): legally separated under a decree of separate maintenance", () => {
    const kb = kbWith([
      ...marriedIn1992,
      legally_separated({ a: alice, b: bob, decree: "separate maintenance", day: d("2014-07-09") }),
    ]);
    expect(ask(kb, "2(b)(2)(A)", [alice, bob], 2018)).toBe("true");
    expect(ask(kb, "2(b)(2)(A)", [alice, bob], 2010)).toBe("false");
  });
  test("(B): the spouse is a nonresident alien at some time in the year", () => {
    const kb = kbWith([
      ...marriedIn1992,
      nonresident_alien_until({ person: alice, day: d("2014-07-09") }),
    ]);
    expect(ask(kb, "2(b)(2)(B)", [bob], 2013)).toBe("true");
    expect(ask(kb, "2(b)(2)(B)", [bob], 2014)).toBe("true");
    expect(ask(kb, "2(b)(2)(B)", [bob], 2015)).toBe("false");
    const always = kbWith([...marriedIn1992, nonresident_alien({ person: alice })]);
    expect(ask(always, "2(b)(2)(B)", [bob], 2015)).toBe("true");
    expect(ask(always, "2(b)(2)(B)", [alice], 2015)).toBe("false");
  });
  test("(C): a spouse not described in (B) died during the year", () => {
    expect(ask(kbWith([...marriedIn1992, ...aliceDied2014]), "2(b)(2)(C)", [bob], 2014)).toBe(
      "true",
    );
    expect(ask(kbWith([...marriedIn1992, ...aliceDied2014]), "2(b)(2)(C)", [bob], 2015)).toBe(
      "false",
    );
    const nra = kbWith([...marriedIn1992, ...aliceDied2014, nonresident_alien({ person: alice })]);
    expect(ask(nra, "2(b)(2)(C)", [bob], 2014)).toBe("false");
  });
});

describe("§152(c)", () => {
  const son = kbWith([
    child_of({ child: bob, parent: alice }),
    born({ person: bob, day: d("2014-01-31") }),
  ]);
  const brother = kbWith([
    sibling_of({ a: alice, b: bob }),
    born({ person: bob, day: d("2014-01-31") }),
  ]);
  test("(c)(2)(A) and (c)(2): a child, in that direction only", () => {
    expect(ask(son, "152(c)(2)", [bob, alice])).toBe("true");
    expect(ask(son, "152(c)(2)", [alice, bob])).toBe("false");
    expect(ask(son, "152(c)(2)(A)", [bob, alice])).toBe("true");
    expect(ask(son, "152(c)(2)(B)", [bob, alice])).toBe("false");
  });
  test("(c)(2)(B): a sibling, either way round", () => {
    expect(ask(brother, "152(c)(2)(B)", [bob, alice])).toBe("true");
    expect(ask(brother, "152(c)(2)(B)", [alice, bob])).toBe("true");
    expect(ask(brother, "152(c)(2)(A)", [bob, alice])).toBe("false");
  });
  test("(c)(2)(B): a sibling's grandchild", () => {
    const kb = kbWith([
      sibling_of({ a: alice, b: bob }),
      child_of({ child: charlie, parent: bob }),
      child_of({ child: new Person("Dan"), parent: charlie }),
    ]);
    kb.entities.add(new Person("Dan"));
    expect(ask(kb, "152(c)(2)(B)", [new Person("Dan"), alice])).toBe("true");
  });
  test("(c)(3): younger than the taxpayer and under 25", () => {
    const young = kbWith([
      born({ person: alice, day: d("1992-01-10") }),
      born({ person: bob, day: d("2014-01-31") }),
      child_of({ child: bob, parent: alice }),
    ]);
    expect(ask(young, "152(c)(3)", [bob, alice], 2019)).toBe("true");
    expect(ask(young, "152(c)(3)", [bob, alice], 2038)).toBe("true");
    expect(ask(young, "152(c)(3)", [bob, alice], 2039)).toBe("false");
    const older = kbWith([
      born({ person: alice, day: d("1992-01-10") }),
      born({ person: bob, day: d("1984-01-31") }),
      child_of({ child: bob, parent: alice }),
    ]);
    expect(ask(older, "152(c)(3)", [bob, alice], 2019)).toBe("false");
    // Without the child's date of birth the age test is not met: see §152(d)(1) for the
    // qualifying relative such a child may still be.
    const undated = kbWith([child_of({ child: bob, parent: alice })]);
    expect(ask(undated, "152(c)(3)", [bob, alice], 2019)).toBe("false");
    // Without the taxpayer's, a descendant is taken to be the younger, as the reference
    // formalization does; a sibling is not.
    const childOnly = kbWith([
      child_of({ child: bob, parent: alice }),
      born({ person: bob, day: d("2014-01-31") }),
    ]);
    expect(ask(childOnly, "152(c)(3)", [bob, alice], 2019)).toBe("true");
    const siblingOnly = kbWith([
      sibling_of({ a: alice, b: bob }),
      born({ person: bob, day: d("2014-01-31") }),
    ]);
    expect(ask(siblingOnly, "152(c)(3)", [bob, alice], 2019)).toBe("false");
  });
});

describe("§152(d)(2)", () => {
  const dan = new Person("Dan");
  const withDan = (facts: readonly GroundAtom[]): KnowledgeBase => {
    const kb = kbWith(facts);
    kb.entities.add(dan);
    return kb;
  };

  test("(A): a child, a stepchild, or a grandchild of the taxpayer", () => {
    expect(
      ask(kbWith([child_of({ child: alice, parent: bob })]), "152(d)(2)(A)", [alice, bob]),
    ).toBe("true");
    expect(
      ask(kbWith([stepchild_of({ child: alice, stepparent: bob })]), "152(d)(2)(A)", [alice, bob]),
    ).toBe("true");
    expect(
      ask(
        kbWith([
          child_of({ child: charlie, parent: bob }),
          child_of({ child: alice, parent: charlie }),
        ]),
        "152(d)(2)(A)",
        [alice, bob],
      ),
    ).toBe("true");
    expect(
      ask(kbWith([child_of({ child: bob, parent: alice })]), "152(d)(2)(A)", [alice, bob]),
    ).toBe("false");
  });

  test("(B): Bob is Alice's brother, in either order; a son is not a brother", () => {
    expect(ask(kbWith([sibling_of({ a: bob, b: alice })]), "152(d)(2)(B)", [alice, bob])).toBe(
      "true",
    );
    expect(
      ask(kbWith([child_of({ child: bob, parent: alice })]), "152(d)(2)(B)", [alice, bob]),
    ).toBe("false");
  });

  test("(C): a parent or grandparent, but not a stepparent", () => {
    expect(
      ask(kbWith([child_of({ child: bob, parent: alice })]), "152(d)(2)(C)", [alice, bob]),
    ).toBe("true");
    expect(
      ask(
        kbWith([
          child_of({ child: bob, parent: charlie }),
          child_of({ child: charlie, parent: alice }),
        ]),
        "152(d)(2)(C)",
        [alice, bob],
      ),
    ).toBe("true");
    expect(
      ask(kbWith([stepchild_of({ child: bob, stepparent: alice })]), "152(d)(2)(C)", [alice, bob]),
    ).toBe("false");
  });

  test("(D): a stepparent, stated or the spouse of a parent, but not a parent", () => {
    expect(
      ask(kbWith([stepchild_of({ child: bob, stepparent: alice })]), "152(d)(2)(D)", [alice, bob]),
    ).toBe("true");
    expect(
      ask(kbWith([child_of({ child: bob, parent: alice })]), "152(d)(2)(D)", [alice, bob]),
    ).toBe("false");
    // s152_d_2_D_pos: Charlie is Bob's father and Alice married Charlie.
    const stepmother = kbWith([
      child_of({ child: bob, parent: charlie }),
      married_on({ a: alice, b: charlie, day: d("2018-08-08") }),
    ]);
    expect(ask(stepmother, "152(d)(2)(D)", [alice, bob])).toBe("true");
    expect(ask(stepmother, "152(d)(2)(A)", [bob, alice])).toBe("true");
    // Both parents married to each other: neither is a stepparent.
    const parents = kbWith([
      child_of({ child: bob, parent: charlie }),
      child_of({ child: bob, parent: alice }),
      married_on({ a: alice, b: charlie, day: d("1990-08-08") }),
    ]);
    expect(ask(parents, "152(d)(2)(D)", [alice, bob])).toBe("false");
  });

  test("(E): Alice is the daughter of Charlie, Bob's brother; an aunt does not qualify", () => {
    const niece = kbWith([
      child_of({ child: alice, parent: charlie }),
      sibling_of({ a: bob, b: charlie }),
    ]);
    expect(ask(niece, "152(d)(2)(E)", [alice, bob])).toBe("true");
    const aunt = kbWith([
      child_of({ child: bob, parent: charlie }),
      sibling_of({ a: alice, b: charlie }),
    ]);
    expect(ask(aunt, "152(d)(2)(E)", [alice, bob])).toBe("false");
    expect(ask(aunt, "152(d)(2)(F)", [alice, bob])).toBe("true");
  });

  test("(F): a sibling of a parent, but not of a stepparent", () => {
    expect(
      ask(
        kbWith([
          stepchild_of({ child: bob, stepparent: charlie }),
          sibling_of({ a: alice, b: charlie }),
        ]),
        "152(d)(2)(F)",
        [alice, bob],
      ),
    ).toBe("false");
  });

  test("(G): in-laws through a marriage", () => {
    const sonInLaw = kbWith([
      married_on({ a: alice, b: charlie, day: d("2010-05-01") }),
      child_of({ child: charlie, parent: bob }),
    ]);
    expect(ask(sonInLaw, "152(d)(2)(G)", [alice, bob])).toBe("true");
    const motherInLaw = kbWith([
      married_on({ a: bob, b: charlie, day: d("2010-05-01") }),
      child_of({ child: charlie, parent: alice }),
    ]);
    expect(ask(motherInLaw, "152(d)(2)(G)", [alice, bob])).toBe("true");
    const sisterInLaw = withDan([
      married_on({ a: bob, b: dan, day: d("2010-05-01") }),
      sibling_of({ a: alice, b: dan }),
    ]);
    expect(ask(sisterInLaw, "152(d)(2)(G)", [alice, bob])).toBe("true");
    expect(ask(kbWith([sibling_of({ a: alice, b: bob })]), "152(d)(2)(G)", [alice, bob])).toBe(
      "false",
    );
  });

  test("(H): a household member for the year who was not the spouse", () => {
    const friend = kbWith([shares_home.inYear({ a: alice, b: bob, year: 2018n })]);
    expect(ask(friend, "152(d)(2)(H)", [alice, bob], 2018)).toBe("true");
    expect(ask(friend, "152(d)(2)(H)", [alice, bob], 2019)).toBe("false");
    const dated = kbWith([
      shares_home.since({ a: bob, b: alice, day: d("2017-09-16") }),
      shares_home.until({ a: bob, b: alice, day: d("2018-02-10") }),
    ]);
    expect(ask(dated, "152(d)(2)(H)", [alice, bob], 2018)).toBe("true");
    expect(ask(dated, "152(d)(2)(H)", [alice, bob], 2019)).toBe("false");
    const spouse = kbWith([
      shares_home.undated({ a: alice, b: bob }),
      married_on({ a: alice, b: bob, day: d("2010-05-01") }),
    ]);
    expect(ask(spouse, "152(d)(2)(H)", [alice, bob], 2018)).toBe("false");
    expect(ask(spouse, "152(d)(2)", [alice, bob], 2018)).toBe("false");
    expect(ask(friend, "152(d)(2)", [alice, bob], 2018)).toBe("true");
  });
});

describe("household and dependents", () => {
  // s7703_b_*: Alice and Bob married in 2012; their son Charlie, born 2017-09-16, lives in a
  // home Alice has maintained since then, and Alice takes the §151(c) deduction for him.
  const aliceHome: readonly GroundAtom[] = [
    married_on({ a: alice, b: bob, day: d("2012-04-05") }),
    child_of({ child: charlie, parent: alice }),
    child_of({ child: charlie, parent: bob }),
    born({ person: charlie, day: d("2017-09-16") }),
    shares_home.since({ a: alice, b: charlie, day: d("2017-09-16") }),
    maintains_home.since({ person: alice, day: d("2017-09-16") }),
    deduction_151c.inYear({ taxpayer: alice, dependent: charlie, year: 2018n }),
  ];

  test("§7703(b)(1): married, filing separately, keeping a home for a deductible child", () => {
    expect(
      ask(
        kbWith([...aliceHome, separate_return.undated({ person: alice })]),
        "7703(b)(1)",
        [alice],
        2018,
      ),
    ).toBe("true");
    expect(
      ask(
        kbWith([...aliceHome, joint_return.inYear({ person: alice, year: 2018n })]),
        "7703(b)(1)",
        [alice],
        2018,
      ),
    ).toBe("false");
  });

  test("§7703(b)(3): the spouse left before or after the last six months", () => {
    const left = (until: string): KnowledgeBase =>
      kbWith([
        ...aliceHome,
        shares_home.since({ a: bob, b: alice, day: d("2017-09-16") }),
        shares_home.until({ a: bob, b: alice, day: d(until) }),
      ]);
    expect(ask(left("2018-02-10"), "7703(b)(3)", [alice], 2018)).toBe("true");
    expect(ask(left("2018-10-10"), "7703(b)(3)", [alice], 2018)).toBe("false");
    // The classifier also asserts the year alongside the exact days; the days win.
    const both = kbWith([
      ...aliceHome,
      shares_home.since({ a: bob, b: alice, day: d("2017-09-16") }),
      shares_home.until({ a: bob, b: alice, day: d("2018-02-10") }),
      shares_home.inYear({ a: alice, b: bob, year: 2018n }),
    ]);
    expect(ask(both, "7703(b)(3)", [alice], 2018)).toBe("true");
  });

  // s2_b_1_*: Alice and Bob married in 1992, Alice died in 2014, Bob keeps the home where he
  // and Charlie live from 2004 to 2019.
  const bobHome: readonly GroundAtom[] = [
    ...marriedIn1992,
    ...aliceDied2014,
    maintains_home.inYear({ person: bob, year: 2016n }),
    maintains_home.inYear({ person: bob, year: 2018n }),
    shares_home.inYear({ a: bob, b: charlie, year: 2016n }),
    shares_home.inYear({ a: bob, b: charlie, year: 2018n }),
  ];
  const sonCharlie: readonly GroundAtom[] = [
    child_of({ child: charlie, parent: bob }),
    deduction_151c.inYear({ taxpayer: bob, dependent: charlie, year: 2016n }),
    deduction_151c.inYear({ taxpayer: bob, dependent: charlie, year: 2018n }),
  ];
  const fatherCharlie: readonly GroundAtom[] = [
    child_of({ child: bob, parent: charlie }),
    deduction_151c.inYear({ taxpayer: bob, dependent: charlie, year: 2018n }),
  ];

  test("§2(b)(1)(A): a qualifying child in a home the taxpayer pays for", () => {
    const qualifying = [
      ...bobHome,
      child_of({ child: charlie, parent: bob }),
      qualifying_child_152c.inYear({ child: charlie, taxpayer: bob, year: 2018n }),
    ];
    expect(ask(kbWith(qualifying), "2(b)(1)(A)", [bob], 2018)).toBe("true");
    expect(
      ask(
        kbWith([...qualifying, home_cost_share({ person: bob, percent: 40 })]),
        "2(b)(1)(A)",
        [bob],
        2018,
      ),
    ).toBe("false");
  });

  test("§2(b)(1)(B): a deductible father, not a deductible son", () => {
    expect(ask(kbWith([...bobHome, ...fatherCharlie]), "2(b)(1)(B)", [bob], 2018)).toBe("true");
    expect(ask(kbWith([...bobHome, ...sonCharlie]), "2(b)(1)(B)", [bob], 2018)).toBe("false");
  });

  test("§2(b)(1): not while a surviving spouse, then yes for a dependent father", () => {
    expect(ask(kbWith([...bobHome, ...sonCharlie]), "2(a)", [bob], 2016)).toBe("true");
    expect(ask(kbWith([...bobHome, ...sonCharlie]), "2(b)(1)", [bob], 2016)).toBe("false");
    expect(ask(kbWith([...bobHome, ...fatherCharlie]), "2(b)(1)", [bob], 2018)).toBe("true");
    expect(ask(kbWith([...bobHome, ...fatherCharlie]), "2(b)", [bob], 2018)).toBe("true");
  });

  test("§2(b)(3)(B): a dependent only by sharing the home, not a father", () => {
    const friend = kbWith([
      ...bobHome,
      dependent_152.inYear({ dependent: charlie, taxpayer: bob, year: 2018n }),
      gross_income({ person: bob, year: 2018n, amount: 300_000 }),
    ]);
    expect(ask(friend, "2(b)(3)(B)", [bob, charlie], 2018)).toBe("true");
    expect(ask(friend, "2(b)", [bob], 2018)).toBe("false");
    expect(ask(kbWith([...bobHome, ...fatherCharlie]), "2(b)(3)(B)", [bob, charlie], 2018)).toBe(
      "false",
    );
  });

  test("§152(b)(1): a dependent has no dependents", () => {
    // s152_b_1_*: Alice's son Bob and Bob's son Charlie each satisfy §152(c)(1). The
    // reference formalization's facts for the case are these two statements alone.
    const stated = [
      qualifying_child_152c.inYear({ child: bob, taxpayer: alice, year: 2015n }),
      qualifying_child_152c.inYear({ child: charlie, taxpayer: bob, year: 2015n }),
    ];
    const chain = kbWith(stated);
    expect(ask(chain, "152(b)(1)", [bob], 2015)).toBe("true");
    expect(ask(chain, "152(b)(1)", [alice], 2015)).toBe("false");
    expect(ask(chain, "151(c)", [bob, charlie], 2015)).toBe("false");
    expect(ask(chain, "151(c)", [alice, bob], 2015)).toBe("true");
  });

  test("§152(b)(1): the parent and child cycle the text's relations create", () => {
    // With the sons' relations the text states, and no income stated for anyone, Alice
    // is a qualifying relative of Bob and of Charlie under (d)(2)(C): she is their mother
    // and grandmother, has no income, and is nobody's qualifying child. Each of Alice and
    // Bob then defeats the other under (b)(1), and neither is a dependent. This is what the
    // reference formalization answers on the same facts, and it disagrees with the case's
    // label for Bob, which rests on the relations being left out of its facts.
    const related = kbWith([
      child_of({ child: bob, parent: alice }),
      child_of({ child: charlie, parent: bob }),
      qualifying_child_152c.inYear({ child: bob, taxpayer: alice, year: 2015n }),
      qualifying_child_152c.inYear({ child: charlie, taxpayer: bob, year: 2015n }),
    ]);
    expect(ask(related, "152(d)(1)", [alice, bob], 2015)).toBe("true");
    expect(ask(related, "152(b)(1)", [bob], 2015)).toBe("false");
    expect(ask(related, "152(b)(1)", [alice], 2015)).toBe("false");
    expect(ask(related, "151(c)", [alice, bob], 2015)).toBe("false");
    // Income for Alice removes her from (d)(1)(B), and the case's answers return.
    const earning = kbWith([
      child_of({ child: bob, parent: alice }),
      child_of({ child: charlie, parent: bob }),
      qualifying_child_152c.inYear({ child: bob, taxpayer: alice, year: 2015n }),
      qualifying_child_152c.inYear({ child: charlie, taxpayer: bob, year: 2015n }),
      gross_income({ person: alice, year: 2015n, amount: 50_000 }),
    ]);
    expect(ask(earning, "152(b)(1)", [bob], 2015)).toBe("true");
    expect(ask(earning, "152(b)(1)", [alice], 2015)).toBe("false");
    expect(ask(earning, "151(c)", [alice, bob], 2015)).toBe("true");
    expect(ask(earning, "151(c)", [bob, charlie], 2015)).toBe("false");
  });

  test("§152(b)(2): a joint return, not separate returns", () => {
    const wed = married_on({ a: alice, b: bob, day: d("2015-01-01") });
    expect(
      ask(
        kbWith([wed, joint_return.inYear({ person: alice, year: 2015n })]),
        "152(b)(2)",
        [alice],
        2015,
      ),
    ).toBe("true");
    expect(
      ask(
        kbWith([wed, separate_return.inYear({ person: alice, year: 2015n })]),
        "152(b)(2)",
        [alice],
        2015,
      ),
    ).toBe("false");
  });

  // s152_c_1_*: Alice's son Bob lived with her from 2015-09-01 to 2019-11-03.
  const together = (until: string): readonly GroundAtom[] => [
    child_of({ child: bob, parent: alice }),
    shares_home.since({ a: alice, b: bob, day: d("2015-09-01") }),
    shares_home.until({ a: alice, b: bob, day: d(until) }),
  ];

  test("§152(c)(1)(B): more than half the year in the same home", () => {
    const kb = kbWith(together("2019-11-03"));
    expect(ask(kb, "152(c)(1)(B)", [bob, alice], 2015)).toBe("false");
    expect(ask(kb, "152(c)(1)(B)", [bob, alice], 2016)).toBe("true");
    expect(ask(kb, "152(c)(1)(B)", [bob, alice], 2019)).toBe("true");
    expect(ask(kbWith(together("2019-02-03")), "152(c)(1)(B)", [bob, alice], 2019)).toBe("false");
    expect(ask(kbWith(together("2019-07-02")), "152(c)(1)(B)", [bob, alice], 2019)).toBe("true");
    expect(ask(kbWith(together("2019-07-01")), "152(c)(1)(B)", [bob, alice], 2019)).toBe("false");
  });

  test("§152(c)(1)(E) and (c)(1): a joint return disqualifies", () => {
    const wed = married_on({ a: bob, b: charlie, day: d("2018-10-23") });
    const stated = [
      satisfies_152c2.inYear({ child: bob, taxpayer: alice, year: 2019n }),
      satisfies_152c3.inYear({ child: bob, taxpayer: alice, year: 2019n }),
    ];
    const joint = kbWith([
      ...together("2019-11-03"),
      wed,
      joint_return.inYear({ person: bob, year: 2019n }),
    ]);
    expect(ask(joint, "152(c)(1)(E)", [bob], 2019)).toBe("false");
    expect(ask(joint, "152(c)(1)", [bob, alice], 2019)).toBe("false");
    const separate = kbWith([
      ...together("2019-11-03"),
      wed,
      separate_return.undated({ person: bob }),
      ...stated,
    ]);
    expect(ask(separate, "152(c)(1)(E)", [bob], 2019)).toBe("true");
    expect(ask(separate, "152(c)(1)", [bob, alice], 2019)).toBe("true");
    expect(
      ask(kbWith([...together("2019-02-03"), wed, ...stated]), "152(c)(1)", [bob, alice], 2019),
    ).toBe("false");
  });

  test("§152(d)(1)(B): no income for the year", () => {
    // s152_d_1_B_pos says Alice "did not have any income"; its facts, like those of every
    // case where someone has no income, simply state none. Absence is zero, as in the
    // reference formalization, which sums the income it finds.
    expect(ask(kbWith([]), "152(d)(1)(B)", [alice], 2015)).toBe("true");
    expect(
      ask(
        kbWith([gross_income({ person: alice, year: 2015n, amount: 2312 })]),
        "152(d)(1)(B)",
        [alice],
        2015,
      ),
    ).toBe("false");
    // Income in another year is not income in this one.
    expect(
      ask(
        kbWith([gross_income({ person: alice, year: 2014n, amount: 2312 })]),
        "152(d)(1)(B)",
        [alice],
        2015,
      ),
    ).toBe("true");
    // An explicit denial of an amount is not income either, and does not conflict with
    // absence; a denial alongside a stated amount is a conflict the query reports.
    const denied = kbWith([]);
    denied.denies(gross_income({ person: alice, year: 2015n, amount: 2312 }));
    expect(ask(denied, "152(d)(1)(B)", [alice], 2015)).toBe("true");
    const contradicted = kbWith([gross_income({ person: alice, year: 2015n, amount: 2312 })]);
    contradicted.denies(gross_income({ person: alice, year: 2015n, amount: 2312 }));
    expect(ask(contradicted, "152(d)(1)(B)", [alice], 2015)).toBe("conflicted");
  });

  test("§152(d)(1): an income-less parent is the qualifying relative of a child", () => {
    // Nothing in SARA's §152(d) asks who supports whom, so a parent with no stated income
    // qualifies under (d)(2)(C) for a child who is not a qualifying child of anyone else.
    const pair = [child_of({ child: bob, parent: alice })];
    expect(ask(kbWith(pair), "152(d)(1)", [alice, bob], 2015)).toBe("true");
    expect(ask(kbWith(pair), "152(d)(1)", [bob, alice], 2015)).toBe("true");
    const earning = [...pair, gross_income({ person: alice, year: 2015n, amount: 50_000 })];
    expect(ask(kbWith(earning), "152(d)(1)", [alice, bob], 2015)).toBe("false");
    expect(ask(kbWith(earning), "152(d)(1)", [bob, alice], 2015)).toBe("true");
    // Mutual qualification leaves neither a dependent; one income settles it.
    expect(ask(kbWith(pair), "151(c)", [alice, bob], 2015)).toBe("false");
    expect(ask(kbWith(pair), "151(c)", [bob, alice], 2015)).toBe("false");
    expect(ask(kbWith(earning), "151(c)", [alice, bob], 2015)).toBe("true");
    expect(ask(kbWith(earning), "151(c)", [bob, alice], 2015)).toBe("false");
  });

  test("§151(b): a spouse exemption unless a joint return is made", () => {
    const wed = married_on({ a: alice, b: bob, day: d("2015-02-02") });
    expect(ask(kbWith([wed]), "151(b)", [alice, bob], 2015)).toBe("true");
    expect(
      ask(
        kbWith([wed, joint_return.inYear({ person: alice, year: 2015n })]),
        "151(b)",
        [alice, bob],
        2015,
      ),
    ).toBe("false");
    expect(
      ask(
        kbWith([wed, gross_income({ person: bob, year: 2015n, amount: 100 })]),
        "151(b)",
        [alice, bob],
        2015,
      ),
    ).toBe("false");
  });

  test("§151(c): the stated dependent, not the spouse", () => {
    const kb = kbWith([
      married_on({ a: alice, b: charlie, day: d("2015-02-02") }),
      dependent_152.inYear({ dependent: bob, taxpayer: alice, year: 2015n }),
    ]);
    expect(ask(kb, "151(c)", [alice, bob], 2015)).toBe("true");
    expect(ask(kb, "151(c)", [alice, charlie], 2015)).toBe("false");
  });
});

describe("amounts: §151(d), §68, §63 and §1", () => {
  // Each test's facts are a train case's text written down; see the case ids.
  const income = (person: Person, year: number, amount: number): GroundAtom =>
    gross_income({ person, year: BigInt(year), amount });
  const paid2017 = income(alice, 2017, 33_200);
  const wed2017 = married_on({ a: alice, b: bob, day: d("2017-02-03") });

  test("§151(a): the taxpayer's own exemption plus the stated dependent one", () => {
    // s151_a_*
    const kb = kbWith([
      income(alice, 2015, 100_000),
      stated_amount.inYear({ person: alice, kind: "exemption_151c", amount: 2000, year: 2015n }),
    ]);
    expect(ask(kb, "151(a)", [alice], 2015, 4000)).toBe("true");
    expect(ask(kb, "151(a)", [alice], 2015, 6000)).toBe("false");
  });

  test("§151(d)(2): zero for a dependent of another taxpayer", () => {
    // s151_d_2_*
    const kb = kbWith([deduction_151c.inYear({ taxpayer: alice, dependent: bob, year: 2015n })]);
    expect(ask(kb, "151(d)(2)", [bob], 2015, 0)).toBe("true");
    expect(ask(kb, "151(d)(2)", [bob], 2015)).toBe("true");
    expect(ask(kb, "151(d)", [bob], 2015, 0)).toBe("true");
    expect(ask(kb, "151(d)", [alice], 2015, 2000)).toBe("true");
    expect(ask(kbWith([]), "151(d)(2)", [bob], 2015, 2000)).toBe("false");
    expect(ask(kbWith([]), "151(d)", [bob], 2018, 0)).toBe("true");
  });

  test("§151(d)(3)(B): two points per $2,500 of excess, at most 100", () => {
    // s151_d_3_B_*
    const applicable = stated_amount.inYear({
      person: alice,
      kind: "applicable_amount_68b",
      amount: 250_000,
      year: 2015n,
    });
    const pos = kbWith([income(alice, 2015, 276_932), applicable]);
    expect(ask(pos, "151(d)(3)(B)", [alice], 2015, 22)).toBe("true");
    // The exemption amount is reduced by 22 percent: 2000 less 440.
    expect(ask(pos, "151(d)", [alice], 2015, 1560)).toBe("true");
    const neg = kbWith([income(alice, 2015, 395_276), applicable]);
    expect(ask(neg, "151(d)(3)(B)", [alice], 2015, 118)).toBe("false");
    expect(ask(neg, "151(d)(3)(B)", [alice], 2015, 100)).toBe("true");
    expect(ask(neg, "151(d)", [alice], 2015, 0)).toBe("true");
    // Married filing separately counts $1,250 steps: 22 of them for the same excess.
    const separate = kbWith([
      income(alice, 2015, 276_932),
      applicable,
      married_stated.inYear({ person: alice, year: 2015n }),
      separate_return.undated({ person: alice }),
    ]);
    expect(ask(separate, "151(d)(3)(B)", [alice], 2015, 44)).toBe("true");
  });

  test("§68(b): the applicable amount by filing status", () => {
    // s68_b_1_A_*, s68_b_1_D_*
    const earned = income(alice, 2016, 567_192);
    const survivor = kbWith([
      earned,
      surviving_spouse_stated.inYear({ person: alice, year: 2016n }),
    ]);
    expect(ask(survivor, "68(b)(1)(A)", [alice], 2016, 300_000)).toBe("true");
    expect(ask(survivor, "68(b)(1)(A)", [alice], 2016)).toBe("true");
    expect(ask(survivor, "68(b)", [alice], 2016, 300_000)).toBe("true");
    const separate = kbWith([earned, married_stated.inYear({ person: alice, year: 2016n })]);
    separate.denies(joint_return.inYear({ person: alice, year: 2016n }));
    expect(ask(separate, "68(b)(1)(A)", [alice], 2016)).toBe("false");
    expect(ask(separate, "68(b)(1)(D)", [alice], 2016, 150_000)).toBe("true");
    expect(ask(separate, "68(b)", [alice], 2016, 150_000)).toBe("true");
    const single = kbWith([earned]);
    expect(ask(single, "68(b)(1)(D)", [alice], 2016)).toBe("false");
    expect(ask(single, "68(b)(1)(C)", [alice], 2016, 250_000)).toBe("true");
    const head = kbWith([head_of_household_stated.inYear({ person: alice, year: 2016n })]);
    expect(ask(head, "68(b)(1)(B)", [alice], 2016, 275_000)).toBe("true");
  });

  test("§68(a)(1) and (f): 3 percent of the excess, not in 2018 through 2025", () => {
    // s68_a_1_*, s68_f_*
    const itemized = stated_amount.undated({
      person: alice,
      kind: "itemized_deduction",
      amount: 60_000,
    });
    const survivor = kbWith([
      income(alice, 2016, 310_192),
      surviving_spouse_stated.inYear({ person: alice, year: 2016n }),
      itemized,
    ]);
    expect(ask(survivor, "68(a)(1)", [alice], 2016, 306)).toBe("true");
    expect(ask(survivor, "68(a)(2)", [alice], 2016, 48_000)).toBe("true");
    expect(ask(survivor, "68(a)", [alice], 2016, 306)).toBe("true");
    const head = kbWith([
      income(alice, 2016, 267_192),
      head_of_household_stated.inYear({ person: alice, year: 2016n }),
      itemized,
    ]);
    expect(ask(head, "68(a)(1)", [alice], 2016, 306)).toBe("false");
    expect(ask(kbWith([]), "68(f)", [alice], 2018)).toBe("true");
    expect(ask(kbWith([]), "68(f)", [alice], 2014)).toBe("false");
  });

  test("§63(c)(2): the basic standard deduction by status and year", () => {
    // s63_c_2_B_*, s63_c_2_C_*, s63_c_7_ii_*
    const head = kbWith([
      paid2017,
      head_of_household_stated.inYear({ person: alice, year: 2017n }),
    ]);
    expect(ask(head, "63(c)(2)(B)", [alice], 2017, 4400)).toBe("true");
    const joint = kbWith([
      paid2017,
      wed2017,
      joint_return.inYear({ person: alice, year: 2017n }),
      joint_return.inYear({ person: bob, year: 2017n }),
    ]);
    expect(ask(joint, "63(c)(2)(B)", [alice], 2017, 4400)).toBe("false");
    expect(ask(joint, "63(c)(2)(C)", [alice], 2017, 4400)).toBe("false");
    expect(ask(joint, "63(c)(2)(A)", [alice], 2017, 6000)).toBe("true");
    expect(ask(joint, "63(c)(2)", [alice], 2017, 6000)).toBe("true");
    const separate = kbWith([
      paid2017,
      wed2017,
      separate_return.undated({ person: alice }),
      separate_return.undated({ person: bob }),
    ]);
    expect(ask(separate, "63(c)(2)(C)", [alice], 2017, 3000)).toBe("true");
    const later = kbWith([
      income(alice, 2019, 33_200),
      married_on({ a: alice, b: bob, day: d("2019-02-03") }),
      separate_return.inYear({ person: alice, year: 2019n }),
    ]);
    expect(ask(later, "63(c)(7)(ii)", [alice], 2019, 12_000)).toBe("true");
    expect(ask(later, "63(c)(7)(ii)", [alice], 2019, 3000)).toBe("false");
  });

  test("§63(c)(1) and (c)(3): stated basic and additional amounts", () => {
    // s63_c_1_*, s63_c_3_*
    const kb = kbWith([
      paid2017,
      stated_amount.inYear({
        person: alice,
        kind: "basic_standard_deduction_63c2",
        amount: 2000,
        year: 2017n,
      }),
      stated_amount.inYear({
        person: alice,
        kind: "additional_standard_deduction_63c3",
        amount: 3000,
        year: 2017n,
      }),
    ]);
    expect(ask(kb, "63(c)(1)", [alice], 2017, 5000)).toBe("true");
    expect(ask(kb, "63(c)(1)", [alice], 2017, 4000)).toBe("false");
    const each = kbWith([
      paid2017,
      wed2017,
      additional_amount_63f.undated({ taxpayer: alice, beneficiary: alice, amount: 600 }),
      additional_amount_63f.undated({ taxpayer: alice, beneficiary: bob, amount: 600 }),
    ]);
    expect(ask(each, "63(c)(3)", [alice], 2017, 1200)).toBe("true");
    expect(ask(each, "63(c)(3)", [alice], 2017, 300)).toBe("false");
  });

  test("§63(c)(5): a dependent's basic standard deduction is capped", () => {
    // s63_c_5_*
    const pos = kbWith([
      paid2017,
      wed2017,
      exemption_151b.undated({ taxpayer: alice, spouse: bob }),
    ]);
    expect(ask(pos, "63(c)(5)", [bob], 2017)).toBe("true");
    expect(ask(pos, "63(c)(5)", [bob], 2017, 500)).toBe("true");
    expect(ask(pos, "63(c)(2)", [bob], 2017, 3000)).toBe("true");
    expect(ask(pos, "63(c)(1)", [bob], 2017, 500)).toBe("true");
    const neg = kbWith([
      paid2017,
      wed2017,
      income(bob, 2017, 10),
      separate_return.undated({ person: alice }),
      separate_return.undated({ person: bob }),
    ]);
    neg.denies(deduction_151c.undated({ taxpayer: alice, dependent: bob }));
    expect(ask(neg, "63(c)(5)", [bob], 2017)).toBe("false");
  });

  test("§63(c)(6)(A): married filing separately where a spouse itemizes", () => {
    // s63_c_6_A_*
    const pos = kbWith([
      paid2017,
      wed2017,
      stated_amount.undated({ person: bob, kind: "itemized_deduction", amount: 4324 }),
      separate_return.undated({ person: alice }),
      separate_return.undated({ person: bob }),
    ]);
    expect(ask(pos, "63(c)(6)(A)", [alice], 2017)).toBe("true");
    expect(ask(pos, "63(c)(1)", [alice], 2017, 0)).toBe("true");
    const neg = kbWith([
      paid2017,
      wed2017,
      joint_return.inYear({ person: alice, year: 2017n }),
      joint_return.inYear({ person: bob, year: 2017n }),
    ]);
    expect(ask(neg, "63(c)(6)(A)", [alice], 2017)).toBe("false");
  });

  test("§63(d) and (d)(2): which deductions are itemized", () => {
    // s63_d_*, s63_d_2_*
    const charity = stated_amount.inYear({
      person: alice,
      kind: "itemized_deduction",
      amount: 1200,
      year: 2017n,
    });
    const personal = stated_amount.inYear({
      person: alice,
      kind: "exemption_151",
      amount: 2000,
      year: 2017n,
    });
    const additional = stated_amount.inYear({
      person: alice,
      kind: "additional_standard_deduction_63c3",
      amount: 1200,
      year: 2017n,
    });
    expect(ask(kbWith([paid2017, charity]), "63(d)", [alice], 2017)).toBe("true");
    expect(ask(kbWith([paid2017, personal]), "63(d)", [alice], 2017)).toBe("false");
    expect(ask(kbWith([paid2017, personal]), "63(d)(2)", [alice], 2017)).toBe("true");
    expect(ask(kbWith([paid2017, additional]), "63(d)(2)", [alice], 2017)).toBe("false");
  });

  test("§63(f): aged and blind, with the higher amount for the unmarried", () => {
    // s63_f_1_B_*, s63_f_2_A_*, s63_f_3_*
    const births = [
      born({ person: alice, day: d("1950-03-02") }),
      born({ person: bob, day: d("1955-03-03") }),
    ];
    const pos = kbWith([
      paid2017,
      wed2017,
      ...births,
      exemption_151b.inYear({ taxpayer: bob, spouse: alice, year: 2017n }),
    ]);
    expect(ask(pos, "63(f)(1)(B)", [bob, alice], 2017)).toBe("true");
    expect(ask(pos, "63(c)(3)", [bob], 2017, 600)).toBe("true");
    const neg = kbWith([
      paid2017,
      wed2017,
      ...births,
      exemption_151b.inYear({ taxpayer: alice, spouse: bob, year: 2017n }),
    ]);
    expect(ask(neg, "63(f)(1)(B)", [alice, bob], 2017)).toBe("false");
    expect(ask(neg, "63(f)(1)(A)", [alice], 2017)).toBe("true");
    expect(ask(neg, "63(f)(1)(A)", [bob], 2017)).toBe("false");
    const blindAlice = kbWith([
      paid2017,
      wed2017,
      blind.since({ person: alice, day: d("2016-03-20") }),
    ]);
    expect(ask(blindAlice, "63(f)(2)(A)", [alice], 2017)).toBe("true");
    expect(ask(blindAlice, "63(f)(2)(A)", [bob], 2017)).toBe("false");
    const single = kbWith([paid2017, ...births]);
    expect(ask(single, "63(f)(3)", [alice], 2017, 750)).toBe("true");
    expect(ask(single, "63(f)(3)", [alice], 2017, 600)).toBe("false");
    expect(ask(single, "63(c)(3)", [alice], 2017, 750)).toBe("true");
    expect(ask(single, "63(f)(3)", [bob], 2017, 0)).toBe("true");
  });

  test("§63(a) and (b): taxable income with and without itemizing", () => {
    // s63_a_*
    const pos = kbWith([
      paid2017,
      stated_amount.inYear({ person: alice, kind: "exemption_151", amount: 2000, year: 2017n }),
      stated_amount.inYear({
        person: alice,
        kind: "itemized_deduction",
        amount: 4252,
        year: 2017n,
      }),
    ]);
    expect(ask(pos, "63(a)", [alice], 2017, 26_948)).toBe("true");
    expect(ask(pos, "63", [alice], 2017, 26_948)).toBe("true");
    const neg = kbWith([
      paid2017,
      stated_amount.inYear({
        person: alice,
        kind: "standard_deduction_63c",
        amount: 2000,
        year: 2017n,
      }),
      stated_amount.inYear({ person: alice, kind: "exemption_151", amount: 4000, year: 2017n }),
    ]);
    expect(ask(neg, "63(a)", [alice], 2017, 31_200)).toBe("false");
    expect(ask(neg, "63(a)", [alice], 2017, 29_200)).toBe("true");
    expect(ask(neg, "63(b)", [alice], 2017, 27_200)).toBe("true");
    expect(ask(neg, "63", [alice], 2017, 27_200)).toBe("true");
    // Nothing stated but the pay: the derived standard deduction of $3,000 and the $2,000
    // exemption apply.
    expect(ask(kbWith([paid2017]), "63", [alice], 2017, 28_200)).toBe("true");
  });

  test("§1: the schedules and their brackets, rounded to whole dollars", () => {
    // s1_a_1_*, s1_a_2_*, s1_b_*, s1_c_*, s1_d_*
    const taxable = (amount: number): GroundAtom =>
      taxable_income({ person: alice, year: 2017n, amount });
    const joint = (amount: number): KnowledgeBase =>
      kbWith([
        married_stated.inYear({ person: alice, year: 2017n }),
        joint_return.inYear({ person: alice, year: 2017n }),
        taxable(amount),
      ]);
    expect(ask(joint(17_330), "1(a)(i)", [alice], 2017, 2600)).toBe("true");
    expect(ask(joint(17_330), "1(a)", [alice], 2017, 2600)).toBe("true");
    expect(ask(joint(17_330), "1(a)(v)", [alice], 2017, 2600)).toBe("false");
    expect(ask(joint(42_876), "1(a)(i)", [alice], 2017, 7208)).toBe("false");
    expect(ask(joint(42_876), "1(a)(ii)", [alice], 2017, 7208)).toBe("true");
    expect(ask(joint(103_272), "1(a)(iii)", [alice], 2017, 24_543)).toBe("true");
    expect(ask(joint(164_612), "1(a)(iv)", [alice], 2017, 44_789)).toBe("true");
    expect(ask(joint(684_642), "1(a)(v)", [alice], 2017, 247_647)).toBe("true");
    const survivor = (amount: number): KnowledgeBase =>
      kbWith([surviving_spouse_stated.inYear({ person: alice, year: 2017n }), taxable(amount)]);
    expect(ask(survivor(25_561), "1(a)(i)", [alice], 2017, 3834)).toBe("true");
    expect(ask(survivor(95_129), "1(a)(iii)", [alice], 2017, 22_018)).toBe("true");
    const head = (amount: number): KnowledgeBase =>
      kbWith([head_of_household_stated.inYear({ person: alice, year: 2017n }), taxable(amount)]);
    expect(ask(head(97_407), "1(a)", [alice], 2017, 24_056)).toBe("false");
    expect(ask(head(54_775), "1(b)(ii)", [alice], 2017, 11_489)).toBe("true");
    expect(ask(head(97_407), "1(b)(iii)", [alice], 2017, 24_056)).toBe("true");
    expect(ask(head(194_512), "1(b)(iv)", [alice], 2017, 57_509)).toBe("true");
    expect(ask(head(1_172_980), "1(b)(v)", [alice], 2017, 442_985)).toBe("true");
    const single = (amount: number): KnowledgeBase => kbWith([taxable(amount)]);
    expect(ask(single(7748), "1(c)(i)", [alice], 2017, 1162)).toBe("true");
    expect(ask(single(22_895), "1(c)(ii)", [alice], 2017, 3538)).toBe("true");
    expect(ask(single(210_204), "1(c)(iv)", [alice], 2017, 65_445)).toBe("true");
    expect(ask(single(718_791), "1(c)(v)", [alice], 2017, 265_413)).toBe("true");
    expect(ask(single(718_791), "1(c)(i)", [alice], 2017, 265_413)).toBe("false");
    const separate = (amount: number): KnowledgeBase =>
      kbWith([
        married_stated.inYear({ person: alice, year: 2017n }),
        separate_return.undated({ person: alice }),
        taxable(amount),
      ]);
    expect(ask(separate(67_285), "1(d)(iii)", [alice], 2017, 17_123)).toBe("true");
    expect(ask(separate(113_580), "1(d)(iv)", [alice], 2017, 33_653)).toBe("true");
    expect(ask(separate(554_313), "1(d)(v)", [alice], 2017, 207_772)).toBe("true");
    expect(ask(separate(554_313), "1(d)(v)", [alice], 2017, 20_772)).toBe("false");
    expect(ask(separate(554_313), "1", [alice], 2017, 207_772)).toBe("true");
  });
});

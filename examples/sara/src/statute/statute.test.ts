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
  born,
  child_of,
  deduction_151c,
  dependent_152,
  died,
  gross_income,
  home_cost_share,
  joint_return,
  legally_separated,
  maintains_home,
  married_on,
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
  stepchild_of,
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
): string {
  const provision = PROVISIONS.find((entry) => entry.citation === citation);
  if (provision === undefined) {
    throw new Error(`No provision ${citation}`);
  }
  return query(kb, provisionAtom(provision, people, year === undefined ? undefined : BigInt(year)))
    .value;
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
    // Without both dates of birth the age test is not met: see §152(d)(1) for the
    // qualifying relative such a child may still be.
    const undated = kbWith([child_of({ child: bob, parent: alice })]);
    expect(ask(undated, "152(c)(3)", [bob, alice], 2019)).toBe("false");
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
    ]);
    expect(ask(friend, "2(b)(3)(B)", [bob, charlie], 2018)).toBe("true");
    expect(ask(friend, "2(b)", [bob], 2018)).toBe("false");
    expect(ask(kbWith([...bobHome, ...fatherCharlie]), "2(b)(3)(B)", [bob, charlie], 2018)).toBe(
      "false",
    );
  });

  test("§152(b)(1): a dependent has no dependents", () => {
    const chain = kbWith([
      child_of({ child: bob, parent: alice }),
      child_of({ child: charlie, parent: bob }),
      qualifying_child_152c.inYear({ child: bob, taxpayer: alice, year: 2015n }),
      qualifying_child_152c.inYear({ child: charlie, taxpayer: bob, year: 2015n }),
    ]);
    expect(ask(chain, "152(b)(1)", [bob], 2015)).toBe("true");
    expect(ask(chain, "152(b)(1)", [alice], 2015)).toBe("false");
    expect(ask(chain, "151(c)", [bob, charlie], 2015)).toBe("false");
    expect(ask(chain, "151(c)", [alice, bob], 2015)).toBe("true");
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
    expect(ask(kbWith([]), "152(d)(1)(B)", [alice], 2015)).toBe("true");
    expect(
      ask(
        kbWith([gross_income({ person: alice, year: 2015n, amount: 2312 })]),
        "152(d)(1)(B)",
        [alice],
        2015,
      ),
    ).toBe("false");
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

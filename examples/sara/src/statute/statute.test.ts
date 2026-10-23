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
  died,
  legally_separated,
  married_on,
  married_undated,
  nonresident_alien,
  nonresident_alien_since,
  nonresident_alien_until,
  Person,
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
    const undated = kbWith([child_of({ child: bob, parent: alice })]);
    expect(ask(undated, "152(c)(3)", [bob, alice], 2019)).toBe("true");
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

/**
 * Gold facts for the extraction probe, read off eleven long train texts by hand on
 * 2026-10-22, in the vocabulary of `schema.ts`. Each case lists the facts the text states
 * (`gold`), facts that are harmless but not required (`tolerated`: the per-year form of a
 * state the text dates to the day, and `employed_in` beside a list of days), and denials
 * the text makes outright (`denials`). Symmetric predicates match in either order.
 */

export type GoldFields = Readonly<Record<string, string>>;

export type GoldCase = Readonly<{
  gold: ReadonlySet<string>;
  tolerated: ReadonlySet<string>;
  denials: ReadonlySet<string>;
}>;

const SYMMETRIC = new Set([
  "married_on",
  "married_undated",
  "sibling_of",
  "shares_home",
  "shares_home_in",
  "shares_home_since",
  "shares_home_until",
  "joint_return",
  "joint_return_in",
]);

/** Canonical text for a fact: fields sorted by name, symmetric pairs sorted by value. */
export function factKey(predicate: string, fields: GoldFields): string {
  const entries = { ...fields };
  if (SYMMETRIC.has(predicate) && entries["a"] !== undefined && entries["b"] !== undefined) {
    const [first, second] = [entries["a"], entries["b"]].sort();
    entries["a"] = first ?? "";
    entries["b"] = second ?? "";
  }
  const body = Object.keys(entries)
    .sort()
    .map((name) => `${name}=${entries[name] ?? ""}`)
    .join(" ");
  return `${predicate}(${body})`;
}

type Bucket = "gold" | "tolerated" | "denials";

class Builder {
  readonly cases = new Map<
    string,
    { gold: Set<string>; tolerated: Set<string>; denials: Set<string> }
  >();

  add(id: string, predicate: string, fields: GoldFields, bucket: Bucket = "gold"): void {
    let entry = this.cases.get(id);
    if (entry === undefined) {
      entry = { gold: new Set(), tolerated: new Set(), denials: new Set() };
      this.cases.set(id, entry);
    }
    entry[bucket].add(factKey(predicate, fields));
  }

  perYear(
    id: string,
    predicate: string,
    fields: GoldFields,
    from: number,
    to: number,
    bucket: Bucket = "gold",
  ): void {
    for (let year = from; year <= to; year += 1) {
      this.add(id, predicate, { ...fields, year: String(year) }, bucket);
    }
  }

  marriage(id: string, a: string, b: string, day: string): void {
    this.add(id, "married_on", { a, b, day });
  }

  parents(id: string, child: string, ...parentNames: readonly string[]): void {
    for (const parent of parentNames) {
      this.add(id, "child_of", { child, parent });
    }
  }
}

export function probeGold(): ReadonlyMap<string, GoldCase> {
  const g = new Builder();
  {
    const id = "s7703_b_3_neg";
    g.marriage(id, "Alice", "Bob", "2012-04-05");
    g.add(id, "born", { person: "Charlie", day: "2017-09-16" });
    g.parents(id, "Charlie", "Alice", "Bob");
    g.add(id, "shares_home_since", { a: "Alice", b: "Charlie", day: "2017-09-16" });
    g.add(id, "maintains_home_since", { person: "Alice", day: "2017-09-16" });
    g.perYear(id, "deduction_151c_in", { taxpayer: "Alice", dependent: "Charlie" }, 2017, 2019);
    g.add(id, "shares_home_since", { a: "Bob", b: "Alice", day: "2017-09-16" });
    g.add(id, "shares_home_since", { a: "Bob", b: "Charlie", day: "2017-09-16" });
    g.add(id, "shares_home_until", { a: "Bob", b: "Alice", day: "2018-10-10" });
    g.add(id, "shares_home_until", { a: "Bob", b: "Charlie", day: "2018-10-10" });
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Charlie" }, 2017, 2019, "tolerated");
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Bob" }, 2017, 2018, "tolerated");
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2017, 2018, "tolerated");
    g.perYear(id, "maintains_home_in", { person: "Alice" }, 2017, 2019, "tolerated");
  }
  {
    const id = "s7703_b_1_neg";
    g.marriage(id, "Alice", "Bob", "2012-04-05");
    g.add(id, "born", { person: "Charlie", day: "2017-09-16" });
    g.parents(id, "Charlie", "Alice", "Bob");
    g.add(id, "shares_home_since", { a: "Alice", b: "Charlie", day: "2017-09-16" });
    g.add(id, "maintains_home_since", { person: "Alice", day: "2017-09-16" });
    g.perYear(id, "deduction_151c_in", { taxpayer: "Alice", dependent: "Charlie" }, 2017, 2019);
    g.perYear(id, "joint_return_in", { a: "Alice", b: "Bob" }, 2017, 2019);
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Charlie" }, 2017, 2019, "tolerated");
    g.perYear(id, "maintains_home_in", { person: "Alice" }, 2017, 2019, "tolerated");
  }
  {
    const id = "s2_b_1_B_neg";
    g.marriage(id, "Alice", "Bob", "1992-02-03");
    g.parents(id, "Charlie", "Alice", "Bob");
    g.add(id, "born", { person: "Charlie", day: "2000-10-09" });
    g.add(id, "died", { person: "Alice", day: "2014-07-09" });
    g.perYear(id, "maintains_home_in", { person: "Bob" }, 2004, 2019);
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2004, 2019);
    g.perYear(id, "deduction_151c_in", { taxpayer: "Bob", dependent: "Charlie" }, 2015, 2019);
  }
  {
    const id = "s2_b_3_B_pos";
    g.marriage(id, "Alice", "Bob", "1992-02-03");
    g.add(id, "died", { person: "Alice", day: "2014-07-09" });
    g.perYear(id, "maintains_home_in", { person: "Bob" }, 2015, 2019);
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2015, 2019);
    g.perYear(id, "dependent_152_in", { dependent: "Charlie", taxpayer: "Bob" }, 2015, 2019);
    g.perYear(id, "gross_income", { person: "Bob", amount: "300000" }, 2015, 2019);
  }
  {
    const id = "s2_b_1_A_neg";
    g.marriage(id, "Alice", "Bob", "1992-02-03");
    g.parents(id, "Charlie", "Alice", "Bob");
    g.add(id, "born", { person: "Charlie", day: "2000-10-09" });
    g.add(id, "died", { person: "Alice", day: "2014-07-09" });
    g.perYear(id, "maintains_home_in", { person: "Bob" }, 2004, 2019);
    g.add(id, "home_cost_share", { person: "Bob", percent: "40" });
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2004, 2019);
    g.add(id, "dependent_152", { dependent: "Charlie", taxpayer: "Bob" }, "denials");
  }
  {
    const id = "s2_b_1_B_pos";
    g.marriage(id, "Alice", "Bob", "1992-02-03");
    g.add(id, "died", { person: "Alice", day: "2014-07-09" });
    g.perYear(id, "maintains_home_in", { person: "Bob" }, 2004, 2019);
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2004, 2019);
    g.add(id, "child_of", { child: "Bob", parent: "Charlie" });
    g.perYear(id, "deduction_151c_in", { taxpayer: "Bob", dependent: "Charlie" }, 2015, 2019);
  }
  {
    const id = "s3306_b_10_B_neg";
    g.add(id, "employed_since", { employer: "Alice", employee: "Bob", day: "2011-01-02" });
    g.add(id, "employed_until", { employer: "Alice", employee: "Bob", day: "2019-10-10" });
    g.add(id, "disabled_since", { person: "Bob", day: "2019-10-10" });
    g.add(id, "retired_since", { person: "Bob", day: "2019-10-10" });
    g.add(id, "paid", { payer: "Alice", payee: "Bob", amount: "12980" });
    g.add(id, "has_disability_plan", { employer: "Alice" }, "denials");
  }
  {
    const id = "s152_c_1_pos";
    g.add(id, "child_of", { child: "Bob", parent: "Alice" });
    g.add(id, "shares_home_since", { a: "Alice", b: "Bob", day: "2015-09-01" });
    g.add(id, "shares_home_until", { a: "Alice", b: "Bob", day: "2019-11-03" });
    g.marriage(id, "Bob", "Charlie", "2018-10-23");
    g.perYear(id, "satisfies_152c2_in", { child: "Bob", taxpayer: "Alice" }, 2015, 2020);
    g.perYear(id, "satisfies_152c3_in", { child: "Bob", taxpayer: "Alice" }, 2015, 2020);
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Bob" }, 2015, 2019, "tolerated");
  }
  {
    const id = "s63_f_1_B_neg";
    g.add(id, "gross_income", { person: "Alice", year: "2017", amount: "33200" });
    g.marriage(id, "Alice", "Bob", "2017-02-03");
    g.add(id, "born", { person: "Alice", day: "1950-03-02" });
    g.add(id, "born", { person: "Bob", day: "1955-03-03" });
    g.add(id, "exemption_151b_in", { taxpayer: "Alice", spouse: "Bob", year: "2017" });
  }
  {
    const id = "tax_case_21";
    g.marriage(id, "Alice", "Bob", "1992-02-03");
    g.parents(id, "Charlie", "Alice", "Bob");
    g.add(id, "born", { person: "Charlie", day: "2000-10-09" });
    g.perYear(id, "maintains_home_in", { person: "Bob" }, 2004, 2019);
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Bob" }, 2004, 2019);
    g.perYear(id, "shares_home_in", { a: "Alice", b: "Charlie" }, 2004, 2019);
    g.perYear(id, "shares_home_in", { a: "Bob", b: "Charlie" }, 2004, 2019);
    g.marriage(id, "Charlie", "Dan", "2018-02-14");
    g.add(id, "separate_return_in", { person: "Charlie", year: "2018" });
    g.add(id, "separate_return_in", { person: "Dan", year: "2018" });
    g.add(id, "gross_income", { person: "Alice", year: "2018", amount: "54232" });
    g.add(id, "gross_income", { person: "Bob", year: "2018", amount: "43245" });
    g.add(id, "joint_return_in", { a: "Alice", b: "Bob", year: "2018" });
  }
  {
    const id = "s3306_a_2_B_neg";
    const names: Readonly<Record<string, string>> = {
      B: "Bob",
      C: "Cameron",
      D: "Dan",
      E: "Emily",
      F: "Fred",
      G: "George",
    };
    const days: readonly (readonly [string, string])[] = [
      ["2017-01-24", "BCDEF"],
      ["2017-02-04", "BCF"],
      ["2017-03-03", "BCDEF"],
      ["2017-03-19", "CDEFG"],
      ["2017-04-02", "BCDFG"],
      ["2017-05-09", "CDEFG"],
      ["2017-10-15", "BCDEG"],
      ["2017-10-25", "BEFG"],
      ["2017-11-08", "BCEFG"],
      ["2017-11-22", "BCDEF"],
      ["2017-12-01", "BCDEG"],
      ["2017-12-03", "BCDEG"],
    ];
    for (const [day, initials] of days) {
      for (const initial of initials) {
        g.add(id, "employed_on", { employer: "Alice", employee: names[initial] ?? "", day });
      }
    }
    for (const employee of Object.values(names)) {
      g.add(id, "agricultural_labor", { employer: "Alice", employee });
      g.add(id, "employed_in", { employer: "Alice", employee, year: "2017" }, "tolerated");
    }
  }
  return g.cases;
}

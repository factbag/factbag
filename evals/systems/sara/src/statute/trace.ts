/**
 * Trace a saved case: rebuild its facts and print what the statute's intermediate
 * predicates make of them, for every person and the case's year, so a wrong answer can be
 * laid at the extraction's door or at a rule's. No API is involved.
 *
 * Usage: pnpm --filter @factbag/sara-systems trace --facts results/<run>.jsonl --case tax_case_12
 *        [--year 2020]
 */
import { parseArgs } from "node:util";
import type { PredicateDeclaration } from "factbag/dsl";
import { variable } from "factbag/dsl";
import { queryAll } from "factbag/dsl";
import { renderFields } from "./record";
import { readRecords, rebuild } from "./saved";
import { Person } from "./schema";
import { gross_income_of, itemized_total, itemizes } from "./helpers";
import { s1_tax } from "./s1";
import { exemption_amount, s151_a, s151_c } from "./s151";
import { dependent_of } from "./s152";
import { head_of_household, surviving_spouse } from "./s2";
import { s3301, s3306_a, s3306_b, total_wages } from "./s3306";
import { s151_return, s63_a, s63_b, s63_c, taxable_income_of } from "./s63";
import { itemized_after_68 } from "./s68";
import { agi, joint_spouse, married_7703 } from "./s7703";

const { values: args } = parseArgs({
  options: {
    facts: { type: "string" },
    case: { type: "string" },
    year: { type: "string" },
  },
});
if (args.facts === undefined || args.case === undefined) {
  throw new Error("Pass --facts results/<run>.jsonl --case <id>");
}
const record = readRecords(args.facts).find((entry) => entry.id === args.case);
if (record === undefined) {
  throw new Error(`No record ${args.case} in ${args.facts}`);
}
const { detail } = record;
if (detail === undefined) {
  throw new Error(`Case ${args.case} threw, so the run saved no facts for it`);
}
const yearText = args.year ?? detail.atom?.fields["year"];
const year = yearText === undefined ? undefined : Number(yearText);
if (year === undefined) {
  throw new Error("Pass --year: the record names none");
}
const { kb, people } = rebuild(detail);

const TRACED: readonly PredicateDeclaration[] = [
  married_7703,
  joint_spouse,
  surviving_spouse,
  head_of_household,
  dependent_of,
  s151_c,
  gross_income_of,
  agi,
  exemption_amount,
  s151_a,
  s151_return,
  itemizes,
  itemized_total,
  itemized_after_68,
  s63_c,
  s63_a,
  s63_b,
  taxable_income_of,
  s1_tax,
  s3306_a,
  s3306_b,
  total_wages,
  s3301,
];

process.stdout.write(
  `${record.id}: gold ${record.gold}, answered ${record.answer ?? "none"}, year ${year}\n`,
);
for (const fact of detail.facts) {
  if (fact.sign === "+") {
    process.stdout.write(`  + ${fact.predicate} ${JSON.stringify(fact.fields)}\n`);
  }
}
for (const person of people.values()) {
  process.stdout.write(`-- ${person.id}\n`);
  for (const predicate of TRACED) {
    const fields: Record<string, unknown> = {};
    let first = true;
    for (const [name, type] of Object.entries(predicate.params)) {
      if (type === Person && first) {
        fields[name] = person;
        first = false;
      } else if (type === Number) {
        fields[name] = year;
      } else {
        fields[name] = variable(name);
      }
    }
    const rows = queryAll(kb, { predicate, fields })
      .filter((judgment) => judgment.value === "true")
      .map((judgment) => {
        const rendered = renderFields(judgment.goal.atom.fields);
        return Object.entries(rendered)
          .filter(([name]) => name !== "year" && rendered[name] !== person.id)
          .map(([name, value]) => `${name}=${value}`)
          .join(" ");
      });
    process.stdout.write(`  ${predicate.name}: ${rows.length === 0 ? "-" : rows.join(" | ")}\n`);
  }
}

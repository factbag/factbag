/**
 * Saved runs: the JSONL records `eval` writes, and the knowledge base their facts rebuild,
 * so a run can be re-solved or traced without the API.
 */
import { readFileSync } from "node:fs";
import type { GroundAtom, PredicateDeclaration } from "factbag/dsl";
import type { KnowledgeBase } from "factbag/kb";
import type { CaseRecord } from "@factbag/eval-runner";
import { day } from "./day";
import { FACT_PREDICATES, Person } from "./schema";
import { PROVISIONS, statuteKB } from "./index";
import type { FactbagDetail } from "./record";

/** One case of a run of the Factbag system. A case that threw has no detail. */
export type SavedRecord = Omit<CaseRecord, "detail"> & Readonly<{ detail?: FactbagDetail }>;

/** The records of a run the Factbag system saved. */
export function readRecords(file: string): readonly SavedRecord[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line, index) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Written by `run` from the system's own detail.
      const record = JSON.parse(line) as SavedRecord;
      if (typeof record.id !== "string" || typeof record.gold !== "string") {
        throw new Error(`Not a run record at ${file}:${index + 1}`);
      }
      return record;
    });
}

const byName = new Map<string, PredicateDeclaration>();
for (const declaration of FACT_PREDICATES) {
  byName.set(declaration.name, declaration);
}
for (const provision of PROVISIONS) {
  for (const declaration of [provision.predicate, provision.valued]) {
    if (declaration !== undefined) {
      byName.set(declaration.name, declaration);
    }
  }
}

/** Parse a rendered field back by the predicate's declared type. */
function parseField(
  declaration: PredicateDeclaration,
  name: string,
  text: string,
  people: ReadonlyMap<string, Person>,
): unknown {
  const type = declaration.params[name];
  if (type === Person) {
    const person = people.get(text);
    if (person === undefined) {
      throw new Error(`Unknown person ${text} in ${declaration.name}`);
    }
    return person;
  }
  if (type === Date) {
    return day(text);
  }
  if (type === Number) {
    return Number(text);
  }
  if (type === Boolean) {
    return text === "true";
  }
  return text;
}

/** A rendered atom as a ground atom over the run's people. */
export function toAtom(
  predicate: string,
  fields: Record<string, string>,
  people: ReadonlyMap<string, Person>,
): GroundAtom {
  const declaration = byName.get(predicate);
  if (declaration === undefined) {
    throw new Error(`Unknown predicate ${predicate}`);
  }
  const parsed: Record<string, unknown> = {};
  for (const [name, text] of Object.entries(fields)) {
    parsed[name] = parseField(declaration, name, text, people);
  }
  return { predicate: declaration, fields: parsed };
}

/** The statute with a case's facts asserted and denied, and its people by name. */
export function rebuild(detail: FactbagDetail): {
  kb: KnowledgeBase;
  people: ReadonlyMap<string, Person>;
} {
  const people = new Map(detail.people.map((name) => [name, new Person(name)]));
  const kb = statuteKB();
  kb.entities.add(...people.values());
  for (const fact of detail.facts) {
    // A run saved under an older vocabulary may hold predicates that are gone.
    if (!byName.has(fact.predicate)) {
      continue;
    }
    const atom = toAtom(fact.predicate, fact.fields, people);
    if (fact.sign === "+") {
      kb.asserts(atom);
    } else {
      kb.denies(atom);
    }
  }
  return { kb, people };
}

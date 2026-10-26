/**
 * Saved runs: the JSONL records `eval` writes, and the knowledge base their facts rebuild,
 * so a run can be re-solved or traced without the API.
 */
import { readFileSync } from "node:fs";
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { day } from "./calendar";
import { FACT_PREDICATES, Person } from "./schema";
import { PROVISIONS, statuteKB, TAX_QUESTION } from "./statute";

export type SavedFact = Readonly<{
  sign: string;
  predicate: string;
  fields: Record<string, string>;
}>;

export type SavedRecord = Readonly<{
  id: string;
  citation: string | undefined;
  gold: string;
  predicted: string | undefined;
  value: string;
  atom?: Readonly<{ predicate: string; fields: Record<string, string> }>;
  open?: true;
  people?: readonly string[];
  facts?: readonly SavedFact[];
}>;

function isSavedRecord(value: unknown): value is SavedRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { gold?: unknown }).gold === "string"
  );
}

/** The records of a saved run. */
export function readRecords(file: string): readonly SavedRecord[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line): unknown => JSON.parse(line))
    .filter(isSavedRecord);
}

const byName = new Map<string, PredicateDeclaration>();
for (const declaration of FACT_PREDICATES) {
  byName.set(declaration.name, declaration);
}
for (const provision of [...PROVISIONS, TAX_QUESTION]) {
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

/** The statute with a record's facts asserted and denied, and its people by name. */
export function rebuild(record: SavedRecord): {
  kb: KnowledgeBase;
  people: ReadonlyMap<string, Person>;
} {
  const people = new Map((record.people ?? []).map((name) => [name, new Person(name)]));
  const kb = statuteKB();
  kb.entities.add(...people.values());
  for (const fact of record.facts ?? []) {
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

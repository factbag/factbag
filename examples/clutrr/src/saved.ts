/**
 * Saved runs: the JSONL records `eval` writes, and the knowledge base their facts rebuild,
 * so a run can be re-solved under changed rules without the API.
 */
import { readFileSync } from "node:fs";
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import { kinshipKB } from "./kinship";
import { FACT_PREDICATES, Person } from "./schema";

export type SavedFact = Readonly<{
  sign: string;
  predicate: string;
  fields: Record<string, string>;
  /** The classifier's probability for the admitted sign, when the run recorded it. */
  probability?: number;
}>;

export type SavedRecord = Readonly<{
  id: string;
  file: string;
  length: number;
  query: readonly [string, string];
  gold: string;
  predicted: string | undefined;
  failure?: string;
  people?: readonly string[];
  facts?: readonly SavedFact[];
}>;

function isSavedRecord(value: unknown): value is SavedRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { gold?: unknown }).gold === "string" &&
    Array.isArray((value as { query?: unknown }).query)
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

const byName = new Map<string, PredicateDeclaration>(
  FACT_PREDICATES.map((declaration) => [declaration.name, declaration]),
);

/** A rendered atom as a ground atom over the run's people. */
function toAtom(
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
    if (declaration.params[name] === Person) {
      const person = people.get(text);
      if (person === undefined) {
        throw new Error(`Unknown person ${text} in ${predicate}`);
      }
      parsed[name] = person;
    } else {
      parsed[name] = text;
    }
  }
  return { predicate: declaration, fields: parsed };
}

/**
 * The rules with a record's facts asserted and denied, and its people by name. With a
 * `source`, every literal carries it as its provenance, so a resolver can find the passage
 * the facts came from; the saved probability travels with it.
 */
export function rebuild(
  record: SavedRecord,
  options: Readonly<{ source?: string }> = {},
): {
  kb: KnowledgeBase;
  people: ReadonlyMap<string, Person>;
} {
  const people = new Map((record.people ?? []).map((name) => [name, new Person(name)]));
  const kb = kinshipKB();
  kb.entities.add(...people.values());
  for (const fact of record.facts ?? []) {
    // A run saved under an older vocabulary may hold predicates that are gone.
    if (!byName.has(fact.predicate)) {
      continue;
    }
    const atom = toAtom(fact.predicate, fact.fields, people);
    const metadata =
      options.source === undefined
        ? undefined
        : {
            source: options.source,
            ...(fact.probability === undefined
              ? {}
              : { scores: { probability: fact.probability } }),
          };
    if (fact.sign === "+") {
      kb.asserts(atom, metadata);
    } else {
      kb.denies(atom, metadata);
    }
  }
  return { kb, people };
}

/**
 * What a system that lets the statute decide keeps of a case in the run's record: enough
 * to re-solve the case with no requests, whichever model read it.
 */
import type { SaraLabel } from "@factbag/sara-benchmark";

/** An atom as a run's record keeps it; `renderFields` writes the fields. */
type SavedAtom = Readonly<{ predicate: string; fields: Record<string, string> }>;

/** What the system keeps of a case in the run's record, enough to re-solve it with no requests. */
export type FactbagDetail = Readonly<{
  /** Every person the text names. */
  people: readonly string[];
  /** Every admitted fact, asserted ("+") or denied ("-"). */
  facts: readonly (SavedAtom & Readonly<{ sign: string }>)[];
  /** The question reading's probability: 1 when only one reading was possible. */
  reading: number;
  /** Why the question went unread, when it did; there is then no atom. */
  unread?: string;
  atom?: SavedAtom;
  /** What the statute made of the atom. */
  value?: string;
  solverMs?: number;
}>;

/** True is Entailment, false Contradiction, and anything else no answer. */
export function labelOf(value: string): SaraLabel | undefined {
  return value === "true" ? "Entailment" : value === "false" ? "Contradiction" : undefined;
}

/** Render an atom's fields for logs and results: entity ids, ISO days, decimal numbers. */
export function renderFields(fields: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, renderValue(value)]),
  );
}

function renderValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    return String(value.id);
  }
  return JSON.stringify(value);
}

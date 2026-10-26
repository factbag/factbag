/** Compare two saved runs on exactly the same cases, without API calls or dataset access. */
import { parseArgs } from "node:util";
import { readRecords } from "./saved";
import type { SavedFact, SavedRecord } from "./saved";

const { values } = parseArgs({
  options: {
    baseline: { type: "string" },
    candidate: { type: "string" },
  },
});
if (values.baseline === undefined || values.candidate === undefined) {
  throw new Error("Supply --baseline <jsonl> and --candidate <jsonl>");
}
const baseline = readRecords(values.baseline);
const candidate = readRecords(values.candidate);
const indexed = new Map(candidate.map((record) => [record.id, record]));
if (
  baseline.length !== candidate.length ||
  indexed.size !== candidate.length ||
  new Set(baseline.map((record) => record.id)).size !== baseline.length ||
  baseline.some((record) => !indexed.has(record.id))
) {
  throw new Error("Runs must contain exactly the same case IDs, without duplicates");
}
function factKey(fact: SavedFact): string {
  return JSON.stringify([
    fact.sign,
    fact.predicate,
    Object.entries(fact.fields).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
function keys(record: SavedRecord): Set<string> {
  return new Set((record.facts ?? []).map(factKey));
}
const paired = { bothCorrect: 0, baselineOnly: 0, candidateOnly: 0, neitherCorrect: 0 };
const differences = baseline.map((before) => {
  const after = indexed.get(before.id);
  if (after === undefined || after.gold !== before.gold) {
    throw new Error(`Gold mismatch: ${before.id}`);
  }
  const a = before.predicted === before.gold;
  const b = after.predicted === after.gold;
  paired[a ? (b ? "bothCorrect" : "baselineOnly") : b ? "candidateOnly" : "neitherCorrect"]++;
  const beforeFacts = keys(before);
  const afterFacts = keys(after);
  return {
    id: before.id,
    answerChanged: before.predicted !== after.predicted,
    baseline: before.predicted ?? null,
    candidate: after.predicted ?? null,
    removedFacts: (before.facts ?? []).filter((f) => !afterFacts.has(factKey(f))),
    addedFacts: (after.facts ?? []).filter((f) => !beforeFacts.has(factKey(f))),
  };
});
process.stdout.write(
  `${JSON.stringify(
    {
      baseline: values.baseline,
      candidate: values.candidate,
      cases: baseline.length,
      paired,
      answerChanges: differences.filter((d) => d.answerChanged).length,
      removedFacts: differences.reduce((sum, d) => sum + d.removedFacts.length, 0),
      addedFacts: differences.reduce((sum, d) => sum + d.addedFacts.length, 0),
      caveat:
        "Saved facts are not gold annotations. Differences combine routing effects and classification variation.",
      differences: differences.filter(
        (d) => d.answerChanged || d.removedFacts.length > 0 || d.addedFacts.length > 0,
      ),
    },
    null,
    2,
  )}\n`,
);

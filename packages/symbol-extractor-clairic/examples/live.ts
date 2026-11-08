/**
 * A live check of Clairic on Workers AI through the REST API, then of classification with
 * Clef over the values Clairic offers. The passage records one payment; the check expects
 * Clairic to offer its payer, payee, amount, and date, and Clef to assert that payment.
 *
 * Usage: pnpm --filter @factbag/symbol-extractor-clairic live
 */
import { predicate, query } from "factbag/dsl";
import { KnowledgeBase, guard } from "factbag/kb";
import { Corpus } from "factbag/corpus";
import { classifier } from "@factbag/clef";
import { createChunkSymbolExtractor } from "../src/index";
import type { SymbolExtractorConfig } from "../src/index";

const missing = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"].filter(
  (name) => (process.env[name] ?? "") === "",
);
if (missing.length > 0) {
  process.stderr.write(`Set ${missing.join(" and ")} in your shell.\n`);
  process.exit(1);
}

class Person {
  constructor(readonly id: string) {}
}
const paid = predicate(
  "paid",
  { payer: Person, payee: String, amount: Number, on: Date },
  {
    description: "The payer paid the payee the amount, in dollars, on the date.",
    parameters: { payee: "The organization or person paid." },
  },
);
const text =
  "On 3 March 2024 Alice Moore paid Harbor Logistics $1,250.50 for the 2015 to 2017 audit. " +
  "Bob Lee approved the payment on May 4. Carol Diaz paid nothing.";
const config: SymbolExtractorConfig = {
  referenceDate: "2024-06-01",
  entities: [[Person, (name) => new Person(name)]],
};
let failures = 0;

const corpus = new Corpus();
const [document] = corpus.add([{ documentId: "payment", text }]);
if (document === undefined) {
  throw new Error("Expected the payment document");
}
const chunk = corpus.slice(document, { start: 0, end: text.length });

process.stdout.write("Clairic on Workers AI\n");
const answer = await createChunkSymbolExtractor([chunk], config).query(
  new Map([[paid, ["payer", "payee", "amount", "on"]]]),
);
const values = answer.get(paid) ?? {};
const offered = (field: string, want: string | number): void => {
  const got = (values[field] ?? []).map((value) =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === "object"
        ? value.id
        : value,
  );
  report(field, got.includes(want), `${JSON.stringify(want)} in ${JSON.stringify(got)}`);
};
offered("payer", "Alice Moore");
offered("payee", "Harbor Logistics");
offered("amount", 1250.5);
offered("on", "2024-03-03");

process.stdout.write("Clef over Clairic's values\n");
const run = classifier({
  corpus,
  input: guard(new KnowledgeBase()).permit("*", paid),
  createChunkSymbolExtractor: (chunks) => createChunkSymbolExtractor(chunks, config),
});
for (const job of run) {
  // oxlint-disable-next-line eslint/no-await-in-loop -- One passage, one job.
  await job.execute();
}
const payment = paid({
  payer: new Person("Alice Moore"),
  payee: "Harbor Logistics",
  amount: 1250.5,
  on: new Date("2024-03-03T00:00:00Z"),
});
const value = query(run.kb, payment).value;
report("payment", value === "true", `${value}, expected true`);
report(
  "registered",
  run.kb.entities.get(Person, "Alice Moore") !== undefined,
  JSON.stringify(run.kb.entities.ids(Person)),
);
process.exitCode = failures === 0 ? 0 : 1;

function report(label: string, ok: boolean, detail: string): void {
  failures += ok ? 0 : 1;
  process.stdout.write(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(10)} ${detail}\n`);
}

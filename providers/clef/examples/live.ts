/**
 * A live check against Clef on Workers AI through the REST API. Classification reads one exit
 * interview and expects one supported reason, one explicitly denied reason, and one left
 * unmentioned. Resolution expects a later notice to supersede an earlier one, and two
 * conflicting opinions to both stand.
 *
 * Usage: pnpm --filter @factbag/clef live [clef | clef-flash]
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { enumeration, predicate } from "@factbag/core/dsl";
import type { Atom, PredicateSchema } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier, resolver } from "../src/index";
import type { Config, Run } from "../src/index";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const missing = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"].filter(
  (name) => (process.env[name] ?? "") === "",
);
if (missing.length > 0) {
  process.stderr.write(`Set ${missing.join(" and ")} in your shell or the repo's .env.\n`);
  process.exit(1);
}
const config: Config = { model: parseModel(process.argv[2]) };

let failures = 0;
process.stdout.write(`Clef (${config.model}) on Workers AI\n`);
await classification();
await resolution();
process.exitCode = failures === 0 ? 0 : 1;

/** One request: which reasons does the interview report, deny, or leave out? */
async function classification(): Promise<void> {
  const cancellation = { customer: "Cobalt", event: "cancellation-2026-09-01" };
  const corpus = new Corpus();
  corpus.add({
    documentId: "cobalt-exit-interview",
    text: "Cobalt's exit interview for the 2026-09-01 cancellation: recurring outages contributed to leaving. The subscription price did not contribute.",
  });
  const contributed = predicate(
    "contributed_to_cancellation",
    {
      customer: enumeration(cancellation.customer),
      event: enumeration(cancellation.event),
      factor: enumeration("reliability", "price", "competition"),
    },
    {
      description:
        "The document reports that this factor contributed to this customer's cancellation event.",
      instructions:
        "Require a reported contribution. Explicit non-contribution is denial; silence is irrelevant.",
    },
  );

  const run = classifier({
    corpus,
    input: guard(new KnowledgeBase()).permit("*", contributed),
    config,
  });
  await execute(run);

  process.stdout.write("Classification\n");
  for (const [factor, want] of [
    ["reliability", "true"],
    ["price", "false"],
    ["competition", "unknown"],
  ] as const) {
    const evidence = run.kb
      .literals()
      .filter((literal) => literal.atom.fields["factor"] === factor)
      .map((literal) => literal.metadata?.annotations?.["clef"]);
    report(factor, query(run.kb, contributed({ ...cancellation, factor })).value, want, evidence);
  }
}

/**
 * One request per contradiction: does another passage supersede each passage's account?
 * The evidence is written directly, so this checks resolution without depending on how
 * classification reads the passages.
 */
async function resolution(): Promise<void> {
  const listed = predicate(
    "listed",
    { entity: enumeration("Oriole Holdings") },
    { description: "The entity is currently on the blocking list." },
  );
  const controls = predicate(
    "controls",
    { owner: enumeration("Oriole Holdings"), company: enumeration("Harbor Components") },
    { description: "The owner controls the company." },
  );
  const kb = new KnowledgeBase();
  const corpus = new Corpus();
  /** Record evidence of `sign` for `atom`, sourced from a whole new document. */
  const evidence = <Schema extends PredicateSchema>(
    sign: "+" | "-",
    atom: Atom<Schema>,
    documentId: string,
    text: string,
  ): void => {
    const [document] = corpus.add([{ documentId, text }]);
    if (document === undefined) {
      throw new Error(`Expected ${documentId}`);
    }
    const source = corpus.slice(document, { start: 0, end: text.length }).id;
    if (sign === "+") {
      kb.asserts(atom, { source });
    } else {
      kb.denies(atom, { source });
    }
  };

  // A later notice reverses an earlier one, so the earlier passage no longer stands.
  const oriole = listed({ entity: "Oriole Holdings" });
  evidence(
    "-",
    oriole,
    "removal-2012",
    "Notice of 2012-03-01: Oriole Holdings is removed from the blocking list.",
  );
  evidence(
    "+",
    oriole,
    "redesignation-2022",
    "Notice of 2022-06-15: Oriole Holdings is designated again and added back to the blocking list, superseding its 2012 removal.",
  );
  // Two analysts disagree as of the same date. Disagreement alone is not supersession.
  const control = controls({ owner: "Oriole Holdings", company: "Harbor Components" });
  evidence(
    "+",
    control,
    "analyst-a",
    "Analyst A, 2026-05-01: in my assessment, Oriole Holdings controls Harbor Components.",
  );
  evidence(
    "-",
    control,
    "analyst-b",
    "Analyst B, 2026-05-01: in my assessment, Oriole Holdings does not control Harbor Components.",
  );

  const run = resolver(corpus, kb, config);
  await execute(run);

  process.stdout.write("Resolution\n");
  // Each predicate has one atom here, so its surviving literals are that atom's evidence.
  const kept = (name: string): (string | undefined)[] =>
    run.kb
      .literals()
      .filter((literal) => literal.atom.predicate.name === name)
      .map(({ metadata }) =>
        metadata?.source === undefined
          ? undefined
          : corpus.resolve(metadata.source).document.documentId,
      );
  report("superseded", query(run.kb, oriole).value, "true", kept("listed"));
  report("disagreement", query(run.kb, control).value, "conflicted", kept("controls"));
}

async function execute(run: Run): Promise<void> {
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- A few requests, one at a time.
    await job.execute();
  }
}

function report(label: string, value: string, want: string, detail: unknown): void {
  const ok = value === want;
  failures += ok ? 0 : 1;
  process.stdout.write(
    `  ${ok ? "ok  " : "FAIL"} ${label.padEnd(12)} ${value.padEnd(10)} expected ${want}  ${JSON.stringify(detail)}\n`,
  );
}

function parseModel(argument: string | undefined): NonNullable<Config["model"]> {
  if (argument === undefined || argument === "clef-flash") {
    return "clef-flash";
  }
  if (argument === "clef") {
    return "clef";
  }
  throw new Error(`Unknown model ${argument}; use clef or clef-flash`);
}
